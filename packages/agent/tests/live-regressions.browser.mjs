import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import console from "node:console";
const source = process.argv.includes("--source");
const { BrowserAgentRuntime, openCapturedSource } = await import(
  source ? "../src/index.ts" : "../dist/index.js"
);
const output = path.resolve(".chromeclaw/phase8-regressions");
await mkdir(output, { recursive: true });
const execution = await mkdtemp(
  path.join(output, source ? "source-" : "built-"),
);
const profiles = await mkdtemp(
  path.join(tmpdir(), "chromeclaw-live-regression-"),
);
// Stage 6 found one visible text node longer than the 2,000-character passage cap reported
// as complete. Keep the node longer than the cap and the page below every total bound.
const LONG_PARAGRAPH = "Stage six long paragraph sentence. ".repeat(72).trim();
// Stage 6 found legacy CERN markup splitting a linked sentence into unquotable passages and
// naming <A NAME=14> links "14". Preformatted text must keep its exact line breaks.
const STRUCTURE_PAGE =
  '<title>Structure</title><p>The fixture sentence has an <a href="/structure#x">inline\n link</a> inside\n it.</p>' +
  '<p><a name="14" href="/structure#people">People</a></p><pre>Line one\n  Line two</pre>' +
  // Stage 7: RFC HTML styles its title as an inline heading inside <pre>; it must stay a passage.
  '<pre>RFC 0000    <h1 style="display:inline">Inline Preformatted Title</h1>    June 1999\nBody</pre>';
let forbidden = 0;
const foreign = createServer((_request, response) => {
  forbidden++;
  response.end("Forbidden analytics");
});
await new Promise((resolve) => foreign.listen(0, "127.0.0.1", resolve));
const foreignOrigin = `http://127.0.0.1:${foreign.address().port}`;
const server = createServer((request, response) => {
  if (request.url === "/redirect") {
    response.writeHead(302, { location: "/forbidden-target" }).end();
    return;
  }
  if (request.url === "/structure") {
    response.setHeader("content-type", "text/html");
    response.end(STRUCTURE_PAGE);
    return;
  }
  if (request.url === "/long") {
    response.setHeader("content-type", "text/html");
    response.end(`<title>Long passage</title><p>${LONG_PARAGRAPH}</p>`);
    return;
  }
  if (request.url !== "/read") {
    forbidden++;
    response.end("Forbidden asset or redirect target");
    return;
  }
  response.setHeader("content-type", "text/html");
  response.end(
    `<title>Readable documentation</title><link rel="stylesheet" href="/theme.css?v=1"><p>Independent live regression fact: ALDER-82.</p><img src="${foreignOrigin}/analytics"><script>fetch('/telemetry?secret=SYNTHETIC')</script>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const checks = [];
try {
  const run = await new BrowserAgentRuntime().run({
    task: "Quote the independent fact.",
    askUrl: origin + "/read",
    headless: true,
    profileDir: profiles,
    logDir: execution,
    permissions: { origins: [origin], allowLoopback: true, timeoutMs: 60000 },
    planner: {
      name: "regression-oracle",
      model: "plumbing-only",
      async plan({ observation }) {
        const passage = observation.passages.find(
          (item) => item.text === "Independent live regression fact: ALDER-82.",
        );
        assert.ok(passage);
        return {
          type: "finish",
          answer: passage.text,
          evidence: [
            {
              snapshotId: observation.snapshotId,
              passageId: passage.id,
              quote: passage.text,
            },
          ],
        };
      },
    },
  });
  checks.push({
    id: "blocked-passive-assets-do-not-fail-readable-main-document",
    passed: run.status === "done",
    status: run.status,
    error: run.error,
    runId: run.id,
  });
  checks.push({
    id: "query-assets-telemetry-and-foreign-requests-still-blocked",
    passed: forbidden === 0,
    forbidden,
  });
  const reference = run.steps.find((step) => step.action?.type === "finish")
    ?.action.evidence?.[0];
  assert.ok(reference);
  const opened = await openCapturedSource(run.id, reference.passageId, {
    headless: true,
    profileDir: path.join(profiles, "source"),
    logDir: execution,
  });
  checks.push({
    id: "explicit-source-opening-survives-blocked-passive-assets",
    passed: opened.ok,
  });
  if (opened.ok) await opened.close();
  let structure;
  const structured = await new BrowserAgentRuntime().run({
    task: "Quote the preformatted text.",
    askUrl: origin + "/structure",
    headless: true,
    profileDir: path.join(profiles, "structure"),
    logDir: execution,
    permissions: { origins: [origin], allowLoopback: true, timeoutMs: 60000 },
    planner: {
      name: "regression-oracle",
      model: "plumbing-only",
      async plan({ observation }) {
        structure = {
          passages: observation.passages.map((item) => item.text),
          linkNames: observation.interactiveElements.map((node) => node.name),
        };
        const passage = observation.passages.find((item) =>
          item.text.startsWith("Line one"),
        );
        assert.ok(passage);
        return {
          type: "finish",
          answer: passage.text,
          evidence: [
            {
              snapshotId: observation.snapshotId,
              passageId: passage.id,
              quote: passage.text,
            },
          ],
        };
      },
    },
  });
  checks.push({
    id: "sentence-with-inline-link-is-one-passage",
    passed: structure?.passages.includes(
      "The fixture sentence has an inline link inside it.",
    ),
    ...structure,
  });
  checks.push({
    id: "legacy-anchor-name-attribute-is-not-link-name",
    passed: structure?.linkNames.includes("People") === true,
  });
  checks.push({
    id: "inline-heading-inside-preformatted-text-stays-one-passage",
    passed: structure?.passages.includes("Inline Preformatted Title") === true,
  });
  checks.push({
    id: "preformatted-passage-keeps-line-breaks",
    passed:
      structured.status === "done" &&
      structure?.passages.includes("Line one\n  Line two") === true,
    status: structured.status,
  });
  let longCapture;
  const long = await new BrowserAgentRuntime().run({
    task: "Quote the complete paragraph.",
    askUrl: origin + "/long",
    headless: true,
    profileDir: path.join(profiles, "long"),
    logDir: execution,
    permissions: { origins: [origin], allowLoopback: true, timeoutMs: 60000 },
    planner: {
      name: "regression-oracle",
      model: "plumbing-only",
      async plan({ observation }) {
        const passage = observation.passages.find((item) =>
          LONG_PARAGRAPH.startsWith(item.text),
        );
        assert.ok(passage);
        longCapture = {
          omittedPassages: observation.omittedPassages,
          capturedChars: passage.text.length,
          paragraphChars: LONG_PARAGRAPH.length,
        };
        return {
          type: "finish",
          answer: passage.text,
          evidence: [
            {
              snapshotId: observation.snapshotId,
              passageId: passage.id,
              quote: passage.text,
            },
          ],
        };
      },
    },
  });
  checks.push({
    id: "passage-cut-at-node-cap-is-reported-as-omitted",
    passed: longCapture?.omittedPassages === true,
    ...longCapture,
    status: long.status,
  });
  const redirected = await new BrowserAgentRuntime().run({
    task: "Read only the selected redirect page.",
    askUrl: origin + "/redirect",
    headless: true,
    profileDir: path.join(profiles, "redirect"),
    logDir: execution,
    permissions: { origins: [origin], allowLoopback: true, timeoutMs: 60000 },
    planner: {
      name: "must-not-run",
      model: "plumbing-only",
      async plan() {
        throw new Error("Denied main navigation reached planner.");
      },
    },
  });
  checks.push({
    id: "main-document-redirect-still-refuses-without-following",
    passed: redirected.status === "failed" && forbidden === 0,
    status: redirected.status,
    forbidden,
  });
} finally {
  server.closeAllConnections();
  foreign.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => foreign.close(resolve)),
  ]);
  await rm(profiles, { recursive: true, force: true });
  const report = { suite: "live-01-regressions", source, checks };
  await writeFile(
    path.join(execution, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
assert.ok(checks.length === 9 && checks.every((check) => check.passed));
