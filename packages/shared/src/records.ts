import { z } from "zod";
import { BrowserActionSchema } from "./schemas";
import { DiscoverySchema } from "./discovery";

export const RunIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/);
export const StatusSchema = z.enum([
  "idle",
  "observing",
  "planning",
  "acting",
  "waiting",
  "done",
  "blocked",
  "failed",
  "stopped",
  "awaiting-answer",
  "awaiting-approval",
  "paused",
  "uncertain",
]);
const PermissionsSchema = z
  .object({
    origins: z.array(z.string()).readonly(),
    tools: z
      .array(
        z.enum([
          "navigate",
          "search_web",
          "click",
          "type",
          "select",
          "back",
          "open_tab",
          "switch_tab",
          "close_tab",
          "press",
          "wait",
          "extract_text",
          "summarize_page",
          "scroll",
          "screenshot",
          "ask_user",
          "finish",
          "fail",
        ]),
      )
      .readonly(),
    read: z.boolean(),
    write: z.boolean(),
    irreversible: z.enum(["deny", "confirm"]),
    allowLoopback: z.boolean(),
    maxSteps: z.number().int().positive(),
    expiresAt: z.number().finite(),
    maxCost: z.number().nonnegative(),
  })
  .strict();
export const PassageSchema = z
  .object({
    id: z.string().min(1),
    snapshotId: z.string().min(1),
    url: z.string(),
    text: z.string().min(1).max(2000),
    kind: z.enum(["document", "shadow", "frame"]),
  })
  .strict();
export const ObservationRecordSchema = z
  .object({
    snapshotId: z.string(),
    backUrl: z.string().optional(),
    tabs: z
      .array(
        z
          .object({ id: z.string(), url: z.string(), active: z.boolean() })
          .strict(),
      )
      .max(5)
      .optional(),
    passages: z.array(PassageSchema).max(100).optional(),
    unreadableRegions: z.number().int().nonnegative().optional(),
    omittedPassages: z.boolean().optional(),
    documentId: z.string(),
    omittedTargets: z.number().int().nonnegative().optional(),
    unreadableFrames: z.number().int().nonnegative().optional(),
    url: z.string(),
    title: z.string(),
    visibleText: z.string(),
    accessibilityTreeSummary: z.string(),
    timestamp: z.string(),
    screenshotPath: z.string().optional(),
    interactiveElements: z.array(
      z
        .object({
          id: z.string(),
          number: z.number().int().positive().optional(),
          documentId: z.string().optional(),
          frameId: z.string().optional(),
          role: z.string().optional(),
          name: z.string().optional(),
          text: z.string().optional(),
          selector: z.string().optional(),
          tagName: z.string().optional(),
          href: z.string().optional(),
          bounds: z
            .object({
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
            })
            .optional(),
          destination: z.string().optional(),
          formDestination: z.string().optional(),
          options: z.array(z.string()).max(100).optional(),
          isEditable: z.boolean().optional(),
          isDisabled: z.boolean().optional(),
          isOccluded: z.boolean().optional(),
          isVisible: z.boolean(),
          isCredential: z.boolean(),
          score: z.number(),
        })
        .strict(),
    ),
  })
  .strict();
export const ApprovalRecordSchema = z
  .object({
    action: BrowserActionSchema,
    snapshotId: z.string(),
    targetName: z.string(),
    destination: z.string(),
    reason: z.string(),
  })
  .strict();
export const PendingRecordSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string(),
      kind: z.literal("answer"),
      question: z.string(),
      credentialHandback: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      kind: z.literal("approval"),
      proposal: ApprovalRecordSchema,
    })
    .strict(),
  z
    .object({ id: z.string(), kind: z.literal("pause"), reason: z.string() })
    .strict(),
]);
export const GateRecordSchema = z
  .object({
    decision: z.enum(["allow", "block", "confirm"]),
    approved: z.boolean(),
    reason: z.string().optional(),
  })
  .strict();
export const StepRecordSchema = z
  .object({
    id: z.string(),
    index: z.number().int().nonnegative(),
    phase: z.enum(["OBSERVE", "PLAN", "ACT", "ERROR", "RECOVER", "DONE"]),
    status: StatusSchema,
    gate: GateRecordSchema.optional(),
    thoughtSummary: z.string().optional(),
    action: BrowserActionSchema.optional(),
    observation: ObservationRecordSchema.optional(),
    observationSummary: z.string().optional(),
    beforeId: z.string().optional(),
    afterId: z.string().optional(),
    result: z.string().optional(),
    error: z.string().optional(),
    startedAt: z.string(),
    completedAt: z.string().optional(),
    durationMs: z.number().nonnegative().optional(),
  })
  .strict();
export const PlannerRecordSchema = z
  .object({
    responseFormat: z.enum(["json", "llama-schema"]).default("json"),
    stream: z.boolean().default(false),
    endpoint: z.string(),
    mode: z.enum(["local", "hosted"]),
    requestCost: z.number().finite().nonnegative().nullable(),
    maxOutputTokens: z.number().int().positive(),
    tokenLimitField: z.enum(["max_tokens", "max_completion_tokens"]),
    requestTimeoutMs: z.number().int().positive(),
  })
  .strict();
export const RunHeaderSchema = z
  .object({
    id: RunIdSchema,
    task: z.string(),
    askUrl: z.string().optional(),
    findUrl: z.string().optional(),
    discovery: DiscoverySchema.optional(),
    status: StatusSchema,
    startedAt: z.string(),
    completedAt: z.string().optional(),
    maxSteps: z.number().int().positive(),
    permissions: PermissionsSchema.optional(),
    configuration: PlannerRecordSchema.optional(),
    reservedCost: z.number().finite().nonnegative().optional(),
    provider: z.string(),
    model: z.string(),
    finalAnswer: z.string().optional(),
    error: z.string().optional(),
    pending: PendingRecordSchema.optional(),
    answers: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  })
  .strict();
export const RunRecordSchema = RunHeaderSchema.extend({
  steps: z.array(StepRecordSchema),
});
export type ActionApproval = z.infer<typeof ApprovalRecordSchema>;
export type PendingInput = z.infer<typeof PendingRecordSchema>;
