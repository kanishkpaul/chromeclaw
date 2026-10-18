import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import { setTimeout as delay } from "node:timers/promises";
const built = process.argv.includes("--built");
const { BrowserAgentRuntime } = await import(built ? "../dist/index.js" : "../src/index.ts");
const output = path.resolve(".chromeclaw/phase6-find");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(path.join(output, built ? "built-" : "source-"));
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-find-"));
let writes = 0, mutate = false, origin;
const checks = [];
const server = createServer((request, response) => {
  if (request.url === "/saved") { writes++; response.end("Unsafe activation"); return; }
  if (request.url === "/state") { response.end(String(mutate)); return; }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><title>Find fixture</title>
<p>Delivery takes two days.</p><form action=/saved method=post>
<button type=submit aria-label="Delivery">Ship</button><button type=button aria-label="Delivery">Collect</button>
<label>Password<input type=password value=NEVER_CAPTURE_FIND_SECRET></label></form>
<button hidden>Hidden target</button><button style="margin-top:2000px">Offscreen target</button>
<script>setInterval(async () => { if ((await (await fetch('/state')).text()) === 'true') document.querySelector('p').textContent = 'Changed result'; }, 50)</script>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const id of ["target", "passage", "mixed", "duplicates", "invented", "credential", "stale", "no-match", "clarify", "click", "type", "navigate", "scroll"]) {
    mutate = false;
    const logDir = path.join(execution, id);
    const run = await new BrowserAgentRuntime().run({
      task: "Find the FIRST delivery control where delivery is arranged; do not activate anything.", findUrl: origin + "/page",
      maxSteps: 4, headless: true, profileDir: path.join(profiles, id), logDir,
      permissions: { origins: [origin], write: true, irreversible: "confirm", allowLoopback: true, timeoutMs: 30000 },
      // A synthetic planner exercises runtime contracts. It is not a relevance/model-quality eval.
      planner: { name: "scripted-find", model: "contract-only", async plan({ observation }) {
        assert.equal(observation.url, origin + "/page");
        const targets = observation.interactiveElements;
        const ship = targets.find((node) => node.name === "Delivery");
        assert.ok(ship && ship.number);
        assert.equal(targets.filter((node) => node.name === "Delivery").length, 2);
        assert.ok(!targets.some((node) => node.name === "Hidden target" || node.name === "Offscreen target"));
        const target = { snapshotId: observation.snapshotId, target: ship.number, reason: "Delivery control" };
        const passage = { snapshotId: observation.snapshotId, passageId: observation.passages.find((p) => p.text === "Delivery takes two days.").id, reason: "Delivery timing" };
        if (id === "click" || id === "type") return { type: id, snapshotId: observation.snapshotId, target: ship.number, ...(id === "type" ? { text: "Unsafe" } : {}) };
        if (id === "navigate") return { type: "navigate", url: origin + "/elsewhere" };
        if (id === "scroll") return { type: "scroll", direction: "down", amount: 700 };
        if (id === "clarify") return { type: "ask_user", question: "Delivery or collection?" };
        if (id === "no-match") return { type: "finish", answer: "No match", pageFind: { outcome: "no-match", reason: "Not in captured viewport" } };
        if (id === "stale") { mutate = true; await delay(500); }
        const matches = id === "mixed" ? [target, passage] : id === "passage" || id === "stale" ? [passage] : id === "duplicates" ? [target, target] : id === "invented" ? [{ ...target, target: 999 }] : id === "credential" ? [{ ...target, target: targets.find((node) => node.isCredential).number }] : [target];
        return { type: "finish", answer: "Delivery candidates", pageFind: { outcome: "matches", confidence: 1, matches } };
      } },
      verify: async () => ({ passed: true, detail: "Cannot override find validation" }),
    });
    const expected = ["target", "passage", "mixed"].includes(id) ? "done" : id === "clarify" ? "awaiting-answer" : ["click", "type", "navigate", "scroll"].includes(id) ? "blocked" : "uncertain";
    assert.equal(run.status, expected, `${id}: ${run.error}`);
    assert.equal(run.permissions.write, false);
    assert.ok(run.steps.every((step) => !step.observation?.backUrl && !step.observation?.tabs));
    assert.ok(!run.permissions.tools.some((tool) => ["click", "type", "press", "scroll"].includes(tool)));
    if (id === "target") {
      const reopened = await new BrowserAgentRuntime().reopen(run.id, {
        logDir, headless: true, profileDir: path.join(profiles, "reopen"),
        findUrl: origin + "/elsewhere", askUrl: origin + "/elsewhere",
        permissions: { write: true },
        planner: { name: "scripted-find", model: "contract-only", async plan() { throw new Error("Reopen must pause before inference"); } },
      });
      assert.equal(reopened.status, "paused");
      assert.equal(reopened.findUrl, origin + "/page");
      assert.equal(reopened.permissions.write, false);
      checks.push({ id: "reopen-retains-mode-and-pauses", passed: true, runId: reopened.id, log: `${id}/${reopened.id}.jsonl` });
    }
    const raw = await readFile(path.join(logDir, run.id + ".jsonl"), "utf8");
    assert.ok(!raw.includes("NEVER_CAPTURE_FIND_SECRET"));
    checks.push({ id, passed: true, expected, status: run.status, runId: run.id, log: `${id}/${run.id}.jsonl` });
  }
  assert.equal(writes, 0);
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
  const report = { suite: "phase6-find-contract", built, planner: "scripted-contract-only", actualModel: false, writes, checks, execution: path.basename(execution) };
  await writeFile(path.join(execution, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
