// nodejs.org/api offers two "File system" links, sidebar and index, both to fs.html. Find handed
// back for a position even though either names the same destination. Same-label links with
// different destinations, and same-label buttons, must still ask which one was meant.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import console from "node:console";

const built = process.argv.includes("--built");
const { BrowserAgentRuntime } = await import(
  built ? "../dist/index.js" : "../src/index.ts"
);
const output = path.resolve(".chromeclaw/find-duplicates");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, built ? "built-" : "source-"),
);
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-duplicates-"));
const server = createServer((_request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><title>Duplicates</title>
<nav><a href="/fs.html">File system</a> <a href="/guide-a">Guide</a></nav>
<main><a href="/fs.html">File system</a> <a href="/guide-b">Guide</a>
<button type=button>Delivery</button> <button type=button>Delivery</button></main>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const cases = [
  // id, offered label, role, trusted description, required outcome
  [
    "same-destination-links",
    "File system",
    "link",
    "Find the file system API link.",
    "done",
  ],
  [
    "different-destination-links",
    "Guide",
    "link",
    "Find the guide link.",
    "uncertain",
  ],
  [
    "different-destination-links-with-position",
    "Guide",
    "link",
    "Find the second guide link.",
    "done",
  ],
  [
    "same-label-buttons",
    "Delivery",
    "button",
    "Find the delivery button.",
    "uncertain",
  ],
];
const results = [];
try {
  for (const [id, label, role, task, expected] of cases) {
    const run = await new BrowserAgentRuntime().run({
      task,
      findUrl: origin + "/",
      maxSteps: 2,
      headless: true,
      profileDir: path.join(profiles, id),
      logDir: path.join(execution, id),
      permissions: { origins: [origin], allowLoopback: true, timeoutMs: 30000 },
      // A scripted planner isolates the label rule; it is not a relevance evaluation.
      planner: {
        name: "scripted-duplicates",
        model: "contract-only",
        async plan({ observation }) {
          const peers = observation.interactiveElements.filter(
            (node) => node.name === label && node.role === role,
          );
          assert.equal(peers.length, 2);
          const chosen = task.includes("second") ? peers[1] : peers[0];
          return {
            type: "finish",
            answer: label,
            pageFind: {
              outcome: "matches",
              confidence: 1,
              matches: [
                {
                  snapshotId: observation.snapshotId,
                  target: chosen.number,
                  reason: label,
                },
              ],
            },
          };
        },
      },
    });
    results.push({
      id,
      expected,
      status: run.status,
      error: run.error ?? null,
    });
  }
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
}
const checks = results.map((result) => ({
  ...result,
  // A refusal must come from this rule, not from an unrelated gate.
  passed:
    result.status === result.expected &&
    (result.expected === "done" ||
      result.error?.startsWith("Several controls share this label") === true),
}));
const report = { suite: "live-01-find-duplicates", built, checks };
await writeFile(
  path.join(execution, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
assert.ok(checks.every((check) => check.passed));
