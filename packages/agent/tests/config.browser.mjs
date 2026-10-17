import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { argv, version, platform } from "node:process";
import { log } from "node:console";

const source = argv.includes("--source");
const { BrowserAgentRuntime, createPlanner } = await import(
  source ? "../src/index.ts" : "../dist/index.js"
);
const output = path.resolve(".chromeclaw/phase4-configuration");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(path.join(output, "attempt-"));
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-config-"));
const checks = [],
  runs = [];
const answer = "The fixture launch year is 2042.";
let calls = 0,
  endpoint,
  serverFailure;
const server = createServer((request, response) => {
  if (request.url === "/v1/chat/completions") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", async () => {
      try {
        assert.equal(request.headers.authorization, "Bearer LOCAL_FIXTURE_KEY");
        const files = await readdir(path.join(execution, "runs"));
        const latest = JSON.parse(
          (await readFile(path.join(execution, "runs", files.at(-1)), "utf8"))
            .trim()
            .split("\n")
            .at(-1),
        );
        assert.equal(latest.type, "crossing");
        const payload = JSON.parse(body);
        const prompt = payload.messages[1].content;
        const page = JSON.parse(
          prompt.match(
            /<untrusted provenance="page">\n([\s\S]*?)\n<\/untrusted>/,
          )[1],
        );
        const action =
          page.url === "about:blank"
            ? { type: "navigate", url: `${endpoint}/knowledge` }
            : {
                type: "finish",
                answer,
                evidence: [{ snapshotId: page.snapshotId, quote: answer }],
              };
        calls++;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(action) } }],
          }),
        );
      } catch (error) {
        serverFailure = error;
        response.writeHead(500).end();
      }
    });
  } else {
    response.setHeader("content-type", "text/html");
    response.end(`<title>Configuration fixture</title><p>${answer}</p>`);
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
endpoint = `http://127.0.0.1:${address.port}`;
try {
  // Injected fixture planners intentionally bypass the production accounting lock. This is not inference.
  const planner = createPlanner({
    provider: "local",
    model: "synthetic-config-fixture",
    baseUrl: `${endpoint}/v1`,
    apiKey: "LOCAL_FIXTURE_KEY",
  });
  const runtime = new BrowserAgentRuntime();
  const run = await runtime.run({
    task: `Read ${endpoint}/knowledge and quote the launch fact.`,
    planner,
    headless: true,
    maxSteps: 5,
    profileDir: path.join(profiles, "browser"),
    logDir: path.join(execution, "runs"),
    permissions: { origins: [endpoint], allowLoopback: true },
  });
  if (serverFailure) throw serverFailure;
  assert.equal(run.status, "done", run.error);
  assert.equal(run.finalAnswer, answer);
  assert.equal(calls, 2);
  const trace = await readFile(
    path.join(execution, "runs", `${run.id}.jsonl`),
    "utf8",
  );
  assert.ok(!trace.includes("LOCAL_FIXTURE_KEY"));
  checks.push({
    id: "explicit-local-factory-drives-chromium-with-durable-crossings-and-no-key-in-trace",
    passed: true,
  });
  runs.push({
    name: "browser",
    runId: run.id,
    status: run.status,
    relativeLog: `runs/${run.id}.jsonl`,
  });

  for (const [name, settings, error] of [
    [
      "invalid-local",
      {
        provider: "local",
        model: "fixture",
        baseUrl: "https://localhost.attacker.example/v1",
      },
      /exact loopback/,
    ],
    [
      "invalid-model",
      {
        provider: "local",
        model: "INVALID_MODEL\nDO_NOT_LOG",
        baseUrl: `${endpoint}/v1`,
      },
      /explicit nonempty model/,
    ],
    [
      "unsupported-provider",
      { provider: "anthropic", model: "fixture" },
      /unavailable/,
    ],
    [
      "hosted-budget-required",
      {
        provider: "openai",
        model: "fixture",
        baseUrl: "https://api.openai.com/v1",
      },
      /key|cost budget/,
    ],
  ]) {
    const profileDir = path.join(profiles, name);
    const failed = await new BrowserAgentRuntime().run({
      task: "Do not open Chrome.",
      ...settings,
      headless: true,
      profileDir,
      logDir: path.join(execution, name),
    });
    assert.equal(failed.status, "failed");
    assert.match(failed.error, error);
    const failedTrace = await readFile(
      path.join(execution, name, `${failed.id}.jsonl`),
      "utf8",
    );
    assert.ok(!failedTrace.includes("INVALID_MODEL"));
    await assert.rejects(stat(profileDir), { code: "ENOENT" });
    assert.equal(calls, 2);
    checks.push({
      id: `${name}-refuses-before-browser-and-provider-request`,
      passed: true,
    });
    runs.push({
      name,
      runId: failed.id,
      status: failed.status,
      relativeLog: `${name}/${failed.id}.jsonl`,
    });
  }
  const report = {
    suite: "phase4-configuration",
    source,
    node: version,
    platform: platform,
    evidenceDir: path.relative(output, execution),
    checks,
    runs,
    modelRequests: calls,
    limitations: [
      "Synthetic loopback HTTP, not a local inference model.",
      "Hosted testing intentionally skipped by owner.",
      "Hosted inference requires an explicit request ceiling and positive task budget.",
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
