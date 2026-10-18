import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const { BrowserAgentRuntime } = await import(path.resolve("packages/agent/src/index.ts"));
const url = "https://info.cern.ch/hypertext/WWW/TheProject.html";
const results = [];
for (const mode of ["ask", "find", "ask", "find"]) {
  const run = await new BrowserAgentRuntime().run({
    task: mode === "find" ? "Find the People link." : "Quote the heading.",
    ...(mode === "find" ? { findUrl: url } : { askUrl: url }),
    headless: false,
    profileDir: await mkdtemp(path.join(tmpdir(), "chromeclaw-diag-")),
    logDir: await mkdtemp(path.join(tmpdir(), "chromeclaw-diag-log-")),
    permissions: { origins: ["https://info.cern.ch"], timeoutMs: 60000 },
    planner: { name: "diag", model: "plumbing-only", async plan({ observation }) {
      if (mode === "find") {
        const link = observation.interactiveElements.find((n) => n.text === "People");
        return { type: "finish", answer: "People link", pageFind: { outcome: "matches", confidence: 1, matches: [{ snapshotId: observation.snapshotId, target: link.number, reason: "People" }] } };
      }
      const passage = observation.passages.find((p) => p.text === "World Wide Web");
      return { type: "finish", answer: passage.text, evidence: [{ snapshotId: observation.snapshotId, passageId: passage.id, quote: passage.text }] };
    } },
  });
  results.push({ mode, status: run.status, error: run.error, warnings: run.warnings });
}
console.log(JSON.stringify(results));
