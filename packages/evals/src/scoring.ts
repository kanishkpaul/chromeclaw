import type { AgentRun } from "@chromeclaw/shared";
import type { EvalTask } from "./tasks";

export interface OutcomeEvidence {
  passed: boolean;
  detail: string;
}

export interface EvalResult {
  id: string;
  runId: string;
  task: string;
  success: boolean;
  status: string;
  provider: string;
  model: string;
  steps: number;
  durationMs: number;
  failureReason?: string | undefined;
  finalAnswer?: string | undefined;
  evidence?: OutcomeEvidence | undefined;
}

export interface EvalReport {
  suite: "fixture-smoke";
  planner: "scripted";
  taskCount: number;
  generatedAt: string;
  successRate: number;
  averageSteps: number;
  averageDurationMs: number;
  results: EvalResult[];
  failureReasons: Record<string, number>;
}

/** Scores known answers or independent fixture evidence, never observation text. */
export function scoreRun(
  task: EvalTask,
  run: AgentRun,
  evidence?: OutcomeEvidence,
): EvalResult {
  const finalAnswer = run.finalAnswer ?? "";
  const expectedStatus =
    task.expectation.kind === "refusal"
      ? "blocked"
      : task.expectation.kind === "handback"
        ? "awaiting-answer"
        : "done";
  const outcomeMatches =
    task.expectation.kind === "answer"
      ? finalAnswer.trim() === task.expectation.answer
      : evidence?.passed === true;
  const success = run.status === expectedStatus && outcomeMatches;
  const durationMs = run.completedAt
    ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
    : 0;

  return {
    id: task.id,
    runId: run.id,
    task: task.task,
    success,
    status: run.status,
    provider: run.provider,
    model: run.model,
    steps: run.steps.length,
    durationMs,
    failureReason: success
      ? undefined
      : run.status !== expectedStatus
        ? `Expected ${expectedStatus}, observed ${run.status}.`
        : (evidence?.detail ??
          run.error ??
          "The answer did not match the known fact."),
    finalAnswer,
    evidence,
  };
}

export function buildReport(results: EvalResult[]): EvalReport {
  const failures = results.filter((result) => !result.success);
  return {
    suite: "fixture-smoke",
    planner: "scripted",
    taskCount: results.length,
    generatedAt: new Date().toISOString(),
    successRate: results.length
      ? (results.length - failures.length) / results.length
      : 0,
    averageSteps: average(results.map((result) => result.steps)),
    averageDurationMs: average(results.map((result) => result.durationMs)),
    results: [...results].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    failureReasons: failures.reduce<Record<string, number>>((acc, result) => {
      const key = result.failureReason ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
