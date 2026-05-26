import { describe, expect, it } from "vitest";
import { buildReport, scoreRun } from "../src/index";
import type { AgentRun } from "@chromeclaw/shared";

describe("eval scoring", () => {
  const run: AgentRun = {
    id: "run_1",
    task: "demo",
    status: "done",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
    maxSteps: 3,
    provider: "mock",
    model: "mock",
    steps: [],
    finalAnswer: "The title is Example Domain."
  };

  it("scores expected substring matches", () => {
    expect(scoreRun({ id: "a", task: "demo", maxSteps: 3, expectedSubstring: "Example Domain" }, run).success).toBe(true);
  });

  it("builds aggregate reports", () => {
    const report = buildReport([scoreRun({ id: "a", task: "demo", maxSteps: 3, expectedSubstring: "missing" }, run)]);
    expect(report.successRate).toBe(0);
    expect(Object.keys(report.failureReasons)).toHaveLength(1);
  });
});
