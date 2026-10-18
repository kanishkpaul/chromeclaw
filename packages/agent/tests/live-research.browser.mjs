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

const actual = process.argv.includes("--actual-local");
const publicProbe = process.argv.includes("--public-probe");
assert.ok(
  !publicProbe || actual,
  "The public probe runs once in the actual-local lane only.",
);
if (
  actual &&
  (!process.env.CHROMECLAW_TEST_LOCAL_URL ||
    !process.env.CHROMECLAW_TEST_LOCAL_MODEL)
)
  throw new Error("Explicit local endpoint/model required; no fallback.");
const fixtureBytes = await readFile(
  new URL("./fixtures/live-stage3.json", import.meta.url),
);
const fixture = JSON.parse(fixtureBytes);
const cases = fixture.cases.filter((item) =>
  publicProbe
    ? item.lane === "public-search"
    : item.lane === "assisted-live-sources",
);
const output = path.resolve(".chromeclaw/phase8-research");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(
    output,
    publicProbe ? "public-" : actual ? "local-assisted-" : "emulated-assisted-",
  ),
);
const profiles = await mkdtemp(
  path.join(tmpdir(), "chromeclaw-live-research-"),
);
const results = [],
  indexRequests = [],
  modelRequests = [];
let current, indexOrigin;
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

// Notes are bounded text, not a guaranteed complete JSON array. Only use complete offered
// passage objects; missing/truncated references must hand back rather than be invented.
function offeredPassages(page, notes) {
  const passages = [...(page.passages ?? [])];
  for (const note of notes)
    for (const object of note.text.match(/\{[^{}]*\}/g) ?? []) {
      try {
        const passage = JSON.parse(object);
        if (
          typeof passage.text === "string" &&
          typeof passage.id === "string" &&
          typeof passage.snapshotId === "string" &&
          typeof passage.url === "string"
        )
          passages.push(passage);
      } catch {
        // A fragment inside quoted source text is not an offered passage object.
      }
    }
  return passages;
}
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url.startsWith("/index/")) {
    const url = new URL(request.url, indexOrigin);
    const item = fixture.cases.find(
      (item) => url.pathname === `/index/${item.id}`,
    );
    indexRequests.push({
      method: request.method,
      path: url.pathname,
      queryMatches: item?.query === url.searchParams.get("q"),
    });
    if (!item || item.query !== url.searchParams.get("q")) {
      response.writeHead(400).end();
      return;
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(
      `<p>Controlled candidate list, not a public search engine. Snippet: SNIPPET_FALSE_CLAIM_99999.</p>${item.candidates.map((url, index) => `<a href="${url}">Selected candidate ${index + 1}</a>`).join("\n")}`,
    );
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    try {
      assert.ok(
        !actual,
        "Actual-local execution must not use the wire emulator.",
      );
      assert.equal(request.headers.authorization, "Bearer DUMMY-STAGE3-KEY");
      const payload = JSON.parse(body),
        prompt = payload.messages[1].content;
      const page = decode(prompt, "page"),
        notes = decode(prompt, "retained-extractions");
      const passages = offeredPassages(page, notes);
      modelRequests.push({
        id: current.id,
        authorization: "dummy-only",
        offered: notes.map((note) => ({
          url: note.url,
          characters: note.text.length,
          completePassages: offeredPassages({ passages: [] }, [note]).length,
        })),
      });
      let action;
      if (current.mode === "research") {
        const selected = current.expectedSources.map((expected) =>
          passages.find(
            (passage) =>
              passage.url === expected.url &&
              passage.text.includes(expected.text),
          ),
        );
        action = selected.every(Boolean)
          ? {
              type: "finish",
              answer: selected.map((p) => p.text).join("\n"),
              claims: selected.map((p) => ({
                text: p.text,
                kind: "extract",
                evidence: [
                  { snapshotId: p.snapshotId, passageId: p.id, quote: p.text },
                ],
              })),
            }
          : {
              type: "ask_user",
              question:
                "The offered source text lacks a required complete passage/reference. Inspect the source scope; do not invent evidence.",
            };
      } else {
        const passage = passages.find((p) => p.url === current.expectedUrl);
        action = passage
          ? {
              type: "finish",
              answer: "Selected source candidate.",
              webFind: {
                outcome: "matches",
                matches: [
                  {
                    url: passage.url,
                    reason:
                      "Frozen-label wire-emulator selection; no quality claim.",
                    evidence: [
                      {
                        snapshotId: passage.snapshotId,
                        passageId: passage.id,
                        quote: passage.text,
                      },
                    ],
                  },
                ],
              },
            }
          : {
              type: "finish",
              answer: "No offered source reference.",
              webFind: {
                outcome: "no-match",
                reason: "No readable selected source.",
              },
            };
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
indexOrigin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const item of cases) {
    current = item;
    const events = [],
      started = Date.now(),
      before = modelRequests.length;
    const engineUrl = publicProbe
      ? "https://html.duckduckgo.com/html/"
      : `${indexOrigin}/index/${item.id}`;
    const logDir = path.join(execution, item.id);
    try {
      const run = await new BrowserAgentRuntime().run({
        task: item.task,
        discovery: {
          mode: item.mode,
          engineUrl,
          queries: [item.query],
          maxSources: 5,
        },
        provider: "local",
        model: process.env.CHROMECLAW_TEST_LOCAL_MODEL,
        baseUrl: process.env.CHROMECLAW_TEST_LOCAL_URL,
        responseFormat: "llama-schema",
        maxOutputTokens: 1600,
        requestTimeoutMs: 90000,
        maxSteps: 4,
        headless: false,
        profileDir: path.join(profiles, item.id),
        logDir,
        permissions: {
          origins: [new URL(engineUrl).origin, ...item.origins],
          allowLoopback: !publicProbe,
          write: false,
          irreversible: "deny",
          maxCost: actual ? 0 : 0.02,
          timeoutMs: 300000,
        },
        ...(!actual
          ? {
              planner: new OpenAICompatiblePlanner({
                model: "dummy-stage3-wire",
                apiKey: "DUMMY-STAGE3-KEY",
                baseUrl: indexOrigin + "/v1",
                providerName: "emulated-byok",
                mode: "hosted",
                requestCost: 0.001,
                maxOutputTokens: 1600,
                timeoutMs: 10000,
              }),
            }
          : {}),
        approve: async () => false,
        onEvent: (event) => events.push(event),
      });
      const action = [...run.steps]
        .reverse()
        .find((step) => step.action?.type === "finish")?.action;
      const sources = events
        .filter(
          (event) =>
            event.type === "discovery" && event.payload.stage === "source",
        )
        .map((event) => event.payload);
      const failures = events
        .filter(
          (event) =>
            event.type === "discovery" &&
            event.payload.stage === "source-failure",
        )
        .map((event) => event.payload);
      const captured = sources.flatMap((source) => source.passages ?? []);
      const references = (action?.claims ?? [])
        .flatMap((claim) => claim.evidence)
        .concat(
          action?.webFind?.outcome === "matches"
            ? action.webFind.matches.flatMap((match) => match.evidence)
            : [],
        );
      const referenceValid =
        references.length > 0 &&
        references.every((ref) =>
          captured.some(
            (p) =>
              p.snapshotId === ref.snapshotId &&
              p.id === ref.passageId &&
              p.text.includes(ref.quote),
          ),
        );
      const urls =
        action?.webFind?.outcome === "matches"
          ? action.webFind.matches.map((match) => match.url)
          : [];
      const sourceCoverage = (item.expectedSources ?? []).map((expected) => ({
        url: expected.url,
        covered: (action?.claims ?? []).some(
          (claim) =>
            claim.text.includes(expected.text) &&
            claim.evidence.some((ref) =>
              captured.some(
                (p) =>
                  p.url === expected.url &&
                  p.snapshotId === ref.snapshotId &&
                  p.id === ref.passageId &&
                  p.text === claim.text,
              ),
            ),
        ),
      }));
      const passed = item.negative
        ? run.status === "uncertain" &&
          sources.length === 0 &&
          urls.length === 0 &&
          failures.length > 0
        : run.status === "done" &&
          referenceValid &&
          (item.mode === "research"
            ? sourceCoverage.every((source) => source.covered)
            : urls.includes(item.expectedUrl));
      assert.equal(
        events.filter(
          (event) =>
            event.type === "act_started" && event.payload.effect === "activate",
        ).length,
        0,
      );
      assert.ok(
        !(JSON.stringify(action) ?? "").includes("SNIPPET_FALSE_CLAIM_99999"),
      );
      assert.ok(
        !references.some((ref) =>
          captured.some(
            (p) => p.id === ref.passageId && p.url.startsWith(indexOrigin),
          ),
        ),
      );
      const trace = await readFile(
        path.join(logDir, `${run.id}.jsonl`),
        "utf8",
      );
      assert.ok(!trace.includes("DUMMY-STAGE3-KEY"));
      const crossings = events.filter((event) => event.type === "crossing");
      if (item.negative)
        assert.equal(
          crossings.length,
          0,
          "Unavailable/unpermitted sources must not invoke a model.",
        );
      results.push({
        id: item.id,
        lane: item.lane,
        mode: item.mode,
        negative: item.negative ?? null,
        passed,
        status: run.status,
        error: run.error,
        answer: run.finalAnswer,
        claims: action?.claims,
        urls,
        sourceCoverage,
        referenceValid,
        sources,
        failures,
        modelAttempts: crossings.length,
        usage: events
          .filter((event) => event.type === "model_usage")
          .map((event) => event.payload),
        emulatorRequests: modelRequests.length - before,
        reservedCost: run.reservedCost ?? 0,
        actualHostedSpend: 0,
        latencyMs: Date.now() - started,
        steps: run.steps.length,
        runId: run.id,
        log: `${item.id}/${run.id}.jsonl`,
        safeBarrierHandback:
          run.status === "failed" && /barrier/.test(run.error ?? ""),
      });
      console.error(
        `${item.id}: ${passed ? "pass" : "miss"} ${run.status} ${Date.now() - started}ms`,
      );
    } catch (error) {
      results.push({
        id: item.id,
        lane: item.lane,
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
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
  await writeReport();
}
async function writeReport() {
  await writeFile(
    path.join(execution, "report.json"),
    JSON.stringify(
      {
        suite: "live-01-stage3",
        stage: 3,
        calendarDate: fixture.frozenAt,
        actualLocal: actual,
        hostedInference: false,
        lane: publicProbe ? "public-search" : "assisted-live-sources",
        candidateIndex: publicProbe
          ? "public search; one fixed query"
          : "controlled preselected index; real public source reads; not live search quality",
        model: actual
          ? process.env.CHROMECLAW_TEST_LOCAL_MODEL
          : "dummy-wire-only",
        serverContextTokens: actual ? 16384 : null,
        fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
        limits: fixture.limits,
        selected: cases.length,
        completed: results.length,
        passed: results.filter((result) => result.passed).length,
        indexRequests,
        modelRequests,
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(path.join(execution, "report.json"));
if (results.length !== cases.length || results.some((result) => !result.passed))
  process.exitCode = 1;
