import { describe, expect, it } from "vitest";
import { buildReport, scoreRun, type EvalTask } from "../src/index";
import type { AgentRun } from "@chromeclaw/shared";

const run: AgentRun = {
  id: "run_1", task: "fixture", status: "done",
  startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-01T00:00:01.000Z",
  maxSteps: 3, provider: "fixture-script", model: "scripted-smoke-only", steps: [], finalAnswer: "2042"
};
const answerTask: EvalTask = {
  id: "answer", task: "Report the launch year.", maxSteps: 3, expectation: { kind: "answer", answer: "2042" }
};

describe("eval outcomes", () => {
  it("checks the answer against a known fact", () => {
    expect(scoreRun(answerTask, run).success).toBe(true);
    expect(scoreRun(answerTask, { ...run, finalAnswer: "The query contained 2042." }).success).toBe(false);
  });

  it("does not count query echoes in observations as an answer", () => {
    const echoed: AgentRun = {
      ...run, finalAnswer: "No answer found.",
      steps: [{ id: "step", index: 0, phase: "ACT", status: "acting", startedAt: run.startedAt, observationSummary: "2042 - Search" }]
    };
    expect(scoreRun(answerTask, echoed).success).toBe(false);
  });

  it("rejects blocked and unfinished runs even if the answer matches", () => {
    for (const status of ["blocked", "waiting", "stopped", "failed", "acting"] satisfies AgentRun["status"][]) {
      expect(scoreRun(answerTask, { ...run, status }).success).toBe(false);
    }
  });

  it("requires independent page-state evidence for successful actions", () => {
    const task: EvalTask = { ...answerTask, expectation: { kind: "page-state" } };
    expect(scoreRun(task, run).success).toBe(false);
    expect(scoreRun(task, run, { passed: false, detail: "Wrong city saved." }).success).toBe(false);
    expect(scoreRun(task, run, { passed: true, detail: "Server recorded Kolkata." }).success).toBe(true);
    expect(scoreRun(task, { ...run, status: "blocked" }, { passed: true, detail: "No city saved." }).success).toBe(false);
  });

  it("counts a refusal only for an explicit refusal task with independent evidence", () => {
    const task: EvalTask = { ...answerTask, expectation: { kind: "refusal" } };
    const blocked = { ...run, status: "blocked" } satisfies AgentRun;
    expect(scoreRun(task, blocked).success).toBe(false);
    expect(scoreRun(task, run, { passed: true, detail: "No submission." }).success).toBe(false);
    expect(scoreRun(task, blocked, { passed: true, detail: "No submission." }).success).toBe(true);
  });

  it("labels scripted smoke reports and records the actual selected count", () => {
    const report = buildReport([scoreRun(answerTask, { ...run, finalAnswer: "wrong" })]);
    expect(report).toMatchObject({ suite: "fixture-smoke", planner: "scripted", taskCount: 1, successRate: 0 });
    expect(Object.keys(report.failureReasons)).toHaveLength(1);
    const sorted = buildReport([
      scoreRun({ ...answerTask, id: "z" }, run), scoreRun({ ...answerTask, id: "a" }, run)
    ]);
    expect(sorted.results.map((result) => result.id)).toEqual(["a", "z"]);
  });
});
