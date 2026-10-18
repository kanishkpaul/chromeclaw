import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import console from "node:console";
const source = process.argv.includes("--source"),
  live = process.argv.includes("--live-source");
const { BrowserAgentRuntime } = await import(
  source ? "../src/index.ts" : "../dist/index.js"
);
const output = path.resolve(".chromeclaw/phase8-research-regression");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, live ? "live-" : source ? "source-" : "built-"),
);
const profiles = await mkdtemp(
  path.join(tmpdir(), "chromeclaw-research-regression-"),
);
const requests = [],
  checks = [];
let origin, sourceUrl;
const server = createServer((request, response) => {
  requests.push({ method: request.method, path: request.url.split("?")[0] });
  response.setHeader("content-type", "text/html");
  response.end(
    request.url.startsWith("/index?")
      ? `<a href="${sourceUrl}">Selected source</a>`
      : "<p>Independent regression fact: cedar is 23.</p>",
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
sourceUrl = live ? "https://httpbin.org/robots.txt" : origin + "/source";
try {
  for (const duplicate of [true, false]) {
    const run = await new BrowserAgentRuntime().run({
      task: "Return each captured URL at most once.",
      discovery: {
        mode: "web",
        engineUrl: origin + "/index",
        queries: ["selected source"],
        maxSources: 2,
      },
      headless: true,
      profileDir: path.join(profiles, String(duplicate)),
      logDir: execution,
      permissions: {
        origins: [origin, ...(live ? ["https://httpbin.org"] : [])],
        allowLoopback: true,
        write: false,
        timeoutMs: 60000,
      },
      planner: {
        name: "duplicate-regression",
        model: "plumbing-only",
        async plan({ observation }) {
          const passage = observation.passages?.[0];
          assert.ok(passage);
          const match = {
            url: sourceUrl,
            reason: "Captured source",
            evidence: [
              {
                snapshotId: passage.snapshotId,
                passageId: passage.id,
                quote: passage.text,
              },
            ],
          };
          return {
            type: "finish",
            answer: "Captured source",
            webFind: {
              outcome: "matches",
              matches: duplicate ? [match, match] : [match],
            },
          };
        },
      },
    });
    checks.push({
      id: duplicate
        ? "duplicate-ranked-url-refuses-valid-citations"
        : "unique-ranked-url-with-valid-citation-completes",
      passed: run.status === (duplicate ? "uncertain" : "done"),
      status: run.status,
      error: run.error,
      runId: run.id,
    });
  }
  checks.push({
    id: "no-browser-writes",
    passed: requests.every((request) => request.method === "GET"),
    requests,
  });
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
  await writeFile(
    path.join(execution, "report.json"),
    JSON.stringify(
      { suite: "live-01-ranked-url-regression", source, live, checks },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ execution, source, live, checks }));
}
assert.ok(checks.length === 3 && checks.every((check) => check.passed));
