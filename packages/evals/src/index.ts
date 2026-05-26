#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserAgentRuntime } from "@chromeclaw/agent";
import { buildReport, scoreRun } from "./scoring";
import { evalTasks } from "./tasks";

export * from "./scoring";
export * from "./tasks";

async function main(): Promise<void> {
  const runtime = new BrowserAgentRuntime();
  const selected = process.argv.includes("--all") ? evalTasks : evalTasks.slice(0, 3);
  const results = [];
  const outputRoot = process.env.INIT_CWD ?? process.cwd();

  for (const task of selected) {
    const run = await runtime.run({
      task: task.task,
      maxSteps: task.maxSteps,
      headless: !process.argv.includes("--headed"),
      provider: process.env.CHROMECLAW_PROVIDER ?? "mock",
      logDir: path.join(outputRoot, ".chromeclaw/eval-runs")
    });
    results.push(scoreRun(task, run));
  }

  const report = buildReport(results);
  await mkdir(path.join(outputRoot, ".chromeclaw"), { recursive: true });
  const reportPath = path.resolve(outputRoot, ".chromeclaw/eval-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
