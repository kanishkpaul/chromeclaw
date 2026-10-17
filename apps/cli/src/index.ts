#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import { Command } from "commander";
import { BrowserAgentRuntime, JsonlRunStore } from "@chromeclaw/agent";
import { runEvaluationCli } from "@chromeclaw/evals";
import type { AgentRun, AgentStep } from "@chromeclaw/shared";

const logo = [
  "   ________                              ________",
  "  / ____/ /_  _________  ____ ___  ___  / ____/ /___ __      __",
  " / /   / __ \\/ ___/ __ \\/ __ `__ \\/ _ \\/ /   / / __ `/ | /| / /",
  "/ /___/ / / / /  / /_/ / / / / / /  __/ /___/ / /_/ /| |/ |/ /",
  "\\____/_/ /_/_/   \\____/_/ /_/ /_/\\___/\\____/_/\\__,_/ |__/|__/",
].join("\n");

const program = new Command();

program
  .name("chromeclaw")
  .description("ChromeClaw: a transparent browser-control agent for Chrome.")
  .version("0.1.0");

program
  .command("run")
  .option("--interactive", "wait for answers and exact one-action approvals")
  .option("--allow-commit", "permit asking for consequential action approval")
  .option("--json", "print a single undecorated run object")
  .argument("<task>", "browser task to run")
  .option("--headless", "run Chrome headless")
  .option("--max-steps <number>", "maximum agent steps", "20")
  .option(
    "--origin <origins...>",
    "permitted HTTP(S) origins, fixed before page reads",
    [],
  )
  .option(
    "--write",
    "allow ordinary editing; activations still require confirmation",
  )
  .option(
    "--provider <provider>",
    "mock, openai, openai-compatible, local, huggingface, hf, anthropic",
    process.env.CHROMECLAW_PROVIDER ?? "mock",
  )
  .option(
    "--model <model>",
    "model name",
    process.env.CHROMECLAW_MODEL ?? "mock-browser-operator",
  )
  .option(
    "--log-dir <path>",
    "directory for JSONL run logs",
    ".chromeclaw/runs",
  )
  .action(async (task, options) => {
    if (!options.json) {
      console.log(pc.dim("Task"));
      console.log(task);
      console.log("");
    }

    const runtime = new BrowserAgentRuntime();
    const controls = terminalControls(
      runtime,
      Boolean(options.interactive) && !options.json,
    );
    try {
      const run = await runtime.run({
        ...controls.options,
        task,
        permissions: {
          origins: options.origin,
          write: Boolean(options.write),
          irreversible: options.allowCommit ? "confirm" : "deny",
        },
        headless: Boolean(options.headless),
        maxSteps: Number(options.maxSteps),
        provider: options.provider,
        model: options.model,
        logDir: options.logDir,
        screenshotsDir: ".chromeclaw/screenshots",
        onStep: options.json ? undefined : (step) => printStep(step),
      });
      if (options.json) console.log(JSON.stringify(run));
      else printRunSummary(run, options.logDir);
      process.exitCode = exitStatus(run);
    } finally {
      controls.close();
    }
  });

program
  .command("repl")
  .option("--allow-commit", "permit asking for consequential action approval")
  .description("start an interactive ChromeClaw session")
  .option("--headless", "run Chrome headless")
  .option("--max-steps <number>", "maximum agent steps", "20")
  .option(
    "--origin <origins...>",
    "permitted HTTP(S) origins, fixed before page reads",
    [],
  )
  .option(
    "--write",
    "allow ordinary editing; activations still require confirmation",
  )
  .option(
    "--provider <provider>",
    "planner provider",
    process.env.CHROMECLAW_PROVIDER ?? "mock",
  )
  .option(
    "--model <model>",
    "model name",
    process.env.CHROMECLAW_MODEL ?? "mock-browser-operator",
  )
  .action(async (options) => {
    printHeader(true);
    console.log(pc.dim("Interactive mode. Type a task or `exit` to quit.\n"));
    const rl = readline.createInterface({ input, output });
    const runtime = new BrowserAgentRuntime();

    while (true) {
      const task = await rl.question(pc.cyan("chromeclaw> "));
      if (!task || ["exit", "quit"].includes(task.trim().toLowerCase())) break;

      console.log("");
      const controls = terminalControls(runtime, true, rl);
      try {
        const run = await runtime.run({
          ...controls.options,
          task,
          permissions: {
            origins: options.origin,
            write: Boolean(options.write),
            irreversible: options.allowCommit ? "confirm" : "deny",
          },
          headless: Boolean(options.headless),
          maxSteps: Number(options.maxSteps),
          provider: options.provider,
          model: options.model,
          screenshotsDir: ".chromeclaw/screenshots",
          onStep: (step) => printStep(step),
        });
        printRunSummary(run, ".chromeclaw/runs");
      } finally {
        controls.close();
      }
      console.log("");
    }

    rl.close();
  });

program
  .command("resume")
  .argument("<run-id>", "saved run to recapture and pause before continuing")
  .option("--headless", "run Chrome headless")
  .option("--interactive", "wait for an explicit resume decision")
  .option("--json", "print one undecorated run object")
  .option(
    "--log-dir <path>",
    "directory for JSONL run logs",
    ".chromeclaw/runs",
  )
  .action(async (runId, options) => {
    const runtime = new BrowserAgentRuntime();
    const controls = terminalControls(
      runtime,
      Boolean(options.interactive) && !options.json,
    );
    try {
      const run = await runtime.reopen(runId, {
        ...controls.options,
        headless: Boolean(options.headless),
        logDir: options.logDir,
      });
      if (options.json) console.log(JSON.stringify(run));
      else printRunSummary(run, options.logDir);
      process.exitCode = exitStatus(run);
    } finally {
      controls.close();
    }
  });

program
  .command("runs")
  .description("list recent ChromeClaw runs")
  .option(
    "--log-dir <path>",
    "directory for JSONL run logs",
    ".chromeclaw/runs",
  )
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
  .option(
    "--log-dir <path>",
    "directory for JSONL run logs",
    ".chromeclaw/runs",
  )
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
    console.log(
      `${pc.bold("Status")} ${formatStatus(run.status)}   ${pc.bold("Provider")} ${run.provider}/${run.model}`,
    );
    console.log(`${pc.bold("Started")} ${formatTimestamp(run.startedAt)}`);
    if (run.completedAt) {
      console.log(
        `${pc.bold("Completed")} ${formatTimestamp(run.completedAt)}`,
      );
    }
    console.log("");

    for (const step of run.steps) {
      printStep(step);
    }

    printRunSummary(run, options.logDir);
  });

program
  .command("eval")
  .description("run local browser fixtures with a scripted smoke planner")
  .option("--all", "run every controlled fixture (also the default)")
  .option("--headed", "show browser during eval")
  .option(
    "--inject-failure",
    "verify that the page-state oracle fails on a wrong value",
  )
  .action(async (options) => {
    await runEvaluationCli({
      headed: Boolean(options.headed),
      injectFailure: Boolean(options.injectFailure),
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function printHeader(interactive = false): void {
  if (!interactive || !output.isTTY) return;
  console.log(pc.cyan(logo));
  console.log(pc.dim("Terminal-first browser control, traces, and evals.\n"));
}

function printStep(step: AgentStep): void {
  const phase = formatPhase(step.phase);
  const action = step.action ? step.action.type : step.status;
  const duration = step.durationMs ? `${step.durationMs}ms` : "--";

  console.log(
    `${phase} ${pc.bold(`#${step.index}`)} ${pc.dim(action)} ${pc.dim(duration)}`,
  );
  if (step.thoughtSummary) {
    console.log(`  ${pc.dim("reason")} ${step.thoughtSummary}`);
  }
  if (step.action) {
    console.log(`  ${pc.dim("action")} ${summarizeAction(step.action)}`);
  }
  if (step.observation?.title || step.observation?.url) {
    console.log(
      `  ${pc.dim("page")} ${step.observation.title} ${pc.dim(step.observation.url)}`,
    );
  }
  if (step.error) {
    console.log(`  ${pc.red("error")} ${step.error}`);
  }
  console.log("");
}

function printRunSummary(run: AgentRun, logDir: string): void {
  console.log(pc.bold("Final"));
  console.log(
    `${formatStatus(run.status)} ${run.finalAnswer ?? run.error ?? "No answer"}`,
  );
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
      return `target ${action.target} from ${action.snapshotId}`;
    case "type":
      return `target ${action.target} <= ${truncate(action.text, 60)}`;
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
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function exitStatus(run: AgentRun): number {
  return run.status === "done"
    ? 0
    : run.status === "stopped"
      ? 130
      : ["awaiting-answer", "awaiting-approval", "paused"].includes(run.status)
        ? 2
        : run.status === "uncertain"
          ? 3
          : 1;
}

function terminalControls(
  runtime: BrowserAgentRuntime,
  enabled: boolean,
  existing?: readline.Interface,
) {
  const rl =
    enabled && input.isTTY
      ? (existing ?? readline.createInterface({ input, output }))
      : undefined;
  const abort = new AbortController();
  const stop = () => {
    abort.abort();
    runtime.cancel();
  };
  const command = (line: string) => {
    if (line.trim() === "/pause") runtime.pause();
  };
  process.on("SIGINT", stop);
  rl?.on("line", command);
  const question = async (text: string) =>
    rl ? rl.question(`${text} `, { signal: abort.signal }) : "";
  const options = {
    signal: abort.signal,
    interactive: Boolean(rl),
    ...(rl
      ? {
          answer: async (text: string) =>
            question(`Answer ${JSON.stringify(text)}:`),
          approve: async (
            proposal: import("@chromeclaw/agent").ActionApproval,
          ) => {
            console.log(`╭─ approve once?
│ ${proposal.action.type} ${JSON.stringify(proposal.targetName)}
│ destination ${JSON.stringify(proposal.destination)}
│ ${JSON.stringify(proposal.reason)}
╰─ Inspect Chrome. Type yes to approve; Enter denies.`);
            return (await question("Approve?")) === "yes";
          },
          onState: async (run: AgentRun) => {
            if (run.pending?.kind !== "pause") return;
            if (
              (await question(
                "Paused after fresh capture. Type resume to continue:",
              )) === "resume"
            )
              runtime.respond({
                runId: run.id,
                pendingId: run.pending.id,
                kind: "pause",
              });
            else stop();
          },
        }
      : {}),
  };
  return {
    options,
    close() {
      process.off("SIGINT", stop);
      rl?.off("line", command);
      if (!existing) rl?.close();
    },
  };
}
