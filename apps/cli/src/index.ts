#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import { BrowserAgentRuntime } from "@chromeclaw/agent";
import { buildReport, evalTasks, scoreRun } from "@chromeclaw/evals";

const logo = [
  "   ________                              ________",
  "  / ____/ /_  _________  ____ ___  ___  / ____/ /___ __      __",
  " / /   / __ \\/ ___/ __ \\/ __ `__ \\/ _ \\/ /   / / __ `/ | /| / /",
  "/ /___/ / / / /  / /_/ / / / / / /  __/ /___/ / /_/ /| |/ |/ /",
  "\\____/_/ /_/_/   \\____/_/ /_/ /_/\\___/\\____/_/\\__,_/ |__/|__/"
].join("\n");

const program = new Command();

program
  .name("chromeclaw")
  .description("ChromeClaw: a transparent browser-control agent for Chrome.")
  .version("0.1.0");

program
  .command("run")
  .argument("<task>", "browser task to run")
  .option("--headless", "run Chrome headless")
  .option("--max-steps <number>", "maximum agent steps", "20")
  .option("--provider <provider>", "mock, openai, openai-compatible, local, anthropic", process.env.CHROMECLAW_PROVIDER ?? "mock")
  .option("--model <model>", "model name", process.env.CHROMECLAW_MODEL ?? "mock-browser-operator")
  .action(async (task, options) => {
    console.log(logo);
    const runtime = new BrowserAgentRuntime();
    const run = await runtime.run({
      task,
      headless: Boolean(options.headless),
      maxSteps: Number(options.maxSteps),
      provider: options.provider,
      model: options.model,
      onStep: (step) => {
        const action = step.action ? `${step.action.type}` : "none";
        console.log(`[${step.phase}] step=${step.index} status=${step.status} action=${action}`);
        if (step.thoughtSummary) console.log(`  plan: ${step.thoughtSummary}`);
        if (step.error) console.log(`  error: ${step.error}`);
      }
    });
    console.log(`\nFinal (${run.status}): ${run.finalAnswer ?? run.error ?? "No answer"}`);
    console.log(`Run log: .chromeclaw/runs/${run.id}.jsonl`);
  });

program.command("repl").description("start an interactive ChromeClaw session").action(async () => {
  console.log(logo);
  const rl = readline.createInterface({ input, output });
  const runtime = new BrowserAgentRuntime();
  while (true) {
    const task = await rl.question("chromeclaw> ");
    if (!task || ["exit", "quit"].includes(task.trim().toLowerCase())) break;
    const run = await runtime.run({
      task,
      provider: process.env.CHROMECLAW_PROVIDER ?? "mock",
      model: process.env.CHROMECLAW_MODEL,
      onStep: (step) => console.log(`[${step.phase}] ${step.action?.type ?? step.status}`)
    });
    console.log(run.finalAnswer ?? run.error ?? "No answer");
  }
  rl.close();
});

program
  .command("eval")
  .option("--all", "run all benchmark tasks")
  .option("--headed", "show browser during eval")
  .action(async (options) => {
    const runtime = new BrowserAgentRuntime();
    const selected = options.all ? evalTasks : evalTasks.slice(0, 3);
    const results = [];
    for (const task of selected) {
      console.log(`EVAL ${task.id}: ${task.task}`);
      const run = await runtime.run({
        task: task.task,
        maxSteps: task.maxSteps,
        headless: !options.headed,
        provider: process.env.CHROMECLAW_PROVIDER ?? "mock",
        logDir: ".chromeclaw/eval-runs"
      });
      const result = scoreRun(task, run);
      results.push(result);
      console.log(`  ${result.success ? "PASS" : "FAIL"} steps=${result.steps} status=${result.status}`);
    }
    console.log(JSON.stringify(buildReport(results), null, 2));
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
