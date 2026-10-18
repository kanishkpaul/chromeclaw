import { mkdir, open, readdir, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  BrowserActionSchema,
  GateRecordSchema,
  ObservationRecordSchema,
  PendingRecordSchema,
  PlannerRecordSchema,
  RunHeaderSchema,
  RunIdSchema,
  RunRecordSchema,
  StatusSchema,
  StepRecordSchema,
  PassageSchema,
  type AgentRun,
} from "@chromeclaw/shared";

const EventSchema = z
  .object({
    version: z.literal(1),
    timestamp: z.string(),
    runId: RunIdSchema,
    type: z.enum([
      "run_started",
      "configuration",
      "model_usage",
      "source_opened",
      "discovery",
      "run_suspended",
      "observation",
      "proposal",
      "gate",
      "act_started",
      "step",
      "state",
      "user_response",
      "crossing",
      "error",
      "run_completed",
    ]),
    payload: z.unknown(),
  })
  .strict();
const PayloadSchemas = {
  discovery: z
    .object({
      stage: z.string().max(40),
      detail: z.string().max(8000),
      url: z.string().optional(),
      passages: z.array(PassageSchema).max(100).optional(),
    })
    .strict(),
  run_started: RunHeaderSchema,
  configuration: z
    .object({
      provider: z.string(),
      model: z.string(),
      configuration: PlannerRecordSchema.optional(),
    })
    .strict(),
  source_opened: z
    .object({ passageId: z.string(), snapshotId: z.string(), url: z.string() })
    .strict(),
  model_usage: z
    .object({
      promptTokens: z.number().int().nonnegative().nullable(),
      completionTokens: z.number().int().nonnegative().nullable(),
    })
    .strict(),
  run_suspended: z
    .object({
      status: z.enum(["awaiting-answer", "awaiting-approval", "paused"]),
      savedAt: z.string(),
      finalAnswer: z.string().optional(),
      pending: PendingRecordSchema.optional(),
    })
    .strict(),
  observation: ObservationRecordSchema,
  proposal: z
    .object({ stepId: z.string(), action: BrowserActionSchema })
    .strict(),
  gate: z.object({ stepId: z.string(), gate: GateRecordSchema }).strict(),
  act_started: z
    .object({
      stepId: z.string(),
      action: BrowserActionSchema,
      effect: z
        .enum(["navigate", "activate", "edit", "read", "wait", "tabs"])
        .optional(),
      input: z.enum(["trusted", "native-dom-fallback", "none"]).optional(),
    })
    .strict(),
  step: StepRecordSchema,
  state: z
    .object({ status: StatusSchema, pending: PendingRecordSchema.optional() })
    .strict(),
  user_response: z
    .object({
      pendingId: z.string(),
      kind: z.enum(["answer", "approval", "pause"]),
      answer: z.string().optional(),
      approved: z.boolean().optional(),
    })
    .strict(),
  crossing: z
    .object({
      destination: z.string(),
      requestBytes: z.number().nonnegative(),
      payloadHash: z.string(),
      attempt: z.number().int().positive(),
      estimatedCost: z.number().finite().nonnegative().nullable(),
      accounting: z.enum(["not-estimated", "local-zero", "user-ceiling"]),
    })
    .strict(),
  error: z
    .object({
      stage: z.string(),
      message: z.string(),
      stepId: z.string().optional(),
    })
    .strict(),
  run_completed: z
    .object({
      status: z.enum(["done", "failed", "blocked", "stopped", "uncertain"]),
      completedAt: z.string(),
      finalAnswer: z.string().optional(),
      error: z.string().optional(),
      pending: PendingRecordSchema.optional(),
    })
    .strict(),
};
export type RunLogEvent = z.infer<typeof EventSchema>;
export type ReadResult =
  | { kind: "ok"; run: AgentRun; events: RunLogEvent[]; warnings: string[] }
  | { kind: "missing" }
  | { kind: "invalid" | "io"; message: string };

function validateEvent(value: unknown): RunLogEvent {
  const event = EventSchema.parse(value);
  PayloadSchemas[event.type].parse(event.payload);
  return event;
}

/** Append-only validated events. A synced line is the durability boundary, not a run copy. */
export class JsonlRunStore {
  private writes: Promise<void> = Promise.resolve();
  constructor(private dir = ".chromeclaw/runs") {}
  append(event: RunLogEvent): Promise<void> {
    const validated = validateEvent(event);
    const operation = this.writes.then(async () => {
      await mkdir(this.dir, { recursive: true });
      const file = await open(
        this.fileFor(validated.runId),
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_APPEND |
          constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await file.writeFile(`${JSON.stringify(validated)}\n`);
        await file.sync();
      } finally {
        await file.close();
      }
    });
    // Keep the queue usable after a failed write, while the caller still receives its failure.
    this.writes = operation.catch(() => undefined);
    return operation;
  }
  async readDetailed(runId: string): Promise<ReadResult> {
    if (!RunIdSchema.safeParse(runId).success)
      return { kind: "invalid", message: "Invalid run ID." };
    let content: string;
    try {
      const file = await open(
        this.fileFor(runId),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        content = await file.readFile("utf8");
      } finally {
        await file.close();
      }
    } catch (error) {
      return error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
        ? { kind: "missing" }
        : { kind: "io", message: "Run could not be read safely." };
    }
    const lines = content.split("\n");
    if (lines.at(-1) === "") lines.pop();
    const events: RunLogEvent[] = [];
    const warnings: string[] = [];
    for (const [index, line] of lines.entries()) {
      try {
        const event = validateEvent(JSON.parse(line));
        if (event.runId !== runId)
          return {
            kind: "invalid",
            message: "Run ID does not match its file.",
          };
        events.push(event);
      } catch {
        if (index !== lines.length - 1)
          return {
            kind: "invalid",
            message: `Invalid record at line ${index + 1}.`,
          };
        warnings.push(`Ignored corrupt tail at line ${index + 1}.`);
      }
    }
    const header = events.find((event) => event.type === "run_started");
    if (!header)
      return { kind: "invalid", message: "Run has no valid header." };
    const run: AgentRun = {
      ...RunHeaderSchema.parse(header.payload),
      steps: [],
    };
    run.reservedCost = 0;
    let completed = false;
    const observations = new Map<
      string,
      z.infer<typeof ObservationRecordSchema>
    >();
    for (const event of events) {
      if (
        event.type !== "run_completed" &&
        event.type !== "run_suspended" &&
        event.type !== "source_opened"
      )
        completed = false;
      if (event.type === "crossing") {
        const crossing = PayloadSchemas.crossing.parse(event.payload);
        run.reservedCost =
          (Math.round((run.reservedCost ?? 0) * 1000000) +
            Math.ceil((crossing.estimatedCost ?? 0) * 1000000)) /
          1000000;
      }
      if (event.type === "configuration")
        Object.assign(run, PayloadSchemas.configuration.parse(event.payload));
      if (event.type === "run_suspended") {
        const saved = PayloadSchemas.run_suspended.parse(event.payload);
        run.status = saved.status;
        run.pending = saved.pending;
        run.finalAnswer = saved.finalAnswer;
        delete run.completedAt;
        completed = true;
      }
      if (event.type === "observation") {
        const observation = ObservationRecordSchema.parse(event.payload);
        observations.set(observation.snapshotId, observation);
      }
      if (event.type === "step") {
        const step = StepRecordSchema.parse(event.payload);
        if (step.beforeId && observations.has(step.beforeId))
          step.observation = observations.get(step.beforeId);
        run.steps.push(step);
      }
      if (event.type === "state") {
        const state = PayloadSchemas.state.parse(event.payload);
        run.status = state.status;
        if (state.pending) run.pending = state.pending;
        else delete run.pending;
      }
      if (event.type === "user_response") {
        const response = PayloadSchemas.user_response.parse(event.payload);
        if (response.answer) (run.answers ??= []).push(response.answer);
      }
      if (event.type === "run_completed") {
        Object.assign(run, PayloadSchemas.run_completed.parse(event.payload));
        delete run.pending;
        completed = true;
      }
    }
    if (!completed) {
      run.status = "paused";
      delete run.completedAt;
      warnings.push("Interrupted run recovered from complete events.");
    }
    if (warnings.length) run.warnings = warnings;
    return { kind: "ok", run: RunRecordSchema.parse(run), events, warnings };
  }
  async forget(runId: string): Promise<void> {
    RunIdSchema.parse(runId);
    await this.writes;
    await unlink(this.fileFor(runId));
  }

  async readRun(runId: string): Promise<AgentRun | null> {
    const result = await this.readDetailed(runId);
    if (result.kind === "missing") return null;
    if (result.kind !== "ok") throw new Error(result.message);
    return result.run;
  }
  async listRuns(): Promise<AgentRun[]> {
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw new Error("Run directory could not be read.");
    }
    const runs: AgentRun[] = [];
    for (const file of files.filter((file) => file.endsWith(".jsonl"))) {
      const run = await this.readRun(file.slice(0, -6));
      if (run) runs.push(run);
    }
    return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  private fileFor(runId: string): string {
    return path.resolve(this.dir, `${RunIdSchema.parse(runId)}.jsonl`);
  }
}
