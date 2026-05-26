import {
  clickTarget,
  extractVisibleText,
  getPageSnapshot,
  navigate,
  openBrowser,
  screenshot,
  scroll,
  typeIntoTarget,
  type BrowserSession
} from "@chromeclaw/browser";
import {
  createId,
  summarizeObservation,
  truncateEnd,
  type AgentRun,
  type AgentStatus,
  type AgentStep,
  type BrowserAction,
  type BrowserObservation
} from "@chromeclaw/shared";
import { createPlanner, type Planner } from "./llm/index";
import { SafetyPolicy } from "./safety";
import { JsonlRunStore } from "./storage/jsonl";

export interface AgentRunOptions {
  task: string;
  maxSteps?: number | undefined;
  headless?: boolean | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  profileDir?: string | undefined;
  logDir?: string | undefined;
  screenshotsDir?: string | undefined;
  planner?: Planner | undefined;
  onStep?: ((step: AgentStep, run: AgentRun) => void | Promise<void>) | undefined;
}

export class BrowserAgentRuntime {
  private safety = new SafetyPolicy();

  async run(options: AgentRunOptions): Promise<AgentRun> {
    const maxSteps = options.maxSteps ?? Number(process.env.CHROMECLAW_MAX_STEPS ?? 20);
    const planner = options.planner ?? createPlanner({ provider: options.provider, model: options.model });
    const store = new JsonlRunStore(options.logDir);
    const run: AgentRun = {
      id: createId("run"),
      task: options.task,
      status: "observing",
      startedAt: new Date().toISOString(),
      maxSteps,
      provider: planner.name,
      model: planner.model,
      steps: []
    };

    await store.append({ type: "run_started", timestamp: new Date().toISOString(), runId: run.id, run });

    let session: BrowserSession | undefined;
    let lastObservation: BrowserObservation | undefined;

    try {
      session = await openBrowser({
        headless: options.headless ?? parseBoolean(process.env.CHROMECLAW_HEADLESS, false),
        profileDir: options.profileDir,
        screenshotsDir: options.screenshotsDir
      });

      for (let index = 0; index < maxSteps; index += 1) {
        const stepStarted = Date.now();
        run.status = "observing";
        lastObservation = await getPageSnapshot(session.page, {
          screenshotsDir: options.screenshotsDir
        });
        const observationSummary = summarizeObservation(lastObservation);

        const action = await planner.plan({
          task: options.task,
          observation: lastObservation,
          observationSummary,
          recentSteps: formatRecentSteps(run.steps),
          maxSteps
        });

        const safety = this.safety.assess(action, { task: options.task, observation: lastObservation });
        if (safety.decision === "block" || safety.decision === "confirm") {
          const step = makeStep({
            index,
            phase: "ERROR",
            status: "blocked",
            action,
            observation: lastObservation,
            observationSummary,
            thoughtSummary: action.thoughtSummary,
            error: safety.reason,
            startedAt: stepStarted
          });
          run.steps.push(step);
          run.status = "blocked";
          run.finalAnswer =
            safety.decision === "confirm"
              ? `I need explicit confirmation before continuing: ${safety.reason}`
              : `Blocked by safety policy: ${safety.reason}`;
          await emitStep(store, options, step, run);
          break;
        }

        run.status = action.type === "wait" ? "waiting" : "acting";
        const result = await this.executeAction(session, action, options);
        const status = action.type === "finish" ? "done" : action.type === "fail" ? "failed" : run.status;
        const step = makeStep({
          index,
          phase: action.type === "finish" ? "DONE" : "ACT",
          status,
          action,
          observation: lastObservation,
          observationSummary: result || observationSummary,
          thoughtSummary: action.thoughtSummary,
          startedAt: stepStarted
        });
        run.steps.push(step);
        await emitStep(store, options, step, run);

        if (action.type === "finish") {
          run.status = "done";
          run.finalAnswer = action.answer;
          break;
        }
        if (action.type === "fail") {
          run.status = "failed";
          run.error = action.reason;
          run.finalAnswer = action.reason;
          break;
        }
      }

      if (run.status !== "done" && run.status !== "failed" && run.status !== "blocked") {
        run.status = "failed";
        run.error = `Reached max steps (${maxSteps}) without finish.`;
        run.finalAnswer = run.error;
      }
    } catch (error) {
      run.status = "failed";
      run.error = error instanceof Error ? error.message : String(error);
      run.finalAnswer = run.error;
      const step = makeStep({
        index: run.steps.length,
        phase: "ERROR",
        status: "failed",
        observation: lastObservation,
        error: run.error,
        startedAt: Date.now()
      });
      run.steps.push(step);
      await emitStep(store, options, step, run);
    } finally {
      await session?.close().catch(() => undefined);
      run.completedAt = new Date().toISOString();
      await store.append({ type: "run_completed", timestamp: new Date().toISOString(), runId: run.id, run });
    }

    return run;
  }

  private async executeAction(session: BrowserSession, action: BrowserAction, options: AgentRunOptions): Promise<string> {
    switch (action.type) {
      case "navigate":
        await navigate(session.page, action.url);
        return `Navigated to ${session.page.url()}`;
      case "search_web":
        await navigate(session.page, `https://duckduckgo.com/?q=${encodeURIComponent(action.query)}`);
        return `Searched the web for "${action.query}"`;
      case "click":
        return clickTarget(session.page, action);
      case "type":
        return typeIntoTarget(session.page, {
          selector: action.selector,
          text: action.target,
          name: action.target,
          value: action.text,
          submit: action.submit
        });
      case "press":
        await session.page.keyboard.press(action.key);
        return `Pressed ${action.key}`;
      case "wait":
        await session.page.waitForTimeout(action.ms);
        return `Waited ${action.ms}ms`;
      case "extract_text":
        return truncateEnd(await extractVisibleText(session.page), 2400);
      case "summarize_page":
        return truncateEnd(await extractVisibleText(session.page), 1200);
      case "scroll":
        await scroll(session.page, action.direction, action.amount);
        return `Scrolled ${action.direction} by ${action.amount}px`;
      case "screenshot":
        return `Screenshot saved to ${await screenshot(session.page, options.screenshotsDir)}`;
      case "ask_user":
        return `Needs user input: ${action.question}`;
      case "finish":
        return action.answer;
      case "fail":
        return action.reason;
    }
  }
}

function makeStep(input: {
  index: number;
  phase: AgentStep["phase"];
  status: AgentStatus;
  startedAt: number;
  thoughtSummary?: string | undefined;
  action?: BrowserAction | undefined;
  observation?: BrowserObservation | undefined;
  observationSummary?: string | undefined;
  error?: string | undefined;
}): AgentStep {
  const completed = Date.now();
  return {
    id: createId("step"),
    index: input.index,
    phase: input.phase,
    status: input.status,
    thoughtSummary: input.thoughtSummary,
    action: input.action,
    observation: input.observation,
    observationSummary: input.observationSummary,
    error: input.error,
    startedAt: new Date(input.startedAt).toISOString(),
    completedAt: new Date(completed).toISOString(),
    durationMs: completed - input.startedAt
  };
}

async function emitStep(
  store: JsonlRunStore,
  options: AgentRunOptions,
  step: AgentStep,
  run: AgentRun
): Promise<void> {
  await store.append({ type: "step", timestamp: new Date().toISOString(), runId: run.id, step });
  await options.onStep?.(step, run);
}

function formatRecentSteps(steps: AgentStep[]): string {
  return steps
    .slice(-6)
    .map((step) => `${step.index}. ${step.phase} ${step.action?.type ?? ""} ${step.error ? `ERROR ${step.error}` : ""}`)
    .join("\n");
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes"].includes(value.toLowerCase());
}
