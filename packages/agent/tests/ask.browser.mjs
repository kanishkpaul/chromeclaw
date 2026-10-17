import process from "node:process";
import console from "node:console";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { build } from "tsup";
const built = process.argv.includes("--built");
const { BrowserAgentRuntime, openCapturedSource, JsonlRunStore } = await import(
  built ? "../dist/index.js" : "../src/index.ts"
);

const actual = process.argv.includes("--actual-local");
const output = path.resolve(
  actual ? ".chromeclaw/phase5-ask-local" : ".chromeclaw/phase5-ask",
);
await mkdir(output, { recursive: true });
const execution = await mkdtemp(path.join(output, "attempt-"));
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-ask-"));
const cases = JSON.parse(
  await readFile(new URL("./fixtures/ask.json", import.meta.url), "utf8"),
);
await build({
  entry: [fileURLToPath(new URL("./fixtures/react.jsx", import.meta.url))],
  format: ["iife"],
  outDir: path.join(execution, "assets"),
  dts: false,
  minify: true,
  silent: true,
  noExternal: [/.*/],
  define: { "process.env.NODE_ENV": '"production"' },
});
const react = await readFile(path.join(execution, "assets/react.global.js"));
const results = [],
  checks = [];
let endpoint,
  modelRequests = 0,
  saves = 0,
  sourceReads = 0;
const foreign = createServer((_request, response) =>
  response.end("<p>FOREIGN_PRIVATE_MARKER</p>"),
);
await new Promise((resolve) => foreign.listen(0, "127.0.0.1", resolve));
const foreignOrigin = `http://127.0.0.1:${foreign.address().port}`;
const pageBlock = (prompt) =>
  JSON.parse(
    prompt
      .match(/<untrusted provenance="page">\n([\s\S]*?)\n<\/untrusted>/)[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"),
  );
const server = createServer((request, response) => {
  if (request.url === "/react.js") {
    response.setHeader("content-type", "text/javascript");
    response.end(react);
    return;
  }
  if (request.url === "/saved") {
    saves++;
    response.end("Unexpected write");
    return;
  }
  if (!request.url.endsWith("/chat/completions")) {
    sourceReads++;
    const fixture = cases.find(
      (fixture) => request.url === `/case/${fixture.id}`,
    );
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(
      fixture
        ? `<title>Controlled reading fixture</title>${fixture.html.replace("FOREIGN_FRAME", `${foreignOrigin}/private`)}`
        : "<p>Blank fixture</p>",
    );
    return;
  }
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    modelRequests++;
    const payload = JSON.parse(body),
      page = pageBlock(payload.messages[1].content);
    const task = JSON.parse(
      payload.messages[1].content
        .split("Trusted user task: ")[1]
        .split("\n")[0],
    );
    const fixture = cases.find((fixture) => task.startsWith(fixture.question));
    const variant = request.url.split("/")[1];
    let action;
    if (variant === "illegal-navigation")
      action = { type: "navigate", url: `${endpoint}/other-page` };
    else if (variant === "illegal-write")
      action = {
        type: "type",
        target: 1,
        snapshotId: page.snapshotId,
        text: "NO_WRITE",
      };
    else if (page.url === "about:blank")
      action = { type: "navigate", url: `${endpoint}/case/${fixture.id}` };
    else {
      const passage = page.passages?.find(
        (passage) => passage.text === fixture.answer,
      );
      action = passage
        ? {
            type: "finish",
            answer: fixture.answer,
            evidence: [
              {
                snapshotId: page.snapshotId,
                passageId: variant === "bad-citation" ? "invented" : passage.id,
                quote: fixture.answer,
              },
            ],
          }
        : {
            type: "ask_user",
            question: "This answer is not readable. Please inspect Chrome.",
          };
    }
    if (payload.stream) {
      response.setHeader("content-type", "text/event-stream");
      const text = JSON.stringify(action);
      for (let index = 0; index < text.length; index += 25)
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(index, index + 25) }, finish_reason: null }] })}\n\n`,
        );
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 8, completion_tokens: 8 } })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
    } else
      response.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(action) } }],
          usage: { prompt_tokens: 8, completion_tokens: 8 },
        }),
      );
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
endpoint = `http://127.0.0.1:${server.address().port}`;
const modelUrl = actual
  ? process.env.CHROMECLAW_TEST_LOCAL_URL
  : `${endpoint}/normal/v1`;
const model = actual
  ? process.env.CHROMECLAW_TEST_LOCAL_MODEL
  : "synthetic-ask-model";
if (!modelUrl || !model)
  throw new Error(
    "Actual local acceptance requires an explicit local endpoint and model.",
  );
const baseOptions = (fixture, suffix = "") => ({
  task: `${fixture.question} Return the exact complete sentence with its captured passage citation; hand back if the requested content is unreadable.`,
  askUrl: `${endpoint}/case/${fixture.id}`,
  provider: "local",
  model,
  baseUrl: modelUrl,
  stream: true,
  responseFormat: actual ? "llama-schema" : "json",
  maxOutputTokens: 512,
  requestTimeoutMs: actual ? 90000 : 5000,
  maxSteps: 8,
  headless: true,
  profileDir: path.join(profiles, fixture.id + suffix),
  logDir: path.join(execution, fixture.id + suffix),
  permissions: {
    origins: [endpoint, foreignOrigin],
    allowLoopback: true,
    timeoutMs: 300000,
    write: true,
    irreversible: "confirm",
  },
});
try {
  for (const fixture of cases) {
    let receivedBytes = 0;
    const options = baseOptions(fixture);
    const run = await new BrowserAgentRuntime().run({
      ...options,
      onProgress: (progress) => (receivedBytes = progress.receivedBytes),
    });
    const expected = fixture.answer === null ? "awaiting-answer" : "done";
    const passed =
      run.status === expected &&
      (fixture.answer === null || run.finalAnswer === fixture.answer);
    results.push({
      id: fixture.id,
      expected,
      status: run.status,
      passed,
      answerCorrect:
        fixture.answer === null ? null : run.finalAnswer === fixture.answer,
      runId: run.id,
      relativeLog: `${fixture.id}/${run.id}.jsonl`,
      receivedBytes,
      error: run.error ?? null,
    });
    assert.equal(run.permissions.write, false);
    assert.ok(!run.permissions.tools.includes("type"));
    const text = await readFile(
      path.join(options.logDir, `${run.id}.jsonl`),
      "utf8",
    );
    assert.ok(
      !text.includes("NEVER_CAPTURE_SECRET") &&
        !text.includes("FOREIGN_PRIVATE_MARKER"),
    );
    if (fixture.answer !== null && passed) {
      const finish = run.steps.at(-1).action;
      assert.ok(finish.evidence.every((reference) => reference.passageId));
    }
  }
  if (!actual) {
    const fixture = cases[0];
    for (const variant of [
      "bad-citation",
      "illegal-write",
      "illegal-navigation",
    ]) {
      const options = baseOptions(fixture, variant);
      const run = await new BrowserAgentRuntime().run({
        ...options,
        baseUrl: `${endpoint}/${variant}/v1`,
      });
      assert.equal(
        run.status,
        variant === "bad-citation" ? "uncertain" : "blocked",
      );
      checks.push({
        id: variant,
        passed: true,
        runId: run.id,
        relativeLog: `${fixture.id + variant}/${run.id}.jsonl`,
      });
    }
    const first = results[0];
    const stored = await new JsonlRunStore(
      path.join(execution, first.id),
    ).readRun(first.runId);
    const citation = stored.steps.at(-1).action.evidence[0];
    const before = sourceReads;
    const opened = await openCapturedSource(first.runId, citation.passageId, {
      logDir: path.join(execution, first.id),
      profileDir: path.join(profiles, "source-display"),
      headless: true,
    });
    assert.ok(opened.ok, opened.reason);
    await opened.close();
    assert.ok(sourceReads > before);
    assert.equal(
      (
        await new JsonlRunStore(path.join(execution, first.id)).readRun(
          first.runId,
        )
      ).status,
      "done",
    );
    const refused = await openCapturedSource(first.runId, "fabricated", {
      logDir: path.join(execution, first.id),
    });
    assert.equal(refused.ok, false);
    const clock = Date.now;
    const requestsBeforeExpiry = sourceReads;
    try {
      Date.now = () => stored.permissions.expiresAt;
      const expired = await openCapturedSource(
        first.runId,
        citation.passageId,
        { logDir: path.join(execution, first.id), headless: true },
      );
      assert.equal(expired.ok, false);
      assert.equal(sourceReads, requestsBeforeExpiry);
    } finally {
      Date.now = clock;
    }
    checks.push({
      id: "expired-source-permissions-refuse-before-browser-request",
      passed: true,
    });
    checks.push({
      id: "explicit-cited-source-opens-under-original-permissions-without-changing-completion",
      passed: true,
    });
  }
  assert.equal(saves, 0);
  const report = {
    suite: actual ? "phase5-ask-actual-local" : "phase5-ask-controlled",
    evidenceDir: path.basename(execution),
    actualLocal: actual,
    model,
    endpoint: modelUrl,
    implementation: built ? "built" : "source",
    fixtureCount: cases.length,
    passed: results.filter((result) => result.passed).length,
    results,
    checks,
    modelRequests,
    unsafeWrites: saves,
    limitations: [
      "Exact extractive support, not general semantic entailment.",
      "Hosted inference excluded by owner.",
      "Only currently rendered visible text; canvas/foreign frames hand back.",
    ],
  };
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  assert.equal(
    report.passed,
    20,
    JSON.stringify(results.filter((result) => !result.passed)),
  );
} finally {
  server.closeAllConnections();
  foreign.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => foreign.close(resolve)),
  ]);
  await rm(profiles, { recursive: true, force: true });
}
