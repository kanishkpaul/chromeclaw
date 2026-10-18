import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import console from "node:console";
import { URL } from "node:url";
import {
  BrowserAgentRuntime,
  JsonlRunStore,
  OpenAICompatiblePlanner,
} from "../dist/index.js";

// The loopback adapter seam emulates a hosted wire; no production hosted endpoint is used.
const bytes = await readFile(
  new URL("./fixtures/live-stage5.json", import.meta.url),
);
const fixture = JSON.parse(bytes);
const output = path.resolve(".chromeclaw/phase8-byok");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(path.join(output, "attempt-"));
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-byok-"));
const dummyKey = "DUMMY-STAGE5-KEY";
const requests = [],
  results = [],
  serverErrors = [];
let current, runtime, logFile;
const decodePage = (prompt) =>
  JSON.parse(
    prompt
      .match(/<untrusted provenance="page">\n([\s\S]*?)\n<\/untrusted>/)[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"),
  );
const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", async () => {
    try {
      const payload = JSON.parse(body);
      const count =
        requests.filter((item) => item.caseId === current.id).length + 1;
      assert.equal(request.headers.authorization, `Bearer ${dummyKey}`);
      assert.equal(request.url, "/v1/chat/completions");
      assert.equal(payload.model, "dummy-stage5");
      assert.equal(payload.max_completion_tokens ?? payload.max_tokens, 64);
      const hash = createHash("sha256").update(body).digest("hex");
      const durable = (await readFile(logFile, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const crossings = durable.filter((event) => event.type === "crossing");
      assert.equal(
        crossings.length,
        count,
        "Every send must have its own durable reservation.",
      );
      assert.equal(crossings.at(-1).payload.payloadHash, hash);
      requests.push({
        caseId: current.id,
        attempt: count,
        path: request.url,
        stream: payload.stream,
        outputLimit: 64,
        tokenLimitField:
          payload.max_completion_tokens === undefined
            ? "max_tokens"
            : "max_completion_tokens",
        authorization: "dummy-only",
        payloadHash: hash,
        durableBeforeReceipt: true,
      });
      const page = decodePage(payload.messages[1].content);
      const passage = page.passages.find(
        (item) => item.text === fixture.expected,
      );
      assert.ok(
        passage,
        "Frozen live public passage must exist before fault injection.",
      );
      const action = {
        type: "finish",
        answer: passage.text,
        evidence: [
          {
            snapshotId: page.snapshotId,
            passageId: passage.id,
            quote: passage.text,
          },
        ],
      };
      if (current.id === "timeout") return;
      if (
        ["retry-503", "retry-budget"].includes(current.id) ||
        (current.id === "retry-429" && count === 1)
      ) {
        response.writeHead(current.id === "retry-429" ? 429 : 503).end();
        return;
      }
      if (current.id === "auth-401") {
        response.writeHead(401).end("dummy authentication refused");
        return;
      }
      const content =
        current.id === "invalid-action" ||
        (current.id === "repair-action" && count === 1)
          ? "not a JSON action"
          : current.id === "credential-echo"
            ? dummyKey
            : JSON.stringify(action);
      const usage =
        current.id === "missing-usage"
          ? undefined
          : {
              prompt_tokens: 100,
              completion_tokens:
                current.id === "negative-usage"
                  ? -1
                  : current.id === "over-limit-usage"
                    ? 65
                    : 8,
            };
      const finish =
        current.id === "repair-truncation" && count === 1 ? "length" : "stop";
      if (payload.stream) {
        response.writeHead(200, { "content-type": "text/event-stream" });
        const frame = (value) =>
          response.write(`data: ${JSON.stringify(value)}\n\n`);
        // Split a valid proposal: partial content must never reach the dispatcher.
        const split = Math.floor(content.length / 2);
        frame({
          choices: [
            {
              delta: { content: content.slice(0, split) },
              finish_reason: null,
            },
          ],
        });
        if (current.id === "cancel-sse") return;
        frame({
          choices: [
            { delta: { content: content.slice(split) }, finish_reason: finish },
          ],
        });
        if (usage) frame({ choices: [], usage });
        response.end(current.id === "incomplete-sse" ? "" : "data: [DONE]\n\n");
      } else {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify(
            current.id === "repair-envelope" && count === 1
              ? { choices: [] }
              : {
                  choices: [{ message: { content }, finish_reason: finish }],
                  ...(usage ? { usage } : {}),
                },
          ),
        );
      }
    } catch (error) {
      serverErrors.push({ caseId: current.id, error: String(error) });
      response.writeHead(500).end("Emulator assertion failed.");
    }
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const endpoint = `http://127.0.0.1:${server.address().port}/v1`;
try {
  for (const item of fixture.cases) {
    current = item;
    runtime = new BrowserAgentRuntime();
    const events = [],
      progress = [],
      started = Date.now();
    const logDir = path.join(execution, item.id);
    try {
      const run = await runtime.run({
        task: fixture.task,
        askUrl: fixture.url,
        maxSteps: 5,
        headless: false,
        profileDir: path.join(profiles, item.id),
        logDir,
        permissions: {
          origins: ["https://httpbin.org"],
          write: false,
          irreversible: "deny",
          maxCost: item.id === "retry-budget" ? fixture.requestCost : 0.02,
          timeoutMs: 30000,
        },
        planner: new OpenAICompatiblePlanner({
          model: "dummy-stage5",
          apiKey: dummyKey,
          providerName: "emulated-byok",
          baseUrl: endpoint,
          mode: "hosted",
          requestCost: fixture.requestCost,
          maxOutputTokens: 64,
          timeoutMs: item.id === "timeout" ? 500 : 5000,
          tokenLimitField:
            item.id === "valid-sse" ? "max_completion_tokens" : "max_tokens",
          stream: item.id.endsWith("sse"),
        }),
        approve: async () => false,
        onEvent: (event) => {
          events.push(event);
          if (event.type === "run_started")
            logFile = path.join(logDir, `${event.runId}.jsonl`);
        },
        onProgress: (update) => {
          progress.push(update);
          if (item.id === "cancel-sse") runtime.cancel();
        },
      });
      const sent = requests.filter((request) => request.caseId === item.id);
      const crossings = events.filter((event) => event.type === "crossing");
      const usage = events
        .filter((event) => event.type === "model_usage")
        .map((event) => event.payload);
      assert.equal(run.status, item.status, run.error);
      assert.equal(sent.length, item.requests);
      assert.equal(crossings.length, item.requests);
      assert.equal(run.reservedCost, fixture.requestCost * item.requests);
      assert.equal(
        (await new JsonlRunStore(logDir).readRun(run.id)).reservedCost,
        run.reservedCost,
      );
      assert.ok(
        crossings.every(
          (event) =>
            event.payload.destination === endpoint + "/chat/completions",
        ),
      );
      assert.ok(
        !events.some(
          (event) =>
            event.type === "act_started" &&
            event.payload.action.type !== "navigate",
        ),
      );
      if (item.status === "done")
        assert.equal(run.finalAnswer, fixture.expected);
      if (item.id === "missing-usage")
        assert.deepEqual(usage, [
          { promptTokens: null, completionTokens: null },
        ]);
      if (["negative-usage", "over-limit-usage"].includes(item.id))
        assert.equal(usage.length, 0);
      if (item.id === "valid-json" || item.id === "valid-sse")
        assert.deepEqual(usage, [{ promptTokens: 100, completionTokens: 8 }]);
      if (["incomplete-sse", "cancel-sse", "credential-echo"].includes(item.id))
        assert.ok(!events.some((event) => event.type === "proposal"));
      if (item.id.endsWith("sse")) assert.ok(progress.length > 0);
      const trace = await readFile(logFile, "utf8");
      assert.ok(
        !trace.includes(dummyKey),
        "Provider key must not reach the trace.",
      );
      assert.ok(!serverErrors.some((error) => error.caseId === item.id));
      results.push({
        id: item.id,
        passed: true,
        status: run.status,
        error: run.error,
        warnings: run.warnings,
        requests: sent.length,
        reservedCost: run.reservedCost,
        usage,
        progressUpdates: progress.length,
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      results.push({
        id: item.id,
        passed: false,
        error: String(error),
        latencyMs: Date.now() - started,
      });
    }
    await writeFile(
      path.join(execution, "report.json"),
      JSON.stringify(
        {
          suite: "live-01-stage5",
          actualInference: false,
          hostedSpend: 0,
          lane: "dummy hosted wire via explicit loopback adapter seam; actual public read",
          fixtureSha256: createHash("sha256").update(bytes).digest("hex"),
          endpoint,
          results,
          requests,
          serverErrors,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
}
console.log(execution);
assert.equal(results.length, fixture.cases.length);
assert.ok(
  results.every((result) => result.passed),
  "Inspect preserved BYOK protocol report.",
);
