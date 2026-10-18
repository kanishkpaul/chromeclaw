import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import console from "node:console";
const source = process.argv.includes("--source");
const { BrowserAgentRuntime, openCapturedSource } = await import(
  source ? "../src/index.ts" : "../dist/index.js"
);
const output = path.resolve(".chromeclaw/phase8-regressions");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, source ? "source-" : "built-"),
);
const profiles = await mkdtemp(
  path.join(tmpdir(), "chromeclaw-live-regression-"),
);
let forbidden = 0;
const foreign = createServer((_request, response) => {
  forbidden++;
  response.end("Forbidden analytics");
});
await new Promise((resolve) => foreign.listen(0, "127.0.0.1", resolve));
const foreignOrigin = `http://127.0.0.1:${foreign.address().port}`;
const server = createServer((request, response) => {
  if (request.url === "/redirect") {
    response.writeHead(302, { location: "/forbidden-target" }).end();
    return;
  }
  if (request.url !== "/read") {
    forbidden++;
    response.end("Forbidden asset or redirect target");
    return;
  }
  response.setHeader("content-type", "text/html");
  response.end(
    `<title>Readable documentation</title><link rel="stylesheet" href="/theme.css?v=1"><p>Independent live regression fact: ALDER-82.</p><img src="${foreignOrigin}/analytics"><script>fetch('/telemetry?secret=SYNTHETIC')</script>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const checks = [];
try {
  const run = await new BrowserAgentRuntime().run({
    task: "Quote the independent fact.",
    askUrl: origin + "/read",
    headless: true,
    profileDir: profiles,
    logDir: execution,
    permissions: { origins: [origin], allowLoopback: true, timeoutMs: 60000 },
    planner: {
      name: "regression-oracle",
      model: "plumbing-only",
      async plan({ observation }) {
        const passage = observation.passages.find(
          (item) => item.text === "Independent live regression fact: ALDER-82.",
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
  checks.push({
    id: "blocked-passive-assets-do-not-fail-readable-main-document",
    passed: run.status === "done",
    status: run.status,
    error: run.error,
    runId: run.id,
  });
  checks.push({
    id: "query-assets-telemetry-and-foreign-requests-still-blocked",
    passed: forbidden === 0,
    forbidden,
  });
  const reference = run.steps.find((step) => step.action?.type === "finish")
    ?.action.evidence?.[0];
  assert.ok(reference);
  const opened = await openCapturedSource(run.id, reference.passageId, {
    headless: true,
    profileDir: path.join(profiles, "source"),
    logDir: execution,
  });
  checks.push({
    id: "explicit-source-opening-survives-blocked-passive-assets",
    passed: opened.ok,
  });
  if (opened.ok) await opened.close();
  const redirected = await new BrowserAgentRuntime().run({
    task: "Read only the selected redirect page.",
    askUrl: origin + "/redirect",
    headless: true,
    profileDir: path.join(profiles, "redirect"),
    logDir: execution,
    permissions: { origins: [origin], allowLoopback: true, timeoutMs: 60000 },
    planner: {
      name: "must-not-run",
      model: "plumbing-only",
      async plan() {
        throw new Error("Denied main navigation reached planner.");
      },
    },
  });
  checks.push({
    id: "main-document-redirect-still-refuses-without-following",
    passed: redirected.status === "failed" && forbidden === 0,
    status: redirected.status,
    forbidden,
  });
} finally {
  server.closeAllConnections();
  foreign.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => foreign.close(resolve)),
  ]);
  await rm(profiles, { recursive: true, force: true });
  const report = { suite: "live-01-regressions", source, checks };
  await writeFile(
    path.join(execution, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
assert.ok(checks.length === 4 && checks.every((check) => check.passed));
