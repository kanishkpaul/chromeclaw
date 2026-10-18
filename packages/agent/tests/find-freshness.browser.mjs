// Read-only find on a page that mutates after load, as on nodejs.org/api in Phase 8. Before
// D-032 every row below refused as stale. Unrelated activity and layout movement now complete;
// every change to the cited control or passage must keep refusing.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import { setTimeout as delay } from "node:timers/promises";

const built = process.argv.includes("--built");
const { BrowserAgentRuntime } = await import(
  built ? "../dist/index.js" : "../src/index.ts"
);
const output = path.resolve(".chromeclaw/find-freshness");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, built ? "built-" : "source-"),
);
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-freshness-"));
let mode = "none";
const server = createServer((request, response) => {
  if (request.url === "/mode") {
    response.end(mode);
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  // The clock models scroll spies, timers and rotating banners: page activity unrelated to the
  // cited link or passage. Other modes change the cited reference itself after capture.
  response.end(`<!doctype html><title>Freshness</title>
<p>The project team page lists contributors.</p>
<p><a id=people href="/people">People</a></p>
<p>Updated <span id=clock>0</span></p>
<script>
let tick = 0;
setInterval(async () => {
  const current = await (await fetch('/mode')).text();
  if (current === 'clock') document.getElementById('clock').textContent = String(++tick);
  if (current === 'shift' && !document.getElementById('banner'))
    document.getElementById('people').parentElement.insertAdjacentHTML('beforebegin', '<p id=banner style="height:120px">Release notes</p>');
  if (current === 'relabel') document.getElementById('people').textContent = 'Payments';
  if (current === 'retarget') document.getElementById('people').href = '/payments';
  if (current === 'passage') document.querySelector('p').textContent = 'The billing page lists invoices.';
  if (current === 'replace' && document.getElementById('people')) {
    const copy = document.getElementById('people').cloneNode(true);
    document.getElementById('people').replaceWith(copy);
    copy.removeAttribute('id');
  }
  if (current === 'cover' && !document.getElementById('cover'))
    document.body.insertAdjacentHTML('beforeend', '<div id=cover style="position:fixed;inset:0;background:white"></div>');
}, 50);
</script>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const cases = [
  // id, page change after capture, cited reference, required outcome
  ["static-target", "none", "target", "done"],
  ["static-passage", "none", "passage", "done"],
  ["unrelated-clock-target", "clock", "target", "done"],
  ["unrelated-layout-shift-target", "shift", "target", "done"],
  ["unrelated-clock-passage", "clock", "passage", "done"],
  ["cited-link-relabelled", "relabel", "target", "uncertain"],
  ["cited-link-retargeted", "retarget", "target", "uncertain"],
  ["cited-link-replaced", "replace", "target", "uncertain"],
  ["cited-link-covered", "cover", "target", "uncertain"],
  ["cited-passage-changed", "passage", "passage", "uncertain"],
];
const results = [];
try {
  for (const [id, change, reference, expected] of cases) {
    mode = "none";
    const run = await new BrowserAgentRuntime().run({
      task: "Find the link to the list of people involved in the project.",
      findUrl: origin + "/",
      maxSteps: 3,
      headless: true,
      profileDir: path.join(profiles, id),
      logDir: path.join(execution, id),
      permissions: { origins: [origin], allowLoopback: true, timeoutMs: 30000 },
      // A scripted planner isolates the freshness rule; it is not a relevance evaluation.
      planner: {
        name: "scripted-freshness",
        model: "contract-only",
        async plan({ observation }) {
          const link = observation.interactiveElements.find(
            (node) => node.name === "People",
          );
          const passage = observation.passages.find(
            (item) => item.text === "The project team page lists contributors.",
          );
          assert.ok(link?.number && passage);
          mode = change;
          await delay(400);
          const match =
            reference === "target"
              ? {
                  snapshotId: observation.snapshotId,
                  target: link.number,
                  reason: "People link",
                }
              : {
                  snapshotId: observation.snapshotId,
                  passageId: passage.id,
                  reason: "Team passage",
                };
          return {
            type: "finish",
            answer: "People",
            pageFind: { outcome: "matches", confidence: 1, matches: [match] },
          };
        },
      },
    });
    results.push({
      id,
      change,
      reference,
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
  id: result.id,
  role: result.expected === "done" ? "completes" : "must-refuse",
  passed: result.status === result.expected,
  status: result.status,
  error: result.error,
}));
const report = { suite: "live-01-find-freshness", built, checks };
await writeFile(
  path.join(execution, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
assert.ok(checks.every((check) => check.passed));
