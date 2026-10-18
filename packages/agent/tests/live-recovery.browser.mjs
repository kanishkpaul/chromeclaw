import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import { BrowserAgentRuntime, OpenAICompatiblePlanner } from "../dist/index.js";

const bytes = await readFile(
  new URL("./fixtures/live-stage4.json", import.meta.url),
);
const fixture = JSON.parse(bytes);
const actual = process.argv.includes("--actual-local");
if (!actual && process.env.CHROMECLAW_TEST_LOCAL_URL)
  throw new Error(
    "Local endpoint supplied without --actual-local; choose the lane explicitly.",
  );
if (
  actual &&
  (!process.env.CHROMECLAW_TEST_LOCAL_URL ||
    !process.env.CHROMECLAW_TEST_LOCAL_MODEL)
)
  throw new Error(
    "Explicit cached local endpoint/model required; no fallback.",
  );
const output = path.resolve(".chromeclaw/phase8-recovery");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, actual ? "local-" : "dummy-"),
);
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-recovery-"));
const results = [],
  requests = [];
let current,
  typed = false;
const decode = (prompt, name) =>
  JSON.parse(
    prompt
      .match(
        new RegExp(
          `<untrusted provenance="${name}">\\n([\\s\\S]*?)\\n<\\/untrusted>`,
        ),
      )[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"),
  );
const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    try {
      assert.equal(request.headers.authorization, "Bearer DUMMY-RECOVERY-KEY");
      assert.equal(request.url, "/v1/chat/completions");
      const payload = JSON.parse(body),
        prompt = payload.messages[1].content;
      const page = decode(prompt, "page");
      const offered = decode(prompt, "offered-targets");
      requests.push({
        caseId: current,
        model: payload.model,
        authorization: "dummy-only",
      });
      const passage = page.passages?.find(
        (item) => item.text === fixture.read.expected,
      );
      const field = offered.targets.find((item) =>
        item.name?.startsWith("Customer name"),
      );
      const action =
        current === fixture.cases[3]
          ? page.url === "about:blank"
            ? { type: "navigate", url: fixture.edit.url }
            : typed
              ? {
                  type: "ask_user",
                  question:
                    "Inspect the synthetic unsent field before suspending.",
                }
              : ((typed = true),
                {
                  type: "type",
                  snapshotId: page.snapshotId,
                  target: field.number,
                  text: fixture.edit.value,
                })
          : passage
            ? {
                type: "finish",
                answer: passage.text,
                evidence: [
                  {
                    snapshotId: page.snapshotId,
                    passageId: passage.id,
                    quote: passage.text,
                  },
                ],
              }
            : { type: "fail", reason: "Frozen public passage unavailable." };
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(action) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      );
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error));
    }
  });
});
if (!actual)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  for (const id of actual ? fixture.localCases : fixture.cases) {
    current = id;
    typed = false;
    const started = Date.now(),
      events = [];
    const edit = id === fixture.cases[3],
      exhausted = id === fixture.cases[2];
    const runtime = new BrowserAgentRuntime();
    const options = {
      task: edit ? fixture.edit.task : fixture.read.task,
      ...(!edit ? { askUrl: fixture.read.url } : {}),
      provider: "local",
      model: process.env.CHROMECLAW_TEST_LOCAL_MODEL,
      baseUrl: process.env.CHROMECLAW_TEST_LOCAL_URL,
      responseFormat: "llama-schema",
      maxOutputTokens: 1200,
      requestTimeoutMs: 90000,
      maxSteps: 8,
      headless: false,
      profileDir: path.join(profiles, id),
      logDir: path.join(execution, id),
      permissions: {
        origins: ["https://httpbin.org"],
        write: edit,
        irreversible: "deny",
        tools: ["navigate", "type", "finish", "ask_user", "fail"],
        maxCost: actual ? 0 : exhausted ? 0.001 : 0.02,
        timeoutMs: 300000,
      },
      ...(!actual
        ? {
            planner: new OpenAICompatiblePlanner({
              model: "dummy-recovery",
              apiKey: "DUMMY-RECOVERY-KEY",
              baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
              providerName: "emulated-byok",
              mode: "hosted",
              requestCost: 0.001,
              timeoutMs: 10000,
            }),
          }
        : {}),
      approve: async () => false,
      ...(edit
        ? {
            answer: async (_question, session) => {
              assert.equal(
                await session.page
                  .locator('input[name="custname"]')
                  .inputValue(),
                fixture.edit.value,
              );
              assert.equal(session.page.url(), fixture.edit.url);
              await session.page.screenshot({
                path: path.join(execution, id, "unsent-form.png"),
                mask: [session.page.locator("input,textarea,select")],
              });
              runtime.pause();
              return "Synthetic value independently checked; pause without submitting.";
            },
          }
        : {}),
    };
    const record = (event) => events.push(event);
    try {
      let interrupted = false;
      const first = await runtime.run({
        ...options,
        onEvent: (event) => {
          record(event);
          if (!edit && !interrupted && event.type === "proposal") {
            interrupted = true;
            if (id === fixture.cases[1]) runtime.cancel();
            else runtime.pause();
          }
        },
        onStep: (step) => {
          if (edit && step.action?.type === "type") {
            interrupted = true;
          }
        },
      });
      assert.ok(interrupted, "The interruption checkpoint must be reached.");
      assert.equal(
        first.status,
        id === fixture.cases[1] ? "stopped" : "paused",
      );
      const firstActs = events.filter((event) => event.type === "act_started");
      assert.equal(
        firstActs.filter((event) => event.payload.action.type === "type")
          .length,
        edit ? 1 : 0,
      );
      const before = events.length;
      const suspended = await new BrowserAgentRuntime().reopen(first.id, {
        ...options,
        permissions: {
          origins: ["https://example.com"],
          write: true,
          maxCost: 99,
          timeoutMs: 600000,
        },
        maxSteps: 99,
        onEvent: record,
      });
      assert.equal(suspended.status, "paused");
      assert.deepEqual(suspended.permissions, first.permissions);
      assert.equal(suspended.maxSteps, first.maxSteps);
      assert.equal(suspended.reservedCost, first.reservedCost);
      assert.ok(
        !events
          .slice(before)
          .some((event) =>
            ["crossing", "proposal", "act_started"].includes(event.type),
          ),
      );
      assert.notEqual(suspended.pending.id, first.pending?.id);
      if (!edit) {
        const resumed = new BrowserAgentRuntime();
        let replies = 0;
        const last = await resumed.reopen(first.id, {
          ...options,
          interactive: true,
          onEvent: record,
          onState: (state) => {
            if (state.pending?.kind !== "pause") return;
            assert.equal(
              resumed.respond({
                runId: state.id,
                pendingId: first.pending?.id ?? "stale",
                kind: "pause",
              }),
              false,
            );
            const reply = {
              runId: state.id,
              pendingId: state.pending.id,
              kind: "pause",
            };
            assert.equal(resumed.respond(reply), true);
            assert.equal(resumed.respond(reply), false);
            replies++;
          },
        });
        assert.equal(replies, 1);
        assert.deepEqual(last.permissions, first.permissions);
        if (exhausted) {
          assert.equal(last.status, "failed");
          assert.equal(last.reservedCost, first.reservedCost);
          assert.equal(
            requests.filter((request) => request.caseId === id).length,
            1,
          );
        } else {
          assert.equal(last.status, "done");
          assert.equal(last.finalAnswer, fixture.read.expected);
        }
        results.push({
          id,
          passed: true,
          initial: first.status,
          reopened: suspended.status,
          resumed: last.status,
          reservedCost: last.reservedCost,
          warnings: last.warnings,
          latencyMs: Date.now() - started,
        });
      } else {
        // Reopening deliberately reloads the page. It must not restore an unsaved field by replay.
        assert.equal(
          events.filter(
            (event) =>
              event.type === "act_started" &&
              event.payload.action.type === "type",
          ).length,
          1,
        );
        results.push({
          id,
          passed: true,
          initial: first.status,
          reopened: suspended.status,
          independentUnsentValueChecked: true,
          replayedTypeActions: 0,
          latencyMs: Date.now() - started,
        });
      }
    } catch (error) {
      results.push({
        id,
        passed: false,
        error: String(error),
        latencyMs: Date.now() - started,
      });
    }
    await writeFile(
      path.join(execution, "report.json"),
      JSON.stringify(
        {
          suite: "live-01-stage4",
          actualLocal: actual,
          hostedInference: false,
          fixtureSha256: createHash("sha256").update(bytes).digest("hex"),
          model: actual
            ? process.env.CHROMECLAW_TEST_LOCAL_MODEL
            : "dummy-recovery",
          results,
          requests,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  server.closeAllConnections();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
}
console.log(execution);
assert.ok(
  results.length && results.every((result) => result.passed),
  "Inspect preserved recovery report.",
);
