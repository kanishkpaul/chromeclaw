// Stage 7 reproduction for the recurring "Browser cleanup failed." warning. Branded Chrome can
// start GoogleUpdater helpers during a long task; its main process then outlives the driver
// disconnect while they finish. Whether the updater wakes depends on Chrome's own schedule, so
// this is a manual headed check on a loopback page, not a deterministic CI gate.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import console from "node:console";

const source = process.argv.includes("--source");
const { BrowserAgentRuntime } = await import(
  source ? "../src/index.ts" : "../dist/index.js"
);
// Stage 6 actual-local runs that warned lasted 30 s or more; short scripted runs never did.
const PLANNER_DELAY_MS = 35000;
const TRIALS = 3;
const output = path.resolve(".chromeclaw/phase8-cleanup");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, source ? "source-" : "built-"),
);
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-cleanup-"));
const server = createServer((_request, response) => {
  response.setHeader("content-type", "text/html");
  response.end("<title>Cleanup</title><p>Cleanup fixture fact: BIRCH-7.</p>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const updaters = () =>
  execFileSync("ps", ["-axo", "command"], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line.includes("GoogleUpdater.app")).length;
const trials = [];
try {
  for (let index = 0; index < TRIALS; index++) {
    let updatersBeforeFinish = 0;
    const started = Date.now();
    const run = await new BrowserAgentRuntime().run({
      task: "Quote the cleanup fixture fact.",
      askUrl: origin + "/",
      headless: false,
      profileDir: path.join(profiles, String(index)),
      logDir: execution,
      permissions: {
        origins: [origin],
        allowLoopback: true,
        timeoutMs: 120000,
      },
      planner: {
        name: "cleanup-oracle",
        model: "plumbing-only",
        async plan({ observation }) {
          await delay(PLANNER_DELAY_MS);
          updatersBeforeFinish = updaters();
          const passage = observation.passages.find(
            (item) => item.text === "Cleanup fixture fact: BIRCH-7.",
          );
          assert.ok(passage);
          return {
            type: "finish",
            answer: passage.text,
            evidence: [
              {
                snapshotId: observation.snapshotId,
                passageId: passage.id,
                quote: passage.text,
              },
            ],
          };
        },
      },
    });
    trials.push({
      status: run.status,
      warnings: run.warnings ?? [],
      updatersBeforeFinish,
      afterPlannerMs: Date.now() - started - PLANNER_DELAY_MS,
    });
  }
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
}
const checks = [
  {
    id: "long-task-cleanup-reports-no-failure",
    passed: trials.every(
      (trial) => trial.status === "done" && !trial.warnings.length,
    ),
  },
  {
    // A trial where the updater never woke cannot reproduce the defect; report it, do not pass it.
    id: "updater-woke-in-at-least-one-trial",
    passed: trials.some((trial) => trial.updatersBeforeFinish > 0),
  },
];
const report = { suite: "live-01-cleanup", source, trials, checks };
await writeFile(
  path.join(execution, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
assert.ok(checks.every((check) => check.passed));
