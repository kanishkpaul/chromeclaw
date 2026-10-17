import console from "node:console";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { openBrowser, navigate } from "../dist/index.js";
import { BrowserAgentRuntime } from "../../agent/dist/index.js";
const output = path.resolve(".chromeclaw/phase5-session");
await mkdir(output, { recursive: true });
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-session-"));
const server = createServer((_request, response) =>
  response.end("<p>The session fixture is readable.</p>"),
);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
let owned, remote, attached;
const checks = [];
try {
  let start = performance.now();
  owned = await openBrowser({
    headless: true,
    profileDir: path.join(profiles, "owned"),
  });
  await navigate(owned.page, origin);
  await owned.context.addCookies([
    {
      name: "session-fixture",
      value: "owned-only",
      url: origin,
      expires: Math.floor(Date.now() / 1000) + 3600,
    },
  ]);
  const ownedMs = performance.now() - start;
  await owned.close();
  owned = undefined;
  start = performance.now();
  owned = await openBrowser({
    headless: true,
    profileDir: path.join(profiles, "owned"),
  });
  assert.ok(
    (await owned.context.cookies()).some((c) => c.name === "session-fixture"),
  );
  const reopenMs = performance.now() - start;
  await owned.close();
  owned = undefined;
  checks.push({
    id: "owned-profile-persists-only-its-synthetic-session",
    passed: true,
  });
  const ports = createServer();
  await new Promise((r) => ports.listen(0, "127.0.0.1", r));
  const port = ports.address().port;
  await new Promise((r) => ports.close(r));
  try {
    remote = await chromium.launchPersistentContext(
      path.join(profiles, "authorized"),
      {
        channel: "chrome",
        headless: true,
        args: [`--remote-debugging-port=${port}`],
      },
    );
  } catch {
    remote = await chromium.launchPersistentContext(
      path.join(profiles, "authorized"),
      { headless: true, args: [`--remote-debugging-port=${port}`] },
    );
  }
  const context = remote;
  const page = remote.pages()[0] ?? (await remote.newPage());
  await page.goto(origin);
  await context.addCookies([
    { name: "authorized-fixture", value: "explicit-session-only", url: origin },
  ]);
  start = performance.now();
  attached = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const attachMs = performance.now() - start;
  const contexts = attached.contexts();
  assert.ok(contexts.length > 0);
  const pages = contexts.flatMap((c) => c.pages());
  assert.ok(pages.some((p) => p.url() === origin + "/"));
  const cookies = (await Promise.all(contexts.map((c) => c.cookies()))).flat();
  assert.ok(cookies.some((c) => c.name === "authorized-fixture"));
  await attached.close();
  attached = undefined;
  assert.equal(
    await page.textContent("body"),
    "The session fixture is readable.",
  );
  checks.push({
    id: "explicit-disposable-cdp-session-is-readable-and-disconnect-preserves-owner",
    passed: true,
  });
  const runtime = new BrowserAgentRuntime();
  let calls = 0;
  const run = await runtime.run({
    task: "Read",
    headless: true,
    profileDir: path.join(profiles, "disconnect"),
    logDir: path.join(output, "runs"),
    permissions: { origins: [origin], allowLoopback: true },
    planner: {
      name: "disconnect-fixture",
      model: "scripted",
      async plan() {
        calls++;
        return calls === 1
          ? { type: "ask_user", question: "Take over in Chrome." }
          : { type: "navigate", url: origin };
      },
    },
    answer: async (_q, session) => {
      await session.context.close();
      return "Browser closed manually.";
    },
  });
  assert.equal(run.status, "failed");
  assert.equal(calls, 1);
  checks.push({
    id: "manual-browser-close-fails-truthfully-without-another-planner-call",
    passed: true,
    runId: run.id,
  });
  const report = {
    suite: "phase5-session-comparison",
    checks,
    timingsMs: {
      ownedLaunch: ownedMs,
      ownedReopen: reopenMs,
      explicitCdpAttach: attachMs,
    },
    personalProfileTouched: false,
    decision:
      "Keep owned profiles. CDP can expose all attached session contexts; navigation guards and cleanup ownership need separate scoping before production attachment.",
    limitations: [
      "Disposable explicitly debuggable fixture only; ordinary personal Chrome was neither opened nor attached.",
      "No bridge or personal-session integration claimed.",
    ],
  };
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await attached?.close();
  await remote?.close();
  await owned?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await rm(profiles, { recursive: true, force: true });
}
