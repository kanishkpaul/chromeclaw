#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import { runTerminal } from "./tui";
import { Command } from "commander";
import {
  BrowserAgentRuntime,
  JsonlRunStore,
  resolvePlannerConfig,
  describePlannerConfig,
} from "@chromeclaw/agent";
import { runEvaluationCli } from "@chromeclaw/evals";
import type { AgentRun, AgentStep } from "@chromeclaw/shared";

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
  .option("--jsonl", "stream durable events and one final result")
  .argument("<task>", "browser task to run")
  .option("--find <url>", "experimental read-only ranked matches on this page")
  .option("--ask <url>", "read-only passage-grounded question at this page")
  .option("--stream", "receive bounded SSE model replies")
  .option("--headless", "run Chrome headless")
  .option(
    "--allow-loopback",
    "permit explicitly listed loopback browser origins",
  )
  .option("--max-steps <number>", "maximum agent steps")
  .option("--timeout-ms <number>", "task time budget in milliseconds")
  .option("--max-cost <usd>", "total hosted request reservations allowed")
  .option("--base-url <url>", "explicit provider API base URL")
  .option(
    "--request-cost <usd>",
    "declared USD ceiling per hosted request attempt",
  )
  .option("--max-output-tokens <number>", "bound output tokens per request")
  .option("--response-format <format>", "json or explicit llama-schema grammar")
  .option("--token-limit-field <field>", "max_tokens or max_completion_tokens")
  .option("--request-timeout-ms <number>", "deadline for one inference request")
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
    "mock, openai, openai-compatible, local, huggingface, hf",
  )
  .option("--model <model>", "model name")
  .option(
    "--log-dir <path>",
    "directory for JSONL run logs",
    ".chromeclaw/runs",
  )
  .action(async (task, options) => {
    if (options.json && options.jsonl)
      throw new Error("Choose either --json or --jsonl.");
    if (!(options.json || options.jsonl)) {
      const selected = resolvePlannerConfig(providerOptions(options));
      console.log(pc.dim("Task"));
      console.log(
        selected.provider !== "mock" && selected.apiKey
          ? task.split(selected.apiKey).join("[withheld]")
          : task,
      );
      console.log("");
    }

    if (!(options.json || options.jsonl)) printProvider(options);
    const runtime = new BrowserAgentRuntime();
    const controls = terminalControls(
      runtime,
      Boolean(options.interactive) && !(options.json || options.jsonl),
    );
    try {
      const run = await runtime.run({
        ...controls.options,
        task,
        askUrl: options.ask,
        findUrl: options.find,
        permissions: {
          allowLoopback: Boolean(options.allowLoopback),
          maxCost: Number(
            options.maxCost ?? process.env.CHROMECLAW_MAX_COST ?? 0,
          ),
          origins: options.origin,
          write: Boolean(options.write),
          irreversible: options.allowCommit ? "confirm" : "deny",
          ...(options.timeoutMs === undefined
            ? {}
            : { timeoutMs: Number(options.timeoutMs) }),
        },
        headless: options.headless,
        maxSteps:
          options.maxSteps === undefined ? undefined : Number(options.maxSteps),
        ...providerOptions(options),
        logDir: options.logDir,
        screenshotsDir: ".chromeclaw/screenshots",
        onEvent: options.jsonl
          ? (event) => {
              console.log(JSON.stringify(event));
            }
          : undefined,
        onStep:
          options.json || options.jsonl ? undefined : (step) => printStep(step),
      });
      if (options.jsonl) console.log(JSON.stringify({ type: "result", run }));
      else if (options.json) console.log(JSON.stringify(run));
      else printRunSummary(run, options.logDir);
      process.exitCode = exitStatus(run);
    } finally {
      controls.close();
    }
  });

program
  .command("tui")
  .alias("repl")
  .option("--no-stream", "disable SSE for an explicitly selected legacy server")
  .option("--allow-commit", "permit asking for consequential action approval")
  .description("start an interactive ChromeClaw session")
  .option("--headless", "run Chrome headless")
  .option(
    "--allow-loopback",
    "permit explicitly listed loopback browser origins",
  )
  .option("--max-steps <number>", "maximum agent steps")
  .option("--timeout-ms <number>", "task time budget in milliseconds")
  .option("--max-cost <usd>", "total hosted request reservations allowed")
  .option("--base-url <url>", "explicit provider API base URL")
  .option(
    "--request-cost <usd>",
    "declared USD ceiling per hosted request attempt",
  )
  .option("--max-output-tokens <number>", "bound output tokens per request")
  .option("--response-format <format>", "json or explicit llama-schema grammar")
  .option("--token-limit-field <field>", "max_tokens or max_completion_tokens")
  .option("--request-timeout-ms <number>", "deadline for one inference request")
  .option(
    "--origin <origins...>",
    "permitted HTTP(S) origins, fixed before page reads",
    [],
  )
  .option(
    "--write",
    "allow ordinary editing; activations still require confirmation",
  )
  .option("--provider <provider>", "planner provider")
  .option("--model <model>", "model name")
  .option(
    "--log-dir <path>",
    "directory for JSONL run logs",
    ".chromeclaw/runs",
  )
  .option("--theme <mode>", "auto, dark or light", "auto")
  .option("--color <mode>", "auto, always or never", "auto")
  .action(async (options) => {
    process.exitCode = await runTerminal({
      ...providerOptions(options),
      headless: options.headless,
      maxSteps:
        options.maxSteps === undefined ? undefined : Number(options.maxSteps),
      logDir: options.logDir,
      theme: options.theme,
      color: options.color,
      permissions: {
        origins: options.origin,
        allowLoopback: Boolean(options.allowLoopback),
        write: Boolean(options.write),
        irreversible: options.allowCommit ? "confirm" : "deny",
        maxCost: Number(
          options.maxCost ?? process.env.CHROMECLAW_MAX_COST ?? 0,
        ),
        ...(options.timeoutMs === undefined
          ? {}
          : { timeoutMs: Number(options.timeoutMs) }),
      },
    });
  });

program
  .command("config")
  .description("inspect provider selection without network requests or keys")
  .option("--provider <provider>", "explicit provider")
  .option("--model <model>", "explicit model")
  .option("--base-url <url>", "explicit provider API base URL")
  .option(
    "--request-cost <usd>",
    "declared USD ceiling per hosted request attempt",
  )
  .option("--max-output-tokens <number>", "bound output tokens per request")
  .option("--response-format <format>", "json or explicit llama-schema grammar")
  .option("--token-limit-field <field>", "max_tokens or max_completion_tokens")
  .option("--request-timeout-ms <number>", "deadline for one inference request")
  .option("--json", "print one undecorated configuration object")
  .action((options) => {
    const config = describePlannerConfig(
      resolvePlannerConfig(providerOptions(options)),
    );
    if (options.json) console.log(JSON.stringify(config));
    else printProvider(options);
  });

program
  .command("resume")
  .argument("<run-id>", "saved run to recapture and pause before continuing")
  .option("--headless", "run Chrome headless")
  .option("--interactive", "wait for an explicit resume decision")
  .option("--json", "print one undecorated run object")
  .option("--jsonl", "stream durable events and one final result")
  .option(
    "--log-dir <path>",
    "directory for JSONL run logs",
    ".chromeclaw/runs",
  )
  .action(async (runId, options) => {
    if (options.json && options.jsonl)
      throw new Error("Choose either --json or --jsonl.");
    const runtime = new BrowserAgentRuntime();
    const controls = terminalControls(
      runtime,
      Boolean(options.interactive) && !(options.json || options.jsonl),
    );
    try {
      const run = await runtime.reopen(runId, {
        ...controls.options,
        headless: options.headless,
        logDir: options.logDir,
        onEvent: options.jsonl
          ? (event) => {
              console.log(JSON.stringify(event));
            }
          : undefined,
      });
      if (options.jsonl) console.log(JSON.stringify({ type: "result", run }));
      else if (options.json) console.log(JSON.stringify(run));
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
  const finish = run.steps.at(-1)?.action;
  if (
    run.findUrl &&
    run.status === "done" &&
    finish?.type === "finish" &&
    finish.pageFind?.outcome === "matches"
  )
    finish.pageFind.matches.forEach((match, index) =>
      console.log(`  ${index + 1}. ${JSON.stringify(match)}`),
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

function printProvider(options: ProviderOptions): void {
  const config = describePlannerConfig(
    resolvePlannerConfig(providerOptions(options)),
  );
  console.log(
    `${JSON.stringify(config.model)} · ${config.mode} · ${config.endpoint ?? "no network"} · ${config.readiness} · request ceiling USD ${config.requestCost ?? "unset"}`,
  );
}

interface ProviderOptions {
  stream?: boolean;
  provider?: string;
  model?: string;
  baseUrl?: string;
  responseFormat?: string;
  requestCost?: string;
  maxOutputTokens?: string;
  tokenLimitField?: string;
  requestTimeoutMs?: string;
}
function providerOptions(options: ProviderOptions) {
  return {
    stream: options.stream,
    provider: options.provider,
    model: options.model,
    baseUrl: options.baseUrl,
    responseFormat: options.responseFormat,
    requestCost:
      options.requestCost === undefined
        ? undefined
        : Number(options.requestCost),
    maxOutputTokens:
      options.maxOutputTokens === undefined
        ? undefined
        : Number(options.maxOutputTokens),
    tokenLimitField: options.tokenLimitField,
    requestTimeoutMs:
      options.requestTimeoutMs === undefined
        ? undefined
        : Number(options.requestTimeoutMs),
  };
}
