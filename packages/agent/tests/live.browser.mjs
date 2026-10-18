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

// Frozen labels select mock replies only. Actual inference never receives those labels.
const day2 = process.argv.includes("--day2");
assert.ok(
  !(day2 && process.argv.includes("--followup")),
  "Choose one manifest.",
);
const fixtureBytes = await readFile(
  new URL(
    day2
      ? "./fixtures/live-day2.json"
      : process.argv.includes("--followup")
        ? "./fixtures/live-day1-followup.json"
        : "./fixtures/live-day1.json",
    import.meta.url,
  ),
);
const fixture = JSON.parse(fixtureBytes);
const actual = process.argv.includes("--actual-local");
if (
  actual &&
  (!process.env.CHROMECLAW_TEST_LOCAL_URL ||
    !process.env.CHROMECLAW_TEST_LOCAL_MODEL)
)
  throw new Error("Explicit local endpoint/model required; no fallback.");
const selected = process.argv
  .find((arg) => arg.startsWith("--cases="))
  ?.slice(8)
  .split(",");
const cases = selected
  ? fixture.cases.filter((item) => selected.includes(item.id))
  : fixture.cases;
assert.ok(cases.length > 0);
const output = path.resolve(".chromeclaw/phase8-live");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, actual ? "local-" : "emulated-byok-"),
);
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-live-"));
const catalog = path.join(profiles, "synthetic-history.json");
await writeFile(
  catalog,
  JSON.stringify({
    version: 1,
    entries: fixture.catalogEntries ?? [
      {
        url: "https://example.com/",
        title: "example domain synthetic bookmark",
        visitedAt: "2026-10-18T08:00:00Z",
        kind: "bookmark",
      },
      {
        url: "https://docs.python.org/3/tutorial/",
        title: "python tutorial synthetic bookmark",
        visitedAt: "2026-10-18T08:00:00Z",
        kind: "bookmark",
      },
    ],
  }),
);
const results = [],
  requests = [];
let current,
  calls = 0,
  typed = false;
const decode = (prompt, block) =>
  JSON.parse(
    prompt
      .match(
        new RegExp(
          `<untrusted provenance="${block}">\\n([\\s\\S]*?)\\n<\\/untrusted>`,
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
      assert.equal(request.headers.authorization, "Bearer DUMMY-LIVE-TEST-KEY");
      assert.equal(request.url, "/v1/chat/completions");
      const payload = JSON.parse(body),
        prompt = payload.messages[1].content;
      const page = decode(prompt, "page"),
        offered = decode(prompt, "offered-targets");
      requests.push({
        caseId: current.id,
        model: payload.model,
        stream: payload.stream,
        outputLimit: payload.max_tokens,
        authorization: "dummy-only",
      });
      calls++;
      let action;
      if (current.mode === "work") {
        const field = offered.targets.find((node) =>
          node.name
            ?.toLowerCase()
            .includes((current.label ?? "Customer name").toLowerCase()),
        );
        action =
          page.url === "about:blank"
            ? { type: "navigate", url: current.url }
            : !typed && field
              ? ((typed = true),
                {
                  type: "type",
                  snapshotId: page.snapshotId,
                  target: field.number,
                  text: current.value,
                })
              : {
                  type: "finish",
                  answer: "Synthetic field edited; form not submitted.",
                };
      } else if (current.mode === "find") {
        const target = offered.targets.find((node) =>
          node.destination?.includes(current.expectedDestination),
        );
        action =
          current.absent || !target
            ? {
                type: "finish",
                answer: "No offered match.",
                pageFind: {
                  outcome: "no-match",
                  reason: "No matching offered control.",
                },
              }
            : {
                type: "finish",
                answer: "Offered candidate.",
                pageFind: {
                  outcome: "matches",
                  confidence: 1,
                  matches: [
                    {
                      snapshotId: page.snapshotId,
                      target: target.number,
                      reason: "Frozen-label mock selection; plumbing only.",
                    },
                  ],
                },
              };
      } else {
        const passage = page.passages?.find((item) =>
          item.text.includes(current.expected),
        );
        const evidence = passage
          ? [
              {
                snapshotId: page.snapshotId,
                passageId: passage.id,
                quote: passage.text,
              },
            ]
          : [];
        action = passage
          ? {
              type: "finish",
              answer: passage.text,
              ...(current.mode === "research"
                ? {
                    claims: [{ text: passage.text, kind: "extract", evidence }],
                  }
                : { evidence }),
            }
          : {
              type: "ask_user",
              question:
                "Expected public passage unavailable; inspect site drift or scope.",
            };
        if (current.mode === "web") {
          const notes = decode(prompt, "retained-extractions");
          const source = notes.find((note) => note.url === current.expectedUrl);
          const cited = source ? JSON.parse(source.text)[0] : undefined;
          action = cited
            ? {
                type: "finish",
                answer: "Official tutorial candidate.",
                webFind: {
                  outcome: "matches",
                  matches: [
                    {
                      url: source.url,
                      reason: "Frozen-label mock selection; plumbing only.",
                      evidence: [
                        {
                          snapshotId: cited.snapshotId,
                          passageId: cited.id,
                          quote: cited.text,
                        },
                      ],
                    },
                  ],
                },
              }
            : {
                type: "finish",
                answer: "No readable official page.",
                webFind: {
                  outcome: "no-match",
                  reason: "No source in fixed scope.",
                },
              };
        }
      }
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          choices: [
            {
              message: { content: JSON.stringify(action) },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 16, completion_tokens: 16 },
        }),
      );
    } catch (error) {
      response.writeHead(500).end(JSON.stringify({ error: String(error) }));
    }
  });
});
if (!actual)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  for (const item of cases) {
    current = item;
    typed = false;
    const events = [],
      started = Date.now(),
      before = calls;
    let verifiedField = false;
    const scope = ["research", "web"].includes(item.mode)
      ? {
          mode: item.mode,
          engineUrl: "https://html.duckduckgo.com/html/",
          queries: item.queries,
          maxSources: 5,
        }
      : item.mode === "history"
        ? {
            mode: "history",
            catalog,
            from: "2026-10-18T00:00:00Z",
            to: "2026-10-18T23:59:59Z",
            terms: item.terms,
          }
        : undefined;
    const origins =
      scope && scope.mode !== "history"
        ? ["https://html.duckduckgo.com", ...item.origins]
        : [new URL(item.url ?? item.expectedUrl).origin];
    const logDir = path.join(execution, item.id);
    try {
      const run = await new BrowserAgentRuntime().run({
        task: item.task,
        ...(item.mode === "ask"
          ? { askUrl: item.url }
          : item.mode === "find"
            ? { findUrl: item.url }
            : {}),
        ...(scope ? { discovery: scope } : {}),
        provider: "local",
        model: process.env.CHROMECLAW_TEST_LOCAL_MODEL,
        baseUrl: process.env.CHROMECLAW_TEST_LOCAL_URL,
        responseFormat: "llama-schema",
        maxOutputTokens: 1200,
        requestTimeoutMs: 90000,
        maxSteps: 6,
        headless: false,
        profileDir: path.join(profiles, item.id),
        logDir,
        permissions: {
          origins,
          write: item.mode === "work",
          irreversible: "deny",
          tools:
            item.mode === "work"
              ? ["navigate", "type", "finish", "ask_user", "fail"]
              : undefined,
          maxCost: actual ? 0 : 0.02,
          timeoutMs: 300000,
        },
        ...(!actual && item.mode !== "history"
          ? {
              planner: new OpenAICompatiblePlanner({
                model: "dummy-byok-wire-emulator",
                apiKey: "DUMMY-LIVE-TEST-KEY",
                baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
                providerName: "emulated-byok",
                mode: "hosted",
                requestCost: 0.001,
                maxOutputTokens: 1200,
                timeoutMs: 10000,
              }),
            }
          : {}),
        onEvent: (event) => events.push(event),
        approve: async () => false,
        ...(item.mode === "work"
          ? {
              verify: async (session) => {
                verifiedField =
                  (await session.page
                    .locator(`:is(input,textarea)[name="${item.field}"]`)
                    .inputValue()) === item.value &&
                  session.page.url() === item.url;
                await session.page.screenshot({
                  path: path.join(logDir, "unsent-form.png"),
                  mask: [session.page.locator("input,textarea,select")],
                });
                return {
                  passed: verifiedField,
                  detail:
                    "Independent DOM check: exact synthetic value and original URL; no submit action admitted.",
                };
              },
            }
          : {}),
      });
      const finish = [...run.steps]
        .reverse()
        .find((step) => step.action?.type === "finish");
      const action = finish?.action;
      const matches =
        action?.pageFind?.outcome === "matches" ? action.pageFind.matches : [];
      const ranked = matches.map(
        (match) =>
          finish.observation.interactiveElements.find(
            (node) => node.number === match.target,
          )?.destination,
      );
      const urls =
        action?.webFind?.outcome === "matches"
          ? action.webFind.matches.map((match) => match.url)
          : [];
      const passed = item.absent
        ? run.status === "uncertain" &&
          matches.length === 0 &&
          action?.pageFind?.outcome === "no-match"
        : run.status === "done" &&
          (item.mode === "work"
            ? verifiedField
            : item.mode === "find"
              ? ranked.some((url) => url?.includes(item.expectedDestination))
              : ["web", "history"].includes(item.mode)
                ? urls.includes(item.expectedUrl)
                : run.finalAnswer?.includes(item.expected));
      const activations = events.filter(
        (event) =>
          event.type === "act_started" && event.payload.effect === "activate",
      );
      assert.equal(
        activations.length,
        0,
        "No live control activation is authorized in this suite.",
      );
      const usage = events
        .filter((event) => event.type === "model_usage")
        .map((event) => event.payload);
      const trace = await readFile(
        path.join(logDir, `${run.id}.jsonl`),
        "utf8",
      );
      assert.ok(
        !trace.includes("DUMMY-LIVE-TEST-KEY"),
        "Provider key leaked into trace.",
      );
      if (!actual && item.mode !== "history")
        assert.equal(run.reservedCost, (calls - before) * 0.001);
      results.push({
        id: item.id,
        mode: item.mode,
        passed: Boolean(passed),
        status: run.status,
        error: run.error,
        answer: run.finalAnswer,
        ranked,
        urls,
        verifiedField,
        latencyMs: Date.now() - started,
        steps: run.steps.length,
        usage,
        reservedCost: run.reservedCost ?? 0,
        actualHostedSpend: 0,
        emulatedRequests: calls - before,
        liveActivations: activations.length,
        runId: run.id,
        log: `${item.id}/${run.id}.jsonl`,
        sourceFailures: events
          .filter(
            (event) =>
              event.type === "discovery" &&
              event.payload.stage === "source-failure",
          )
          .map((event) => event.payload),
      });
      console.error(
        `${item.id}: ${passed ? "pass" : "miss"} ${run.status} ${Date.now() - started}ms`,
      );
    } catch (error) {
      results.push({
        id: item.id,
        mode: item.mode,
        passed: false,
        status: "harness-error",
        error: String(error),
        latencyMs: Date.now() - started,
      });
      console.error(`${item.id}: ${error}`);
    }
    await writeReport();
  }
} finally {
  if (!actual) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await rm(profiles, { recursive: true, force: true });
  await writeReport();
}
async function writeReport() {
  const report = {
    suite: day2
      ? "live-01-session2"
      : process.argv.includes("--followup")
        ? "live-01-day1-development-followup"
        : "live-01-day1",
    startedOn: fixture.frozenAt,
    session: fixture.session ?? 1,
    ...(day2 ? { distinctDayCredit: false } : {}),
    actualLocal: actual,
    hostedInference: false,
    profile: actual
      ? process.env.CHROMECLAW_TEST_LOCAL_MODEL
      : "emulated-byok-wire-only",
    fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
    limits: fixture.limits,
    selected: cases.length,
    completed: results.length,
    passed: results.filter((result) => result.passed).length,
    modelQualityClaim: actual
      ? "Small frozen public-site pilot only; development retests are not held out. Synthetic history excluded from inference."
      : "None; labels drive mock responses.",
    cacheCondition:
      "Fresh disposable profile per task; model server warm after first task. Not a paired cold/warm benchmark.",
    requests,
    results,
  };
  await writeFile(
    path.join(execution, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(path.join(execution, "report.json"));
if (results.length !== cases.length || results.some((result) => !result.passed))
  process.exitCode = 1;
