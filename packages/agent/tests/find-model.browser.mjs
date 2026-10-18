import { URL } from "node:url";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import { tmpdir } from "node:os";
const built = process.argv.includes("--built"), actual = process.argv.includes("--actual-local"), dev = process.argv.includes("--dev");
const { BrowserAgentRuntime } = await import(built ? "../dist/index.js" : "../src/index.ts");
const all = JSON.parse(await readFile(new URL("./fixtures/find.json", import.meta.url), "utf8"));
const selected = process.argv.find((arg) => arg.startsWith("--cases="))?.slice(8).split(",");
const cases = selected ? all.filter((fixture) => selected.includes(fixture.id)) : dev ? all.filter((fixture) => fixture.split === "dev") : all;
const output = path.resolve(actual ? ".chromeclaw/phase6-find-local" : ".chromeclaw/phase6-find-labelled");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(path.join(output, dev ? "dev-" : built ? "built-" : "source-"));
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-find-model-"));
const results = [];
let writes = 0;
const server = createServer((request, response) => {
  if (request.method !== "GET") writes++;
  response.setHeader("content-type", "text/html; charset=utf-8");
  const fixture = all.find((fixture) => request.url === `/case/${fixture.id}`);
  response.end(`<!doctype html><title>Labelled find task</title>${fixture?.html ?? "Not found"}`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
if (actual && (!process.env.CHROMECLAW_TEST_LOCAL_URL || !process.env.CHROMECLAW_TEST_LOCAL_MODEL)) throw new Error("Local acceptance needs explicit endpoint and model; no fallback.");
try {
  for (const fixture of cases) {
    const started = Date.now();
    const run = await new BrowserAgentRuntime().run({
      task: fixture.question, findUrl: origin + `/case/${fixture.id}`, provider: "local", model: process.env.CHROMECLAW_TEST_LOCAL_MODEL,
      baseUrl: process.env.CHROMECLAW_TEST_LOCAL_URL, responseFormat: "llama-schema", maxOutputTokens: 768, requestTimeoutMs: 90000,
      maxSteps: 4, headless: true, profileDir: path.join(profiles, fixture.id), logDir: path.join(execution, fixture.id),
      permissions: { origins: [origin], allowLoopback: true, write: false, timeoutMs: 300000 },
      ...(!actual ? { planner: { name: "scripted-label-oracle", model: "plumbing-only", async plan({ observation }) {
        if (fixture.clarify) return { type: "ask_user", question: "Which address?" };
        if (fixture.none) return { type: "finish", answer: "No match", pageFind: { outcome: "no-match", reason: "Not visible" } };
        const matches = fixture.targets ? fixture.targets.map((target) => ({ snapshotId: observation.snapshotId, target, reason: "Fixture candidate" })) : [{ snapshotId: observation.snapshotId, passageId: observation.passages.find((passage) => passage.text === fixture.passage)?.id ?? "missing", reason: "Fixture passage" }];
        return { type: "finish", answer: "Candidates", pageFind: { outcome: "matches", confidence: 1, matches } };
      } } } : {}),
    });
    const finish = [...run.steps].reverse().find((step) => step.action?.type === "finish");
    const result = finish?.action.pageFind;
    const matches = run.status === "done" && result?.outcome === "matches" ? result.matches : [];
    const isCorrect = (match) => fixture.targets ? "target" in match && fixture.targets.includes(match.target) : "passageId" in match && finish.observation.passages.some((passage) => passage.id === match.passageId && passage.text === fixture.passage);
    const top1 = matches.length > 0 && isCorrect(matches[0]);
    const top3 = matches.some(isCorrect);
    const handback = run.status === "awaiting-answer" || run.status === "uncertain" && (result?.outcome === "no-match" || result?.outcome === "matches" && (result.confidence < 0.98 || run.error?.startsWith("Several controls share")));
    const passed = fixture.none || fixture.clarify ? handback && matches.length === 0 : top3;
    assert.equal(run.permissions.write, false);
    results.push({ id: fixture.id, split: fixture.split, passed, status: run.status, expected: fixture.targets ?? fixture.passage ?? (fixture.clarify ? "clarify" : "none"), top1: fixture.none || fixture.clarify ? null : top1, top3: fixture.none || fixture.clarify ? null : top3, noMatchError: fixture.none || fixture.clarify ? !handback || matches.length > 0 : matches.length === 0, confidence: result?.outcome === "matches" ? result.confidence : null, latencyMs: Date.now() - started, runId: run.id, log: `${fixture.id}/${run.id}.jsonl` });
    console.error(`${fixture.id}: ${passed ? "pass" : "miss"} ${run.status}`);
  }
  assert.equal(writes, 0);
} finally {
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
  const positives = results.filter((r) => r.top1 !== null), negatives = results.filter((r) => r.top1 === null);
  const report = { suite: "phase6-find-labelled", actual, built, dev, model: actual ? process.env.CHROMECLAW_TEST_LOCAL_MODEL : "scripted-plumbing-only", threshold: 0.98, fixtures: results.length, passed: results.filter((r) => r.passed).length, top1: { correct: positives.filter((r) => r.top1).length, total: positives.length }, top3: { correct: positives.filter((r) => r.top3).length, total: positives.length }, noMatch: { errors: negatives.filter((r) => r.noMatchError).length, total: negatives.length }, falseNoMatch: positives.filter((r) => r.noMatchError).length, writes, execution: path.basename(execution), results };
  await writeFile(path.join(execution, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  // Model misses remain measured failures, not a process success hidden by the scorer.
  if (results.length !== cases.length || results.some((r) => !r.passed)) process.exitCode = 1;
}
