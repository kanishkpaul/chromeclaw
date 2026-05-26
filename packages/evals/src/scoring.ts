import type { AgentRun } from "@chromeclaw/shared";
import type { EvalTask } from "./tasks";

export interface EvalResult {
  id: string;
  task: string;
  success: boolean;
  status: string;
  steps: number;
  durationMs: number;
  failureReason?: string | undefined;
  finalAnswer?: string | undefined;
}

export interface EvalReport {
  generatedAt: string;
  successRate: number;
  averageSteps: number;
  averageDurationMs: number;
  results: EvalResult[];
  failureReasons: Record<string, number>;
}

export function scoreRun(task: EvalTask, run: AgentRun): EvalResult {
  const finalAnswer = run.finalAnswer ?? "";
  const expectedHit = task.expectedSubstring
    ? finalAnswer.toLowerCase().includes(task.expectedSubstring.toLowerCase()) ||
      run.steps.some((step) => step.observationSummary?.toLowerCase().includes(task.expectedSubstring!.toLowerCase()))
    : true;
  const validatorHit = task.validator ? task.validator(run) : true;
  const success = expectedHit && validatorHit && run.status !== "failed";
  const durationMs = run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime() : 0;

  return {
    id: task.id,
    task: task.task,
    success,
    status: run.status,
    steps: run.steps.length,
    durationMs,
    failureReason: success ? undefined : run.error ?? run.finalAnswer ?? "Validator did not pass.",
    finalAnswer
  };
}

export function buildReport(results: EvalResult[]): EvalReport {
  const failures = results.filter((result) => !result.success);
  return {
    generatedAt: new Date().toISOString(),
    successRate: results.length ? (results.length - failures.length) / results.length : 0,
    averageSteps: average(results.map((result) => result.steps)),
    averageDurationMs: average(results.map((result) => result.durationMs)),
    results,
    failureReasons: failures.reduce<Record<string, number>>((acc, result) => {
      const key = result.failureReason ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
