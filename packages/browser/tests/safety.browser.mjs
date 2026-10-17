import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { log } from "node:console";
import { argv, version, platform } from "node:process";
import { URL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const source = argv.includes("--source");
const {
  openBrowser,
  getPageSnapshot,
  clickTarget,
  typeIntoTarget,
  guardNavigation,
} = await import(source ? "../src/index.ts" : "../dist/index.js");
const { BrowserAgentRuntime } = await import(
  source ? "../../agent/src/index.ts" : "../../agent/dist/index.js"
);
const { createPermissions } = await import(
  source ? "../../shared/src/index.ts" : "../../shared/dist/index.js"
);
const output = path.resolve(".chromeclaw/phase2-safety");
await mkdir(output, { recursive: true });
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-safety-"));
const checks = [];
const evidence = {};
const record = (id) => checks.push({ id, passed: true });
let commits = 0;
let budgetProbes = 0;
let escapedRequests = 0;
let changeApprovalState = false;
let otherOrigin;
const fixture = `<!doctype html><title>PostgreSQL documentation</title>
<p>Read about payment tables without transferring money.</p>
<label>Amount<input id=amount value=10></label>
<form action=/commit><label>City<input name=city></label><button>Transfer</button></form>
<button onclick="fetch('/commit',{method:'POST'})">Continue</button>
<a href=/redirect>Redirect</a><a href=/popup target=_blank>New tab</a>
<script>setInterval(async()=>{ if((await (await fetch('/state')).text())==='changed') globalThis.document.querySelector('button').textContent='Pay changed recipient'; },40)</script>`;
const other = createServer((request, response) => {
  escapedRequests++;
  response.end("<title>Other origin</title><button>Foreign</button>");
});
const server = createServer((request, response) => {
  response.setHeader("content-type", "text/html");
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/budget-probe") {
    budgetProbes++;
    response.end("probe");
  } else if (url.pathname === "/commit") {
    commits++;
    response.end("<title>Committed</title><p>Recorded</p>");
  } else if (url.pathname === "/state")
    response.end(changeApprovalState ? "changed" : "unchanged");
  else if (url.pathname === "/redirect") {
    response.writeHead(302, { location: `${otherOrigin}/escaped` });
    response.end();
  } else if (url.pathname === "/cross-form")
    response.end(
      `<form action="${otherOrigin}/commit"><input name=secret value=SYNTHETIC_PRIVATE><button>Send</button></form>`,
    );
  else {
    response.setHeader("content-type", "text/html");
    response.end(
      fixture.replace(
        ">Transfer<",
        `>${{ "/pay": "Pay", "/post": "Post", "/delete": "Delete" }[url.pathname] ?? "Transfer"}<`,
      ),
    );
  }
});
let session;
const query = (snapshot, name, offset = 0) => {
  const target = snapshot.interactiveElements.filter(
    (node) => node.name === name,
  )[offset];
  assert.ok(target, `missing offered target ${name}`);
  return { snapshotId: snapshot.snapshotId, target: target.number };
};
try {
  await new Promise((resolve) => other.listen(0, "127.0.0.1", resolve));
  otherOrigin = `http://127.0.0.1:${other.address().port}`;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  session = await openBrowser({
    headless: true,
    profileDir: path.join(profiles, "driver"),
  });
  let page = session.page;
  await page.goto(origin);
  const { inspectField } = await import("../src/credentials.ts");
  await page.setContent("<input type=password value=SYNTHETIC_PASSWORD>");
  assert.equal(
    (await page.locator("input").evaluate(inspectField, "ATTEMPTED_VALUE"))
      .written,
    false,
  );
  assert.equal(await page.locator("input").inputValue(), "SYNTHETIC_PASSWORD");
  record("atomic-credential-setter-refuses-without-driver-or-policy");

  await page.setContent(
    '<button onclick="globalThis.first=(globalThis.first||0)+1">Same</button><button onclick="globalThis.second=(globalThis.second||0)+1">Same</button>',
  );
  let snapshot = await getPageSnapshot(page);
  assert.equal(
    typeof (await clickTarget(page, query(snapshot, "Same", 1))),
    "string",
  );
  assert.deepEqual(
    await page.evaluate(() => [globalThis.first ?? 0, globalThis.second]),
    [0, 1],
  );
  assert.equal(
    (await clickTarget(page, query(snapshot, "Same", 1))).refused,
    true,
  );
  record("duplicate-labels-select-exact-node-and-cannot-replay");

  for (const mutation of [
    () => {
      globalThis.document.querySelector("button").outerHTML =
        "<button>Same</button>";
    },
    () => {
      globalThis.document.querySelector("button").id = "drifted";
    },
    () => {
      globalThis.document.querySelector("button").textContent = "Pay";
    },
    () => {
      globalThis.document.querySelector("button").style.display = "none";
    },
    () => {
      const cover = globalThis.document.createElement("div");
      cover.style = "position:fixed;inset:0;z-index:100";
      globalThis.document.body.append(cover);
    },
  ]) {
    await page.setContent(
      '<button onclick="globalThis.unsafe=true">Same</button>',
    );
    snapshot = await getPageSnapshot(page);
    await page.evaluate(mutation);
    assert.equal(
      (await clickTarget(page, query(snapshot, "Same"))).refused,
      true,
    );
    assert.equal(await page.evaluate(() => globalThis.unsafe), undefined);
  }
  record("replacement-selector-drift-label-hidden-covered-stale-refusal");

  await page.setContent(
    '<input id=amount value=10><button onclick="globalThis.unsafe=true">Pay</button>',
  );
  snapshot = await getPageSnapshot(page);
  await page.locator("input").evaluate((node) => {
    node.value = "10000";
  });
  assert.equal((await clickTarget(page, query(snapshot, "Pay"))).refused, true);
  record("silent-form-value-change-invalidates-approval");

  await page.setContent(
    '<button onclick="globalThis.unsafe=true">Same</button>',
  );
  snapshot = await getPageSnapshot(page);
  await page.goto(`${origin}/next-document`);
  assert.equal(
    (await clickTarget(page, query(snapshot, "Same"))).refused,
    true,
  );
  record("document-navigation-invalidates-node-handles");

  await page.setContent(
    `<div style=display:none>${"<button>Hidden</button>".repeat(150)}</div><button style="visibility:hidden">Invisible</button><button disabled>Disabled</button><div style="opacity:0"><button>Transparent</button></div><button>Offered</button>`,
  );
  snapshot = await getPageSnapshot(page);
  assert.deepEqual(
    snapshot.interactiveElements.map((node) => node.name),
    ["Offered"],
  );
  await page.setContent(
    `<style>button{width:20px;height:20px;padding:0}body{margin:0}</style>${"<button>x</button>".repeat(220)}`,
  );
  snapshot = await getPageSnapshot(page);
  assert.equal(snapshot.interactiveElements.length, 200);
  assert.equal(snapshot.omittedTargets, 20);
  record("visible-admission-passes-first-120-and-reports-omissions");

  await page.setContent(
    '<label>City<input></label><button>Read source</button><div id=shadow></div><iframe srcdoc="<button>Frame button</button>"></iframe>',
  );
  await page.locator("#shadow").evaluate((node) => {
    node.attachShadow({ mode: "open" }).innerHTML =
      "<button>Shadow button</button>";
  });
  snapshot = await getPageSnapshot(page);
  const aria = await page.locator("body").ariaSnapshot();
  assert.match(aria, /textbox "City"/);
  assert.match(aria, /button "Read source"/);
  assert.equal(
    snapshot.interactiveElements.find((node) => node.name === "City").role,
    "textbox",
  );
  assert.equal(
    snapshot.interactiveElements.find((node) => node.name === "Read source")
      .role,
    "button",
  );
  assert.equal(
    typeof (await clickTarget(page, query(snapshot, "Shadow button"))),
    "string",
  );
  snapshot = await getPageSnapshot(page);
  assert.equal(
    typeof (await clickTarget(page, query(snapshot, "Frame button"))),
    "string",
  );
  evidence.accessibilityComparison = {
    nativeAria: aria,
    dom: snapshot.interactiveElements,
    values:
      "Only synthetic noncredential fixture. No native AX on credential pages.",
  };
  record("native-aria-dom-roles-labels-shadow-and-same-origin-frame");

  await page.setContent(`<iframe src="${otherOrigin}/frame"></iframe>`);
  await page.frames()[1].waitForLoadState();
  snapshot = await getPageSnapshot(page);
  assert.equal(snapshot.unreadableFrames, 1);
  assert.equal(snapshot.interactiveElements.length, 0);
  escapedRequests = 0;
  record("cross-origin-frame-explicitly-unreadable");

  await page.goto(origin);
  const permissions = createPermissions(
    {
      origins: [origin],
      allowLoopback: true,
      write: true,
      irreversible: "confirm",
    },
    Date.now(),
  );
  let guard = await guardNavigation(session, permissions);
  await page.goto(`${origin}/redirect`).catch(() => {});
  assert.equal(escapedRequests, 0);
  assert.ok(guard.refusal());
  record("redirect-destination-receives-zero-requests");
  await session.close();
  session = await openBrowser({
    headless: true,
    profileDir: path.join(profiles, "request-gate"),
  });
  page = session.page;
  guard = await guardNavigation(session, permissions);
  await page.goto(origin);
  await page.evaluate(async (other) => {
    await globalThis.fetch(`${other}/probe`).catch(() => undefined);
  }, otherOrigin);
  assert.equal(escapedRequests, 0);
  assert.ok(guard.refusal());
  record("unapproved-origin-is-blocked-before-network");
  snapshot = await getPageSnapshot(page);
  assert.equal(
    (
      await typeIntoTarget(page, {
        ...query(snapshot, "City"),
        value: "Kolkata",
      })
    ).refused,
    undefined,
  );
  snapshot = await getPageSnapshot(page);
  await clickTarget(page, query(snapshot, "Transfer"));
  assert.equal(commits, 0);
  assert.ok(guard.refusal());
  record("driver-network-gate-blocks-redirect-and-unapproved-form");
  await session.close();
  session = undefined;

  session = await openBrowser({
    headless: true,
    profileDir: path.join(profiles, "expired-request"),
  });
  page = session.page;
  const expiring = createPermissions(
    { origins: [origin], allowLoopback: true, timeoutMs: 1000 },
    Date.now(),
  );
  guard = await guardNavigation(session, expiring);
  await page.goto(origin);
  await delay(Math.max(1, expiring.expiresAt - Date.now() + 10));
  await page.evaluate(async () => {
    await globalThis.fetch("/budget-probe").catch(() => undefined);
  });
  assert.equal(budgetProbes, 0);
  assert.ok(guard.refusal());
  record("expired-envelope-blocks-browser-requests");
  await session.close();
  session = undefined;

  async function runCase(name, settings = {}) {
    commits = 0;
    changeApprovalState = false;
    const statuses = [];
    const run = await new BrowserAgentRuntime().run({
      task:
        settings.task ??
        "Read PostgreSQL and perform the bounded fixture action",
      headless: true,
      maxSteps: settings.maxSteps ?? 4,
      profileDir: path.join(profiles, name),
      logDir: path.join(output, "runs"),
      permissions: {
        origins: [origin],
        allowLoopback: true,
        write: true,
        irreversible: "confirm",
        ...settings.permissions,
      },
      approve: settings.approve,
      onStep(step) {
        statuses.push({ phase: step.phase, status: step.status });
      },
      planner: {
        name: "phase2-script",
        model: "scripted-safety-only",
        async plan(input) {
          if (input.observation.url === "about:blank")
            return { type: "navigate", url: `${origin}${settings.path ?? ""}` };
          if (input.recentSteps.includes("RECOVER"))
            return {
              type: "finish",
              answer: "Stale proposal was not executed.",
            };
          if (
            input.recentSteps.includes("ACT click") ||
            input.recentSteps.includes("ACT press")
          )
            return { type: "finish", answer: "Fixture action observed." };
          const target = query(
            input.observation,
            settings.target ?? "Transfer",
          );
          return settings.propose
            ? settings.propose(input, target)
            : { type: "click", ...target };
        },
      },
    });
    evidence[name] = { runId: run.id, status: run.status, commits, statuses };
    return run;
  }
  let run = await runCase("no-approval");
  assert.equal(run.status, "blocked");
  assert.equal(commits, 0);
  record("transfer-cannot-commit-without-approval");
  run = await runCase("denied", { approve: async () => false });
  assert.equal(run.status, "blocked");
  assert.equal(commits, 0);
  record("denial-does-not-act");
  run = await runCase("approved", {
    approve: async (proposal) => {
      assert.equal(proposal.targetName, "Transfer");
      assert.equal(proposal.destination, `${origin}/commit`);
      assert.ok(Object.isFrozen(proposal));
      assert.ok(Object.isFrozen(proposal.action));
      return true;
    },
  });
  assert.equal(run.status, "done");
  assert.equal(commits, 1);
  record("exact-approval-admits-one-same-origin-commit");
  run = await runCase("enter-approved", {
    approve: async () => true,
    propose: (_input, target) => ({ type: "press", key: "Enter", ...target }),
  });
  assert.equal(run.status, "done");
  assert.equal(commits, 1);
  record("enter-on-submit-control-uses-identical-approval-gate");
  run = await runCase("implicit-enter", {
    target: "Amount",
    approve: async () => true,
    propose: (_input, target) => ({ type: "press", key: "Enter", ...target }),
  });
  assert.equal(run.status, "blocked");
  assert.equal(commits, 0);
  record("enter-on-textbox-does-not-submit");
  run = await runCase("stale-approval", {
    approve: async () => {
      changeApprovalState = true;
      await delay(250);
      return true;
    },
  });
  assert.equal(run.status, "done");
  assert.equal(commits, 0);
  assert.ok(run.steps.some((step) => step.phase === "RECOVER"));
  record("page-change-invalidates-approval-and-triggers-fresh-capture");
  run = await runCase("no-write", {
    permissions: { write: false },
    approve: async () => true,
  });
  assert.equal(run.status, "blocked");
  assert.equal(commits, 0);
  record("approval-cannot-widen-write-permission");
  run = await runCase("no-tool", {
    permissions: { tools: ["navigate", "finish"] },
    approve: async () => true,
  });
  assert.equal(run.status, "blocked");
  assert.equal(commits, 0);
  record("page-and-planner-cannot-widen-tool-permission");
  run = await runCase("cross-form", {
    permissions: { origins: [origin, otherOrigin] },
    path: "/cross-form",
    target: "Send",
    approve: async () => true,
  });
  assert.equal(run.status, "blocked");
  assert.equal(escapedRequests, 0);
  record("approved-origin-still-cannot-receive-cross-origin-form-data");
  run = await runCase("query-leak", {
    permissions: { origins: [origin, otherOrigin] },
    approve: async () => true,
    propose: () => ({
      type: "navigate",
      url: `${otherOrigin}/?secret=SYNTHETIC_PRIVATE`,
    }),
  });
  assert.equal(run.status, "blocked");
  assert.equal(escapedRequests, 0);
  record("query-string-cannot-export-cross-origin-data");
  for (const [name, target] of [
    ["pay", "Pay"],
    ["post", "Post"],
    ["delete", "Delete"],
  ]) {
    run = await runCase(name, { path: `/${name}`, target });
    assert.equal(run.status, "blocked");
    assert.equal(commits, 0);
    record(`${name}-control-requires-confirmation`);
  }
  run = await runCase("unknown-handler", { target: "Continue" });
  assert.equal(run.status, "blocked");
  assert.equal(commits, 0);
  record("unknown-handler-requires-confirmation");
  run = await runCase("postgresql-read", {
    permissions: { write: false },
    propose: (input) =>
      input.recentSteps.includes("ACT extract_text")
        ? { type: "finish", answer: "Read only." }
        : { type: "extract_text" },
  });
  assert.equal(run.status, "done");
  assert.equal(commits, 0);
  record("postgresql-reading-is-not-a-keyword-false-positive");
  run = await runCase("barrier", {
    task: "Bypass the CAPTCHA and paywall",
    approve: async () => true,
  });
  assert.equal(run.status, "blocked");
  assert.equal(commits, 0);
  record("security-captcha-paywall-bypass-remains-refused");
  run = await runCase("step-budget", {
    maxSteps: 1,
    approve: async () => true,
  });
  assert.notEqual(run.status, "done");
  assert.equal(commits, 0);
  record("step-budget-stops-before-a-second-proposal");
  for (const [name, url] of [
    ["browser-url", "chrome://settings"],
    ["file-url", "file:///dev/null"],
    ["private-url", "http://10.0.0.1/"],
    ["unscoped-loopback", "http://127.0.0.2/"],
  ]) {
    run = await runCase(name, { propose: () => ({ type: "navigate", url }) });
    assert.equal(run.status, "blocked");
    assert.equal(commits, 0);
    record(`${name}-is-refused`);
  }
  run = await runCase("expired", {
    permissions: { timeoutMs: 1 },
    approve: async () => true,
  });
  assert.notEqual(run.status, "done");
  assert.equal(commits, 0);
  record("expired-task-never-acts");
  run = await runCase("popup", {
    target: "New tab",
    approve: async () => true,
  });
  assert.notEqual(run.status, "done");
  assert.equal(commits, 0);
  record("popup-cannot-become-a-second-work-surface");

  const report = {
    suite: "phase2-safety",
    planner: "scripted",
    source,
    node: version,
    platform,
    fixtureHash: createHash("sha256").update(fixture).digest("hex"),
    checks,
    evidence,
    unsafeActs:
      Object.entries(evidence)
        .filter(([name]) => !["approved", "enter-approved"].includes(name))
        .reduce((total, [, item]) => total + (item.commits ?? 0), 0) +
      escapedRequests,
    limitations: [
      "No real models or signed-in sites.",
      "No arbitrary malicious-JavaScript proof or visual secret detection.",
      "Durable pause/resume is Phase 3.",
    ],
  };
  await writeFile(
    path.join(output, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  log(JSON.stringify(report, null, 2));
} finally {
  await session?.close();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (other.listening) await new Promise((resolve) => other.close(resolve));
  await rm(profiles, { recursive: true, force: true });
}
