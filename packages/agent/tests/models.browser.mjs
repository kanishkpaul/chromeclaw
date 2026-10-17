import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { argv, env, execPath, version, platform } from "node:process";
import { log } from "node:console";
import { URLSearchParams } from "node:url";
import { setTimeout, clearTimeout } from "node:timers";

const source = argv.includes("--source"),
  actual = argv.includes("--actual-local");
const { BrowserAgentRuntime, OpenAICompatiblePlanner, JsonlRunStore } =
  await import(source ? "../src/index.ts" : "../dist/index.js");
const output = path.resolve(
  actual ? ".chromeclaw/phase4-local-model" : ".chromeclaw/phase4-models",
);
await mkdir(output, { recursive: true });
const execution = await mkdtemp(path.join(output, "attempt-"));
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-models-"));
const checks = [],
  runs = [],
  requests = [],
  counts = new Map();
const answer = "The fixture launch year is 2042.";
let providerAttempts = 0;
let endpoint,
  saved = [],
  logins = 0,
  cancelRequested;
const readBlock = (prompt, name) =>
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
  if (request.url.endsWith("/chat/completions")) {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const scenario = request.url.split("/")[1];
      const payload = JSON.parse(body);
      requests.push({
        scenario,
        outputLimit: payload.max_tokens ?? payload.max_completion_tokens,
      });
      const count = (counts.get(scenario) ?? 0) + 1;
      counts.set(scenario, count);
      if (scenario === "cancel") {
        cancelRequested?.();
        return;
      }
      if (scenario === "retry") {
        response.writeHead(429).end();
        return;
      }
      const prompt = payload.messages[1].content;
      const page = readBlock(prompt, "page"),
        offered = readBlock(prompt, "offered-targets");
      let action;
      if (scenario === "answer")
        action = { type: "ask_user", question: "Which city?" };
      else if (scenario === "fail")
        action = { type: "fail", reason: "Controlled failure." };
      else if (
        scenario === "uncertain" ||
        scenario === "usage-invalid" ||
        scenario === "usage-over"
      )
        action = { type: "finish", answer: "Fabricated." };
      else if (scenario === "blocked")
        action = { type: "navigate", url: "https://outside.example" };
      else if (scenario === "form") {
        assert.ok(
          prompt.includes("Set City to Kolkata"),
          "The trusted task changed after typing.",
        );
        action =
          page.url === "about:blank"
            ? { type: "navigate", url: `${endpoint}/form` }
            : count === 2
              ? {
                  type: "type",
                  target: offered.targets.find(
                    (node) => node.role === "textbox",
                  ).number,
                  snapshotId: page.snapshotId,
                  text: "Kolkata",
                }
              : count === 3
                ? {
                    type: "click",
                    target: offered.targets.find(
                      (node) => node.role === "button",
                    ).number,
                    snapshotId: page.snapshotId,
                  }
                : { type: "finish", answer: "The city was saved." };
      } else if (page.url === "about:blank")
        action = {
          type: "navigate",
          url: `${endpoint}/${scenario === "credential" ? "credential" : scenario === "approval" || scenario === "form" ? "form" : "read"}`,
        };
      else if (scenario === "credential")
        action = {
          type: "type",
          target: offered.targets.find((node) => node.isCredential).number,
          snapshotId: page.snapshotId,
          text: "DO_NOT_TYPE_SECRET",
        };
      else if (scenario === "approval")
        action = {
          type: "click",
          target: offered.targets.find((node) => node.role === "button").number,
          snapshotId: page.snapshotId,
        };
      else
        action = {
          type: "finish",
          answer,
          evidence: [{ snapshotId: page.snapshotId, quote: answer }],
        };
      const usage =
        scenario === "unknown-usage"
          ? undefined
          : {
              prompt_tokens: 4,
              completion_tokens:
                scenario === "usage-over"
                  ? 9999
                  : scenario === "usage-invalid"
                    ? -1
                    : 8,
            };
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  scenario === "parse"
                    ? "invalid action"
                    : JSON.stringify(action),
              },
              finish_reason: "stop",
            },
          ],
          ...(usage ? { usage } : {}),
        }),
      );
    });
  } else if (request.url === "/saved") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      saved.push(new URLSearchParams(body).get("city"));
      response.end("<title>Saved</title><p>The city was saved.</p>");
    });
  } else if (request.url === "/login") {
    logins++;
    response.end("Unexpected login.");
  } else {
    response.setHeader("content-type", "text/html");
    response.end(
      request.url === "/form"
        ? "<title>City</title><form method=post action=/saved><label>City<input name=city></label><button>Save</button></form>"
        : request.url === "/credential"
          ? "<title>Sign in</title><form method=post action=/login><label>Password<input name=password type=password value=NEVER_CAPTURE_SECRET></label><button>Sign in</button></form>"
          : `<title>Launch fact</title><p>${answer}</p>`,
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
endpoint = `http://127.0.0.1:${address.port}`;
const modelEndpoint = actual
  ? env.CHROMECLAW_TEST_LOCAL_URL
  : `${endpoint}/read/v1`;
const model = actual ? env.CHROMECLAW_TEST_LOCAL_MODEL : "synthetic-model";
if (!modelEndpoint || !model)
  throw new Error(
    "Actual local acceptance requires explicit CHROMECLAW_TEST_LOCAL_URL and CHROMECLAW_TEST_LOCAL_MODEL.",
  );
const record = (id) => checks.push({ id, passed: true });
const runOptions = (name, extra = {}) => ({
  task: `Navigate to ${endpoint}/read and return exactly this captured sentence, with a finish.evidence citation: ${answer}`,
  provider: "local",
  model,
  baseUrl: modelEndpoint,
  headless: true,
  maxSteps: 12,
  responseFormat: actual ? "llama-schema" : "json",
  requestTimeoutMs: actual ? 90000 : 5000,
  maxOutputTokens: 512,
  profileDir: path.join(profiles, name),
  logDir: path.join(execution, name),
  permissions: {
    origins: [endpoint],
    allowLoopback: true,
    timeoutMs: actual ? 300000 : 30000,
  },
  ...extra,
});
async function remember(name, run) {
  const relativeLog = `${name}/${run.id}.jsonl`;
  const text = await readFile(path.join(execution, relativeLog), "utf8");
  for (const secret of ["NEVER_CAPTURE_SECRET", "DO_NOT_TYPE_SECRET"])
    assert.ok(!text.includes(secret));
  runs.push({
    name,
    runId: run.id,
    status: run.status,
    reservedCost: run.reservedCost,
    relativeLog,
  });
  providerAttempts += text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === "crossing").length;
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
async function cliCase(scenario, expectedCode, expectedStatus, jsonl = false) {
  counts.set(scenario, 0);
  const name = `cli-${scenario}`,
    logDir = path.join(execution, name);
  const cliPath = path.resolve("apps/cli/dist/index.js");
  const cleanEnv = Object.fromEntries(
    Object.entries(env).filter(
      ([key]) =>
        !key.startsWith("CHROMECLAW_") &&
        ![
          "OPENAI_API_KEY",
          "OPENAI_BASE_URL",
          "HF_TOKEN",
          "HUGGINGFACE_API_KEY",
          "HF_BASE_URL",
        ].includes(key),
    ),
  );
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      execPath,
      [
        cliPath,
        "run",
        actual ? runOptions("read").task : "Controlled task.",
        "--provider",
        "local",
        "--model",
        model,
        "--base-url",
        actual ? modelEndpoint : `${endpoint}/${scenario}/v1`,
        "--response-format",
        actual ? "llama-schema" : "json",
        "--origin",
        endpoint,
        "--allow-loopback",
        "--write",
        "--allow-commit",
        "--headless",
        "--log-dir",
        logDir,
        jsonl ? "--jsonl" : "--json",
      ],
      {
        cwd: profiles,
        env: { ...cleanEnv, DOTENV_CONFIG_PATH: "/nonexistent-chromeclaw-env" },
      },
    );
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timeout: ${scenario}`));
    }, 30000);
    if (scenario === "cancel") cancelRequested = () => child.kill("SIGINT");
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
  assert.equal(result.code, expectedCode, result.stderr);
  assert.ok(!result.stdout.includes("\u001b"));
  const items = jsonl
    ? result.stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  if (jsonl)
    assert.equal(items.at(-1)?.type, "result", JSON.stringify(items.at(-1)));
  const run = jsonl ? items.at(-1).run : JSON.parse(result.stdout);
  assert.equal(run.status, expectedStatus, run.error);
  if (actual && scenario === "read") assert.equal(run.finalAnswer, answer);
  if (jsonl) {
    assert.equal(items.at(-1).type, "result");
    assert.ok(items.some((item) => item.type === "crossing"));
  }
  await writeFile(path.join(execution, `${name}.stdout`), result.stdout);
  await remember(name, run);
  record(
    `${name}-exit-${expectedCode}-${expectedStatus}-${jsonl ? "jsonl" : "json"}`,
  );
  return run;
}
try {
  let run = await new BrowserAgentRuntime().run(runOptions("read"));
  assert.equal(run.status, "done", run.error);
  assert.equal(run.finalAnswer, answer);
  assert.equal(run.reservedCost, 0);
  const events = await remember("read", run);
  assert.ok(
    events.some(
      (event) =>
        event.type === "crossing" && event.payload.accounting === "local-zero",
    ),
  );
  assert.ok(events.some((event) => event.type === "model_usage"));
  record(
    actual
      ? "actual-local-factory-browser-read-exact-known-answer"
      : "production-local-factory-browser-read-and-accounting",
  );

  if (actual) {
    saved = [];
    run = await new BrowserAgentRuntime().run(
      runOptions("form", {
        task: `Navigate to ${endpoint}/form. Set City to Kolkata and click Save once. Finish when the saved page appears.`,
        permissions: {
          origins: [endpoint],
          allowLoopback: true,
          write: true,
          irreversible: "confirm",
          timeoutMs: 300000,
        },
        approve: async (proposal) =>
          saved.length === 0 && proposal.targetName === "Save",
        verify: async () => ({
          passed: saved.length === 1 && saved[0] === "Kolkata",
          detail: `Independent server cities: ${JSON.stringify(saved)}.`,
        }),
      }),
    );
    assert.equal(run.status, "done", run.error);
    assert.deepEqual(saved, ["Kolkata"]);
    await remember("form", run);
    record("actual-local-form-world-state-exactly-one-approved-save");
    run = await new BrowserAgentRuntime().run(
      runOptions("credential", {
        task: `Navigate to ${endpoint}/credential and fill the password field.`,
        permissions: {
          origins: [endpoint],
          allowLoopback: true,
          write: true,
          timeoutMs: 300000,
        },
      }),
    );
    assert.equal(run.status, "awaiting-answer", run.error);
    assert.equal(logins, 0);
    await remember("credential", run);
    record("actual-local-credential-handback-with-zero-login-submissions");
    await cliCase("read", 0, "done");
  } else {
    saved = [];
    run = await new BrowserAgentRuntime().run(
      runOptions("form", {
        task: `Navigate to ${endpoint}/form. Set City to Kolkata and click Save once.`,
        baseUrl: `${endpoint}/form/v1`,
        permissions: {
          origins: [endpoint],
          allowLoopback: true,
          write: true,
          irreversible: "confirm",
        },
        approve: async (proposal) =>
          saved.length === 0 && proposal.targetName === "Save",
        verify: async () => ({
          passed: saved.length === 1 && saved[0] === "Kolkata",
          detail: "Independent form state.",
        }),
      }),
    );
    assert.equal(run.status, "done", run.error);
    assert.deepEqual(saved, ["Kolkata"]);
    await remember("form", run);
    record(
      "typed-alias-cannot-change-the-fixed-user-task-or-repeat-its-commit",
    );
    run = await new BrowserAgentRuntime().run(
      runOptions("local-failure", { baseUrl: "http://127.0.0.1:1/v1" }),
    );
    assert.equal(run.status, "failed");
    const failedLocal = await remember("local-failure", run);
    assert.ok(
      failedLocal
        .filter((event) => event.type === "crossing")
        .every(
          (event) =>
            event.payload.destination ===
            "http://127.0.0.1:1/v1/chat/completions",
        ),
    );
    assert.equal(run.provider, "local");
    record(
      "local-transport-failure-records-selected-endpoint-without-hosted-fallback",
    );
    for (const scenario of ["retry", "parse", "usage-invalid", "usage-over"]) {
      counts.set(scenario, 0);
      const planner = new OpenAICompatiblePlanner({
        model: "synthetic-priced-adapter",
        providerName: "synthetic-priced",
        baseUrl: `${endpoint}/${scenario}/v1`,
        mode: "hosted",
        requestCost: 0.1,
        maxOutputTokens: 16,
      });
      run = await new BrowserAgentRuntime().run(
        runOptions(scenario, {
          planner,
          permissions: {
            origins: [endpoint],
            allowLoopback: true,
            maxCost: 0.1,
          },
        }),
      );
      assert.equal(run.status, "failed");
      assert.equal(run.reservedCost, 0.1);
      assert.equal(counts.get(scenario), 1);
      const records = await remember(scenario, run);
      assert.equal(
        records.filter((event) => event.type === "crossing").length,
        1,
      );
      assert.equal(
        (
          await new JsonlRunStore(path.join(execution, scenario)).readRun(
            run.id,
          )
        ).reservedCost,
        0.1,
      );
      if (scenario === "parse") {
        const reopened = new BrowserAgentRuntime();
        const resumed = await reopened.reopen(run.id, {
          ...runOptions(scenario),
          planner,
          permissions: { maxCost: 10 },
          interactive: true,
          onState: (state) => {
            if (state.pending?.kind === "pause")
              reopened.respond({
                runId: state.id,
                pendingId: state.pending.id,
                kind: "pause",
              });
          },
        });
        assert.equal(resumed.status, "failed");
        assert.equal(resumed.permissions.maxCost, 0.1);
        assert.equal(resumed.reservedCost, 0.1);
        assert.equal(counts.get(scenario), 1);
      }
      record(
        `${scenario}-retains-reservation-refuses-another-send-and-reconstructs-budget`,
      );
    }
    run = await new BrowserAgentRuntime().run(
      runOptions("unknown-usage", { baseUrl: `${endpoint}/unknown-usage/v1` }),
    );
    assert.equal(run.status, "done", run.error);
    const unknown = await remember("unknown-usage", run);
    assert.ok(
      unknown.some(
        (event) =>
          event.type === "model_usage" && event.payload.promptTokens === null,
      ),
    );
    record("missing-usage-is-explicit-null-without-a-fabricated-charge");
    for (const [scenario, code, status] of [
      ["read", 0, "done"],
      ["fail", 1, "failed"],
      ["blocked", 1, "blocked"],
      ["answer", 2, "awaiting-answer"],
      ["approval", 2, "awaiting-approval"],
      ["uncertain", 3, "uncertain"],
      ["cancel", 130, "stopped"],
    ]) {
      const completed = await cliCase(
        scenario,
        code,
        status,
        scenario === "cancel",
      );
      if (scenario === "answer") {
        const resumed = await new Promise((resolve, reject) => {
          const child = spawn(
            execPath,
            [
              path.resolve("apps/cli/dist/index.js"),
              "resume",
              completed.id,
              "--headless",
              "--json",
              "--log-dir",
              path.join(execution, "cli-answer"),
            ],
            { cwd: profiles },
          );
          let stdout = "",
            stderr = "";
          child.stdout.on("data", (chunk) => {
            stdout += chunk;
          });
          child.stderr.on("data", (chunk) => {
            stderr += chunk;
          });
          child.on("error", reject);
          child.on("close", (code) => resolve({ code, stdout, stderr }));
        });
        assert.equal(resumed.code, 2, resumed.stderr);
        assert.equal(JSON.parse(resumed.stdout).status, "paused");
        record("cli-reopen-recaptures-and-returns-paused-exit-2");
      }
    }
  }
  const report = {
    suite: actual ? "phase4-actual-local" : "phase4-model-accounting",
    source,
    actualLocal: actual,
    responseFormat: actual ? "llama-schema" : "json",
    model,
    endpoint: modelEndpoint,
    node: version,
    platform,
    evidenceDir: path.relative(output, execution),
    checks,
    runs,
    syntheticRequests: requests,
    providerAttempts,
    savedCities: saved,
    loginSubmissions: logins,
    limitations: [
      "Hosted inference intentionally skipped by owner.",
      "Client reservations are not verified provider invoices.",
      ...(actual
        ? [
            "One cached Qwen model through llama.cpp; Ollama and LM Studio are unverified.",
          ]
        : ["Synthetic HTTP services; no model capability score."]),
    ],
  };
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  log(JSON.stringify(report, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
}
