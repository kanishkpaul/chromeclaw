import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { setTimeout } from "node:timers";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const browser = process.argv.includes("--source")
  ? await import("../src/index.ts")
  : await import("../dist/index.js");
const { createPermissions } = await import("../../shared/dist/index.js");
const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-readers-"));
const output = path.resolve(".chromeclaw/phase7-readers");
await mkdir(output, { recursive: true });
const requests = [];
const held = [];
let readers, session, release;
let ready = new Promise((resolve) => {
  release = resolve;
});
const server = createServer((request, response) => {
  requests.push({ method: request.method, url: request.url });
  if (request.url.startsWith("/held")) {
    held.push(response);
    if (held.length === 5) release();
    return;
  }
  if (request.url === "/redirect") {
    response.writeHead(302, { location: "/redirect-target" });
    return response.end();
  }
  if (request.url === "/missing") {
    response.writeHead(404);
    return response.end("Missing");
  }
  response.setHeader("content-type", "text/html");
  response.end(`<p>Independent fixture fact: cobalt has atomic number 27.</p>
    <input value="PRIVATE-FORM-VALUE"><script>fetch('/unsafe?secret=PRIVATE'); window.open('/popup')</script>
    <img src="/unsafe?secret=image"><iframe src="/frame"></iframe>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const checks = [];
const passed = (id) => checks.push({ id, passed: true });
try {
  session = await browser.openBrowser({ headless: true, profileDir: profiles });
  const foreground = session.page;
  const permissions = createPermissions(
    { origins: [origin], allowLoopback: true, timeoutMs: 60000 },
    Date.now(),
  );
  readers = browser.createSourceReaders(session, permissions);
  await browser.guardNavigation(session, permissions, readers);
  const signal = new globalThis.AbortController().signal;
  const batch = Array.from({ length: 5 }, (_, index) =>
    readers.read(`${origin}/held${index}`, signal),
  );
  await Promise.race([
    ready,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Five readers did not arrive")),
        10000,
      ).unref(),
    ),
  ]);
  assert.equal(session.page, foreground);
  assert.equal(session.context.pages().length, 6);
  const unowned = await session.context.newPage();
  if (!unowned.isClosed())
    await unowned.waitForEvent("close", { timeout: 5000 });
  assert.equal(session.context.pages().length, 6);
  passed("unowned-page-cannot-borrow-pending-reader-admission");
  const excess = await readers.read(`${origin}/sixth`, signal);
  assert.equal(excess.kind, "refused");
  assert.equal(
    requests.some((request) => request.url === "/sixth"),
    false,
  );
  held
    .splice(0)
    .forEach((response) => response.end("<p>Known concurrent fact.</p>"));
  assert.ok(
    (await Promise.all(batch)).every((result) => result.kind === "read"),
  );
  assert.equal(session.context.pages().length, 1);
  passed("five-concurrent-readers-preserve-foreground-and-refuse-sixth");

  const captured = await readers.read(`${origin}/source`, signal);
  assert.equal(captured.kind, "read");
  assert.ok(
    captured.passages.some((passage) =>
      passage.text.includes("cobalt has atomic number 27"),
    ),
  );
  assert.equal(JSON.stringify(captured).includes("PRIVATE-FORM-VALUE"), false);
  assert.equal(
    requests.some((request) => /unsafe|popup|frame/.test(request.url)),
    false,
  );
  passed(
    "passages-exclude-values-and-block-inline-script-query-and-frame-requests",
  );
  assert.equal(
    (await readers.read(`${origin}/source#another`, signal)).kind,
    "refused",
  );
  assert.equal(
    (await readers.read(`${origin}/query?secret=private`, signal)).kind,
    "refused",
  );
  assert.equal(
    (await readers.read("https://example.com/", signal)).kind,
    "refused",
  );
  passed("canonical-deduplication-query-and-unpermitted-origin-refusal");
  assert.equal(
    (await readers.read(`${origin}/redirect`, signal)).kind,
    "refused",
  );
  assert.equal(
    requests.some((request) => request.url === "/redirect-target"),
    false,
  );
  assert.equal(
    (await readers.read(`${origin}/missing`, signal)).kind,
    "refused",
  );
  passed("redirect-and-missing-source-failures-stay-local");

  ready = new Promise((resolve) => {
    release = resolve;
  });
  const controller = new globalThis.AbortController();
  const pending = readers.read(`${origin}/held-cancel`, controller.signal);
  const arrivalDeadline = Date.now() + 5000;
  while (held.length === 0 && Date.now() < arrivalDeadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(held.length, 1);
  controller.abort();
  assert.equal((await pending).kind, "refused");
  assert.equal(session.context.pages().length, 1);
  held.splice(0).forEach((response) => response.end());
  passed("cancellation-closes-only-the-source-tab");
  for (let index = 0; index < 11; index++)
    assert.equal(
      (await readers.read(`${origin}/budget${index}`, signal)).kind,
      "read",
    );
  assert.equal(
    (await readers.read(`${origin}/over-budget`, signal)).kind,
    "refused",
  );
  assert.equal(
    requests.some((request) => request.url === "/over-budget"),
    false,
  );
  passed("twenty-source-budget-does-not-reset-after-batches");
  await readers.close();
  assert.equal(
    (await readers.read(`${origin}/after-close`, signal)).kind,
    "refused",
  );
  assert.equal(foreground.isClosed(), false);
  passed("revocation-refuses-further-reads-and-preserves-foreground");
  const expired = browser.createSourceReaders(
    session,
    createPermissions(
      { origins: [origin], allowLoopback: true, timeoutMs: 1 },
      Date.now() - 10,
    ),
  );
  assert.equal(
    (await expired.read(`${origin}/expired`, signal)).kind,
    "refused",
  );
  await expired.close();
  passed("expiry-refuses-before-source-creation");
  for (const scope of [{ read: false }, { tools: ["finish"] }]) {
    const limited = browser.createSourceReaders(
      session,
      createPermissions(
        { origins: [origin], allowLoopback: true, ...scope },
        Date.now(),
      ),
    );
    assert.equal(
      (await limited.read(`${origin}/no-authority`, signal)).kind,
      "refused",
    );
    await limited.close();
  }
  assert.equal(
    requests.some((request) => request.url === "/no-authority"),
    false,
  );
  passed("read-and-navigation-authority-required-before-creation");
} finally {
  await readers?.close();
  await session?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
  await writeFile(
    path.join(
      output,
      process.argv.includes("--source") ? "source.json" : "compiled.json",
    ),
    JSON.stringify({ checks, requests }, null, 2) + "\n",
  );
}
console.log(JSON.stringify({ checks }));
