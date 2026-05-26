#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import { Command } from "commander";
import { BrowserAgentRuntime, JsonlRunStore } from "@chromeclaw/agent";
import { buildReport, evalTasks, scoreRun } from "@chromeclaw/evals";
import type { AgentRun, AgentStep } from "@chromeclaw/shared";

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
  .option(
    "--provider <provider>",
    "mock, openai, openai-compatible, local, huggingface, hf, anthropic",
    process.env.CHROMECLAW_PROVIDER ?? "mock"
  )
  .option("--model <model>", "model name", process.env.CHROMECLAW_MODEL ?? "mock-browser-operator")
  .option("--log-dir <path>", "directory for JSONL run logs", ".chromeclaw/runs")
  .action(async (task, options) => {
    printHeader();
    console.log(pc.dim("Task"));
    console.log(task);
    console.log("");

    const runtime = new BrowserAgentRuntime();
    const run = await runtime.run({
      task,
      headless: Boolean(options.headless),
      maxSteps: Number(options.maxSteps),
      provider: options.provider,
      model: options.model,
      logDir: options.logDir,
      screenshotsDir: ".chromeclaw/screenshots",
      onStep: (step) => printStep(step)
    });

    printRunSummary(run, options.logDir);
  });

program
  .command("repl")
  .description("start an interactive ChromeClaw session")
  .option("--headless", "run Chrome headless")
  .option("--max-steps <number>", "maximum agent steps", "20")
  .option("--provider <provider>", "planner provider", process.env.CHROMECLAW_PROVIDER ?? "mock")
  .option("--model <model>", "model name", process.env.CHROMECLAW_MODEL ?? "mock-browser-operator")
  .action(async (options) => {
    printHeader();
    console.log(pc.dim("Interactive mode. Type a task or `exit` to quit.\n"));
    const rl = readline.createInterface({ input, output });
    const runtime = new BrowserAgentRuntime();

    while (true) {
      const task = await rl.question(pc.cyan("chromeclaw> "));
      if (!task || ["exit", "quit"].includes(task.trim().toLowerCase())) break;

      console.log("");
      const run = await runtime.run({
        task,
        headless: Boolean(options.headless),
        maxSteps: Number(options.maxSteps),
        provider: options.provider,
        model: options.model,
        screenshotsDir: ".chromeclaw/screenshots",
        onStep: (step) => printStep(step)
      });
      printRunSummary(run, ".chromeclaw/runs");
      console.log("");
    }

    rl.close();
  });

program
  .command("runs")
  .description("list recent ChromeClaw runs")
  .option("--log-dir <path>", "directory for JSONL run logs", ".chromeclaw/runs")
  .option("--limit <number>", "maximum runs to show", "10")
  .action(async (options) => {
    printHeader();
    const store = new JsonlRunStore(options.logDir);
    const runs = (await store.listRuns()).slice(0, Number(options.limit));

    if (!runs.length) {
      console.log(pc.dim("No runs found yet."));
      return;
    }

    for (const run of runs) {
      const summary = `${formatStatus(run.status)} ${pc.bold(run.id)} ${pc.dim(formatTimestamp(run.startedAt))}`;
      const detail = `${run.steps.length} steps  ${run.provider}/${run.model}`;
      console.log(summary);
      console.log(`  ${pc.dim(detail)}`);
      console.log(`  ${truncate(run.task, 110)}`);
      console.log("");
    }
  });

program
  .command("show")
  .argument("<run-id>", "run id to inspect")
  .description("show the full trace for one ChromeClaw run")
  .option("--log-dir <path>", "directory for JSONL run logs", ".chromeclaw/runs")
  .action(async (runId, options) => {
    printHeader();
    const store = new JsonlRunStore(options.logDir);
    const run = await store.readRun(runId);
    if (!run) {
      console.error(pc.red(`Run not found: ${runId}`));
      process.exitCode = 1;
      return;
    }

    console.log(`${pc.bold("Task")} ${run.task}`);
    console.log(`${pc.bold("Status")} ${formatStatus(run.status)}   ${pc.bold("Provider")} ${run.provider}/${run.model}`);
    console.log(`${pc.bold("Started")} ${formatTimestamp(run.startedAt)}`);
    if (run.completedAt) {
      console.log(`${pc.bold("Completed")} ${formatTimestamp(run.completedAt)}`);
    }
    console.log("");

    for (const step of run.steps) {
      printStep(step);
    }

    printRunSummary(run, options.logDir);
  });

program
  .command("eval")
  .option("--all", "run all benchmark tasks")
  .option("--headed", "show browser during eval")
  .action(async (options) => {
    printHeader();
    const runtime = new BrowserAgentRuntime();
    const selected = options.all ? evalTasks : evalTasks.slice(0, 3);
    const results = [];

    for (const task of selected) {
      console.log(`${pc.bold("EVAL")} ${task.id}`);
      console.log(`${pc.dim(task.task)}`);
      const run = await runtime.run({
        task: task.task,
        maxSteps: task.maxSteps,
        headless: !options.headed,
        provider: process.env.CHROMECLAW_PROVIDER ?? "mock",
        logDir: ".chromeclaw/eval-runs",
        screenshotsDir: ".chromeclaw/screenshots",
        onStep: (step) => printStep(step)
      });
      const result = scoreRun(task, run);
      results.push(result);
      console.log(`${pc.dim("Result")} ${result.success ? pc.green("PASS") : pc.red("FAIL")}  ${result.steps} steps\n`);
    }

    console.log(JSON.stringify(buildReport(results), null, 2));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function printHeader(): void {
  console.log(pc.cyan(logo));
  console.log(pc.dim("Terminal-first browser control, traces, and evals.\n"));
}

function printStep(step: AgentStep): void {
  const phase = formatPhase(step.phase);
  const action = step.action ? step.action.type : step.status;
  const duration = step.durationMs ? `${step.durationMs}ms` : "--";

  console.log(`${phase} ${pc.bold(`#${step.index}`)} ${pc.dim(action)} ${pc.dim(duration)}`);
  if (step.thoughtSummary) {
    console.log(`  ${pc.dim("reason")} ${step.thoughtSummary}`);
  }
  if (step.action) {
    console.log(`  ${pc.dim("action")} ${summarizeAction(step.action)}`);
  }
  if (step.observation?.title || step.observation?.url) {
    console.log(`  ${pc.dim("page")} ${step.observation.title} ${pc.dim(step.observation.url)}`);
  }
  if (step.error) {
    console.log(`  ${pc.red("error")} ${step.error}`);
  }
  console.log("");
}

function printRunSummary(run: AgentRun, logDir: string): void {
  console.log(pc.bold("Final"));
  console.log(`${formatStatus(run.status)} ${run.finalAnswer ?? run.error ?? "No answer"}`);
  console.log(pc.dim(`Run id: ${run.id}`));
  console.log(pc.dim(`Trace: ${logDir}/${run.id}.jsonl`));
}

function formatPhase(phase: AgentStep["phase"]): string {
  switch (phase) {
    case "DONE":
      return pc.green(phase);
    case "ERROR":
      return pc.red(phase);
    case "ACT":
      return pc.yellow(phase);
    default:
      return pc.cyan(phase);
  }
}

function formatStatus(status: AgentRun["status"]): string {
  switch (status) {
    case "done":
      return pc.green(status.toUpperCase());
    case "blocked":
    case "failed":
      return pc.red(status.toUpperCase());
    case "waiting":
      return pc.yellow(status.toUpperCase());
    default:
      return pc.cyan(status.toUpperCase());
  }
}

function summarizeAction(action: AgentStep["action"]): string {
  if (!action) return "none";
  switch (action.type) {
    case "navigate":
      return action.url;
    case "search_web":
      return action.query;
    case "click":
      return action.selector ?? action.text ?? action.name ?? action.role ?? "target";
    case "type":
      return `${action.selector ?? action.target ?? "target"} <= ${truncate(action.text, 60)}`;
    case "press":
      return action.key;
    case "wait":
      return `${action.ms}ms`;
    case "scroll":
      return `${action.direction} ${action.amount}px`;
    case "ask_user":
      return action.question;
    case "finish":
      return truncate(action.answer, 80);
    case "fail":
      return truncate(action.reason, 80);
    default:
      return action.type;
  }
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
