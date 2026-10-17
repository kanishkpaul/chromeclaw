import { setTimeout as delay } from "node:timers/promises";
import {
  clickTarget,
  guardNavigation,
  resolveTarget,
  snapshotIsCurrent,
  extractVisibleText,
  getPageSnapshot,
  navigate,
  openBrowser,
  pressKey,
  screenshot,
  scroll,
  typeIntoTarget,
  type BrowserSession,
  type BrowserRefusal,
} from "@chromeclaw/browser";
import {
  createId,
  BrowserActionSchema,
  createPermissions,
  destinationRefusal,
  PrivacyFilter,
  summarizeObservation,
  type PermissionRequest,
  type AgentRun,
  type AgentStep,
  type BrowserAction,
  type BrowserObservation,
  type PendingInput,
  type ActionApproval,
} from "@chromeclaw/shared";
import {
  createPlanner,
  PlannerConfigError,
  resolveRunSettings,
  type Planner,
} from "./llm/index";
import { PlannerReplyError, PlannerTransportError } from "./llm/openai";
import { SafetyPolicy } from "./safety";
import { JsonlRunStore, type RunLogEvent } from "./storage/jsonl";

export type { ActionApproval } from "@chromeclaw/shared";
export type RuntimeReply = { runId: string; pendingId: string } & (
  | { kind: "answer"; answer: string }
  | { kind: "approval"; approved: boolean }
  | { kind: "pause" }
);
export interface AgentRunOptions {
  task: string;
  permissions?: PermissionRequest;
  maxSteps?: number | undefined;
  headless?: boolean | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  baseUrl?: string | undefined;
  responseFormat?: string | undefined;
  requestCost?: number | undefined;
  maxOutputTokens?: number | undefined;
  tokenLimitField?: string | undefined;
  requestTimeoutMs?: number | undefined;
  profileDir?: string | undefined;
  logDir?: string | undefined;
  screenshotsDir?: string | undefined;
  planner?: Planner | undefined;
  interactive?: boolean;
  signal?: AbortSignal;
  sensitiveValues?: readonly string[];
  approve?: (proposal: ActionApproval) => Promise<boolean>;
  answer?: (question: string, session: BrowserSession) => Promise<string>;
  verify?: (
    session: BrowserSession,
    finish: Extract<BrowserAction, { type: "finish" }>,
    run: AgentRun,
  ) => Promise<{ passed: boolean; detail: string }>;
  onEvent?: ((event: RunLogEvent) => void | Promise<void>) | undefined;
  onState?: (run: AgentRun) => void | Promise<void>;
  onStep?:
    | ((step: AgentStep, run: AgentRun) => void | Promise<void>)
    | undefined;
}
class RuntimeFailure extends Error {}
interface PendingReply {
  runId: string;
  pendingId: string;
  kind: RuntimeReply["kind"];
  resolve: (reply: RuntimeReply) => void;
}

/** One active run owns browser input. Pending IDs are one-use capabilities, never model fields. */
export class BrowserAgentRuntime {
  private controller: AbortController | undefined;
  private pending: PendingReply | undefined;
  private pauseRequested = false;
  private safety = new SafetyPolicy();

  respond(reply: RuntimeReply): boolean {
    const pending = this.pending;
    if (
      !pending ||
      pending.runId !== reply.runId ||
      pending.pendingId !== reply.pendingId ||
      pending.kind !== reply.kind
    )
      return false;
    this.pending = undefined;
    pending.resolve(reply);
    return true;
  }
  cancel(): void {
    this.controller?.abort();
  }
  pause(): void {
    this.pauseRequested = true;
  }

  async reopen(
    runId: string,
    options: Omit<AgentRunOptions, "task">,
  ): Promise<AgentRun> {
    const previous = await new JsonlRunStore(options.logDir).readRun(runId);
    if (!previous?.permissions)
      throw new Error("The saved run has no resumable permission envelope.");
    return this.execute(
      {
        ...options,
        task: previous.task,
        provider: options.provider ?? previous.provider,
        model: options.model ?? previous.model,
      },
      previous,
    );
  }
  async run(options: AgentRunOptions): Promise<AgentRun> {
    return this.execute(options);
  }

  private async execute(
    options: AgentRunOptions,
    previous?: AgentRun,
  ): Promise<AgentRun> {
    if (this.controller)
      throw new Error("This runtime already owns an active run.");
    const settings = resolveRunSettings({
      maxSteps: previous?.maxSteps ?? options.maxSteps,
      timeoutMs: options.permissions?.timeoutMs,
      headless: options.headless,
    });
    const maxSteps = settings.maxSteps;
    const permissions = previous?.permissions
      ? Object.freeze({
          ...previous.permissions,
          origins: Object.freeze([...previous.permissions.origins]),
          tools: Object.freeze([...previous.permissions.tools]),
        })
      : createPermissions(
          { ...options.permissions, maxSteps, timeoutMs: settings.timeoutMs },
          Date.now(),
        );
    if (!permissions) throw new Error("No task permissions.");
    let planner = options.planner;
    let privacy = new PrivacyFilter(options.sensitiveValues);
    let plannerTask = options.task;
    const store = new JsonlRunStore(options.logDir);
    const run: AgentRun = previous
      ? {
          ...previous,
          status: "paused",
          steps: [...previous.steps],
          answers: [...(previous.answers ?? [])],
        }
      : {
          id: createId("run"),
          task: options.task,
          status: "observing",
          startedAt: new Date().toISOString(),
          maxSteps,
          permissions,
          // Rejected settings must not become trusted trace identities before parsing.
          provider: planner?.name ?? "unresolved",
          model: planner?.model ?? "unresolved",
          steps: [],
          answers: [],
        };
    run.reservedCost ??= 0;
    delete run.pending;
    delete run.completedAt;
    delete run.finalAnswer;
    delete run.error;
    const controller = new AbortController();
    this.controller = controller;
    this.pauseRequested = Boolean(previous) || this.pauseRequested;
    const deadline = new AbortController();
    const timer = setTimeout(
      () => deadline.abort(),
      Math.max(1, permissions.expiresAt - Date.now()),
    );
    const signal = AbortSignal.any([
      controller.signal,
      deadline.signal,
      ...(options.signal ? [options.signal] : []),
    ]);
    const emit = async (type: RunLogEvent["type"], payload: unknown) => {
      const event: RunLogEvent = privacy.record({
        version: 1,
        type,
        timestamp: new Date().toISOString(),
        runId: run.id,
        payload,
      });
      await store.append(event);
      if (options.onEvent && !signal.aborted)
        await abortable(Promise.resolve(options.onEvent(event)), signal);
    };
    const notify = async () => {
      if (options.onState)
        await abortable(
          Promise.resolve(options.onState(privacy.record(run))),
          signal,
        );
    };
    let session: BrowserSession | undefined;
    let inFlight = false;
    let closeFailure = false;
    const abortBrowser = () => {
      void session?.close().catch(() => {
        closeFailure = true;
      });
    };
    signal.addEventListener("abort", abortBrowser, { once: true });
    const observations = new Map<string, BrowserObservation>();
    const notes: { snapshotId: string; url: string; text: string }[] = run.steps
      .filter((step) => step.action?.type === "extract_text" && step.result)
      .map((step) => ({
        snapshotId: step.beforeId ?? "",
        url: step.observation?.url ?? "",
        text: step.result ?? "",
      }));
    let repeated = "";
    let failures = 0;
    let parseFailures = 0;
    let lastObservation: BrowserObservation | undefined;
    let stage = "startup";
    let activeStepId: string | undefined;
    let stepStartedAt = Date.now();
    const requestInput = async (
      pending: PendingInput,
      automatic?: () => Promise<RuntimeReply>,
    ): Promise<RuntimeReply | undefined> => {
      const waiting = new Promise<RuntimeReply>((resolve) => {
        this.pending = {
          runId: run.id,
          pendingId: pending.id,
          kind: pending.kind,
          resolve,
        };
      });
      run.pending = privacy.record(pending);
      run.finalAnswer =
        pending.kind === "answer"
          ? pending.question
          : pending.kind === "approval"
            ? pending.proposal.reason
            : pending.reason;
      run.status =
        pending.kind === "answer"
          ? "awaiting-answer"
          : pending.kind === "approval"
            ? "awaiting-approval"
            : "paused";
      await emit("state", { status: run.status, pending: run.pending });
      await notify();
      try {
        // The first response wins even when an adapter callback and external control race.
        // An already consumed external response must not open a second approval prompt.
        const automaticReply =
          automatic && this.pending
            ? automatic().then((reply) => {
                this.respond(reply);
                return waiting;
              })
            : waiting;
        let reply =
          automatic || options.interactive || !this.pending
            ? await abortable(Promise.race([waiting, automaticReply]), signal)
            : undefined;
        signal.throwIfAborted();
        if (!reply) return undefined;
        if (
          pending.kind === "answer" &&
          pending.credentialHandback &&
          reply.kind === "answer"
        ) {
          privacy.withhold(reply.answer);
          reply = {
            ...reply,
            answer: "User completed manual hand-back in Chrome.",
          };
        }
        await emit("user_response", {
          pendingId: pending.id,
          kind: reply.kind,
          ...(reply.kind === "answer"
            ? { answer: reply.answer }
            : reply.kind === "approval"
              ? { approved: reply.approved }
              : {}),
        });
        delete run.pending;
        delete run.finalAnswer;
        run.status = "observing";
        await emit("state", { status: run.status });
        return reply;
      } finally {
        this.pending = undefined;
      }
    };
    const saveStep = async (step: AgentStep) => {
      const safe = privacy.record({
        ...step,
        startedAt: new Date(stepStartedAt).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - stepStartedAt,
      });
      run.steps.push(safe);
      await emit("step", { ...safe, observation: undefined });
      if (options.onStep && !signal.aborted)
        await abortable(
          Promise.resolve(options.onStep(safe, privacy.record(run))),
          signal,
        );
    };
    try {
      let configurationError: unknown;
      try {
        if (
          previous &&
          previous.provider !== "mock" &&
          !previous.configuration &&
          !options.planner
        )
          throw new RuntimeFailure(
            "Saved model run has no endpoint record. Start a new bounded task.",
          );
        if (
          previous?.configuration?.mode === "hosted" &&
          previous.configuration.requestCost === null
        )
          throw new RuntimeFailure(
            "Saved hosted run has no request ceiling. Start a new bounded task.",
          );
        planner ??= createPlanner({
          provider: previous?.configuration
            ? previous.provider
            : options.provider,
          model: previous?.configuration ? previous.model : options.model,
          baseUrl: previous?.configuration?.endpoint ?? options.baseUrl,
          responseFormat:
            previous?.configuration?.responseFormat ?? options.responseFormat,
          requestCost:
            previous?.configuration?.requestCost ?? options.requestCost,
          maxOutputTokens:
            previous?.configuration?.maxOutputTokens ?? options.maxOutputTokens,
          tokenLimitField:
            previous?.configuration?.tokenLimitField ?? options.tokenLimitField,
          requestTimeoutMs:
            previous?.configuration?.requestTimeoutMs ??
            options.requestTimeoutMs,
        });
      } catch (error) {
        configurationError = error;
      }
      privacy = new PrivacyFilter([
        ...(options.sensitiveValues ?? []),
        ...(planner?.sensitiveValues ?? []),
      ]);
      // Only declared secrets and provider keys can filter the user's fixed task. A model's
      // later typed value must not erase instructions or requested outcomes from that task.
      plannerTask = privacy.text(options.task);
      if (!previous)
        await emit(
          "run_started",
          Object.fromEntries(
            Object.entries(run).filter(([key]) => key !== "steps"),
          ),
        );
      if (configurationError) throw configurationError;
      if (!planner)
        throw new RuntimeFailure("No validated planner configuration.");
      signal.throwIfAborted();
      run.provider = planner.name;
      run.model = planner.model;
      if (planner.configuration)
        run.configuration = { ...planner.configuration };
      await emit("configuration", {
        provider: run.provider,
        model: run.model,
        configuration: run.configuration,
      });
      if (
        !options.planner &&
        planner.configuration?.mode === "hosted" &&
        (!planner.configuration.requestCost ||
          permissions.maxCost <= 0 ||
          !Number.isSafeInteger(Math.floor(permissions.maxCost * 1000000)))
      )
        throw new RuntimeFailure(
          "Hosted inference requires a positive task cost budget and explicit request ceiling.",
        );
      session = await openBrowser({
        headless: settings.headless,
        profileDir: options.profileDir,
        screenshotsDir: options.screenshotsDir,
      });
      signal.throwIfAborted();
      const browser = session;
      const navigation = await guardNavigation(session, permissions);
      // Reopening never executes a persisted proposal. It loads the last permitted page only,
      // captures fresh handles and asks the user before another planner request.
      if (previous) {
        const url = [...previous.steps]
          .reverse()
          .find(
            (step) =>
              step.observation && step.observation.url !== "about:blank",
          )?.observation?.url;
        if (
          url &&
          !destinationRefusal(url, permissions) &&
          !new URL(url).search &&
          !new URL(url).hash
        )
          await navigate(session.page, url);
      }
      for (let index = run.steps.length; index < maxSteps; index++) {
        signal.throwIfAborted();
        stepStartedAt = Date.now();
        stage = "observe";
        if (Date.now() >= permissions.expiresAt)
          throw new RuntimeFailure("Task time budget exhausted.");
        if (
          !permissions.read ||
          (session.page.url() !== "about:blank" &&
            destinationRefusal(session.page.url(), permissions))
        )
          throw new RuntimeFailure(
            "The current page is outside task read permissions.",
          );
        run.status = "observing";
        lastObservation = await getPageSnapshot(session.page, {
          screenshotsDir: options.screenshotsDir,
        });
        observations.set(lastObservation.snapshotId, lastObservation);
        await emit("observation", lastObservation);
        if (this.pauseRequested) {
          const reply = await requestInput({
            id: createId("pending"),
            kind: "pause",
            reason: previous
              ? "Reopened with a fresh capture. Old approvals are invalid."
              : "Paused before another act.",
          });
          if (!reply) break;
          this.pauseRequested = false;
          continue;
        }
        stage = "plan";
        run.status = "planning";
        let action: BrowserAction;
        try {
          const parsed = BrowserActionSchema.safeParse(
            await abortable(
              planner.plan({
                task: plannerTask,
                observation: privacy.record(lastObservation),
                observationSummary: summarizeObservation(
                  privacy.record(lastObservation),
                ),
                recentSteps: formatRecentSteps(run.steps),
                maxSteps,
                permissions,
                signal,
                answers: run.answers ?? [],
                notes: privacy.record(notes),
                onCrossing: async (crossing) => {
                  if (crossing.estimatedCost === null && !options.planner)
                    return false;
                  const units =
                    Math.round((run.reservedCost ?? 0) * 1000000) +
                    Math.ceil((crossing.estimatedCost ?? 0) * 1000000);
                  if (
                    !Number.isSafeInteger(units) ||
                    units > Math.floor(permissions.maxCost * 1000000)
                  )
                    return false;
                  await emit("crossing", crossing);
                  run.reservedCost = units / 1000000;
                  return true;
                },
                onUsage: (usage) => emit("model_usage", usage),
              }),
              signal,
            ),
          );
          if (!parsed.success)
            throw new PlannerReplyError(
              "Planner reply does not match the strict action contract.",
            );
          action = parsed.data;
          parseFailures = 0;
        } catch (error) {
          if (
            signal.aborted ||
            !(error instanceof PlannerReplyError) ||
            ++parseFailures > 1
          )
            throw error;
          await saveStep(
            makeStep(
              index,
              "RECOVER",
              "observing",
              undefined,
              lastObservation,
              "Reply parsing failed. Return one strict JSON action.",
            ),
          );
          continue;
        }
        if (action.type === "type") privacy.withhold(action.text);
        const stepId = createId("step");
        activeStepId = stepId;
        await emit("proposal", { stepId, action });
        signal.throwIfAborted();
        if (this.pauseRequested) {
          index--;
          continue;
        }
        const assess = () =>
          this.safety.assess(action, {
            task: options.task,
            observation: lastObservation,
            permissions,
            now: Date.now(),
            step: index,
            spent: run.reservedCost ?? 0,
          });
        let gate = assess();
        let approved = false;
        navigation.clear();
        stage = "gate";
        if (
          gate.decision === "block" &&
          gate.reason?.includes("Credential entry")
        ) {
          const pending: PendingInput = {
            id: createId("pending"),
            kind: "answer",
            credentialHandback: true,
            question:
              "Credential entry is refused. Enter it yourself in Chrome, then answer to recapture.",
          };
          const reply = await requestInput(
            pending,
            options.answer
              ? async () => ({
                  runId: run.id,
                  pendingId: pending.id,
                  kind: "answer",
                  answer:
                    (await options.answer?.(pending.question, browser)) ?? "",
                })
              : undefined,
          );
          await emit("gate", { stepId, gate: { ...gate, approved: false } });
          await saveStep(
            makeStep(
              index,
              "ERROR",
              run.status,
              action,
              lastObservation,
              gate.reason,
              { ...gate, approved: false },
              stepId,
            ),
          );
          if (!reply) break;
          if (reply.kind === "answer")
            (run.answers ??= []).push(privacy.text(reply.answer));
          continue;
        }
        if (gate.decision === "confirm") {
          const target =
            "target" in action
              ? lastObservation.interactiveElements.find(
                  (node) => node.number === action.target,
                )
              : undefined;
          const proposal: ActionApproval = Object.freeze({
            action: Object.freeze({ ...action }),
            snapshotId: lastObservation.snapshotId,
            targetName: target?.name ?? "URL navigation",
            destination:
              target?.destination ??
              target?.formDestination ??
              (action.type === "navigate" ? action.url : lastObservation.url),
            reason: gate.reason ?? "Exact approval required.",
          });
          const pending: PendingInput = {
            id: createId("pending"),
            kind: "approval",
            proposal,
          };
          const reply = await requestInput(
            pending,
            options.approve
              ? async () => ({
                  runId: run.id,
                  pendingId: pending.id,
                  kind: "approval",
                  approved:
                    (await options.approve?.(
                      Object.freeze({
                        ...privacy.record(proposal),
                        action: Object.freeze(privacy.record(proposal.action)),
                      }),
                    )) ?? false,
                })
              : undefined,
          );
          if (!reply) {
            await saveStep(
              makeStep(
                index,
                "ERROR",
                run.status,
                action,
                lastObservation,
                "Awaiting exact approval.",
                { ...gate, approved: false },
                stepId,
              ),
            );
            break;
          }
          approved = reply.kind === "approval" && reply.approved;
          const current = assess();
          const bound =
            (await snapshotIsCurrent(session.page, proposal.snapshotId)) &&
            (!("target" in action) ||
              Boolean(await resolveTarget(session.page, action)));
          gate =
            approved && current.decision !== "block" && bound
              ? { decision: "allow" }
              : {
                  decision: "block",
                  reason: !approved
                    ? "The exact action was denied."
                    : "Approval is stale or permissions expired. Capture the page again.",
                };
          if (gate.decision === "allow")
            navigation.authorize(proposal.destination);
        }
        const recordedGate = { ...gate, approved };
        await emit("gate", { stepId, gate: recordedGate });
        if (gate.decision === "block") {
          const stale =
            gate.reason?.includes("Capture the page again") ?? false;
          run.status = stale ? "observing" : "blocked";
          await saveStep(
            makeStep(
              index,
              stale ? "RECOVER" : "ERROR",
              run.status,
              action,
              lastObservation,
              gate.reason ?? "Refused.",
              recordedGate,
              stepId,
            ),
          );
          if (!stale) {
            run.finalAnswer = gate.reason;
            break;
          }
          const key = proposalKey(action);
          failures = key === repeated ? failures + 1 : 1;
          repeated = key;
          if (failures >= 3)
            throw new RuntimeFailure(
              "Three identical unsuccessful proposals. Stopped recovery.",
            );
          continue;
        }
        if (action.type === "ask_user") {
          const credentialHandback =
            /\b(?:password|passcode|otp|credential|api[ -]?key|access[ -]?token|one[ -]?time[ -]?code)\b/i.test(
              action.question,
            );
          const pending: PendingInput = {
            id: createId("pending"),
            kind: "answer",
            question: credentialHandback
              ? "Handle credentials yourself in Chrome, then continue. Do not enter them here."
              : action.question,
            credentialHandback,
          };
          const reply = await requestInput(
            pending,
            options.answer
              ? async () => ({
                  runId: run.id,
                  pendingId: pending.id,
                  kind: "answer",
                  answer:
                    (await options.answer?.(pending.question, browser)) ?? "",
                })
              : undefined,
          );
          await saveStep(
            makeStep(
              index,
              "ACT",
              run.status,
              action,
              lastObservation,
              reply ? "User answer recorded." : "Awaiting user answer.",
              recordedGate,
              stepId,
            ),
          );
          if (!reply) break;
          if (reply.kind === "answer")
            (run.answers ??= []).push(privacy.text(reply.answer));
          continue;
        }
        if (action.type === "finish") {
          const verification = options.verify
            ? await abortable(options.verify(session, action, run), signal)
            : verifyExtractiveAnswer(action, observations);
          run.status = verification.passed ? "done" : "uncertain";
          run.finalAnswer = privacy.text(action.answer);
          if (!verification.passed) run.error = verification.detail;
          await saveStep(
            makeStep(
              index,
              verification.passed ? "DONE" : "ERROR",
              run.status,
              action,
              lastObservation,
              verification.detail,
              recordedGate,
              stepId,
            ),
          );
          break;
        }
        if (action.type === "fail") {
          run.status = "failed";
          run.error = privacy.text(action.reason);
          run.finalAnswer = run.error;
          await saveStep(
            makeStep(
              index,
              "ERROR",
              run.status,
              action,
              lastObservation,
              run.error,
              recordedGate,
              stepId,
            ),
          );
          break;
        }
        signal.throwIfAborted();
        if (this.pauseRequested) {
          index--;
          continue;
        }
        stage = "schedule";
        run.status = "acting";
        await notify();
        signal.throwIfAborted();
        stage = "act";
        await emit("act_started", { stepId, action });
        signal.throwIfAborted();
        inFlight = true;
        run.status = action.type === "wait" ? "waiting" : "acting";
        const execution = await executeAction(session, action, options, signal);
        inFlight = false;
        signal.throwIfAborted();
        const navigationRefusal = navigation.refusal();
        let result = navigationRefusal
          ? { refused: true, reason: navigationRefusal }
          : execution;
        navigation.clear();
        stage = "after-observe";
        const after = await getPageSnapshot(session.page);
        observations.set(after.snapshotId, after);
        await emit("observation", after);
        const possibleCommit =
          action.type === "click" || action.type === "press";
        if (
          possibleCommit &&
          typeof result === "string" &&
          after.url === lastObservation.url &&
          after.visibleText === lastObservation.visibleText
        ) {
          result = {
            refused: true,
            uncertain: true,
            reason:
              "Activation dispatched without observable acknowledgment. Do not repeat it. User judgment required.",
          };
        }
        const finalResult = result;
        const refused = typeof finalResult !== "string";
        const stale =
          refused && finalResult.reason.includes("Capture the page again");
        const uncertain =
          refused &&
          possibleCommit &&
          "uncertain" in finalResult &&
          finalResult.uncertain;
        run.status = uncertain
          ? "uncertain"
          : refused && !stale
            ? "blocked"
            : "observing";
        const step = makeStep(
          index,
          stale ? "RECOVER" : refused ? "ERROR" : "ACT",
          run.status,
          action,
          lastObservation,
          refused ? finalResult.reason : finalResult,
          recordedGate,
          stepId,
        );
        step.afterId = after.snapshotId;
        await saveStep(step);
        if (refused && !stale) {
          run.finalAnswer = finalResult.reason;
          break;
        }
        if (action.type === "extract_text" && !refused)
          notes.push({
            snapshotId: lastObservation.snapshotId,
            url: lastObservation.url,
            text: finalResult,
          });
        const unchanged =
          stale ||
          (action.type === "type" &&
            typeof result === "string" &&
            result.startsWith("No change"));
        if (unchanged) {
          const key = proposalKey(action);
          failures = key === repeated ? failures + 1 : 1;
          repeated = key;
          if (failures >= 3)
            throw new RuntimeFailure(
              "Three identical unsuccessful proposals. Stopped recovery.",
            );
        } else {
          failures = 0;
          repeated = "";
        }
      }
      if (["observing", "planning", "acting", "waiting"].includes(run.status)) {
        run.status = "failed";
        run.error = `Reached max steps (${maxSteps}) without verified completion.`;
        run.finalAnswer = run.error;
      }
    } catch (error) {
      delete run.pending;
      run.status =
        signal.aborted && !deadline.signal.aborted ? "stopped" : "failed";
      run.error = signal.aborted
        ? deadline.signal.aborted
          ? "Task time budget exhausted."
          : `Stopped by user.${inFlight ? " An act was already in flight; side effects may have occurred." : " No new act will be dispatched."}`
        : error instanceof PlannerReplyError ||
            error instanceof PlannerTransportError ||
            error instanceof PlannerConfigError ||
            error instanceof RuntimeFailure
          ? error.message
          : `Failure during ${stage}. Diagnostic details withheld.`;
      run.finalAnswer = run.error;
      try {
        await emit("error", {
          stage,
          message: run.error,
          stepId: activeStepId,
        });
        await saveStep(
          makeStep(
            run.steps.length,
            "ERROR",
            run.status,
            undefined,
            lastObservation,
            run.error,
          ),
        );
      } catch {
        run.error += " Storage also failed; the trace may be incomplete.";
        run.finalAnswer = run.error;
      }
    } finally {
      signal.removeEventListener("abort", abortBrowser);
      clearTimeout(timer);
      const cleanup = new AbortController();
      try {
        // A disconnected driver must not prevent the final failure/stop record indefinitely.
        await Promise.race([
          session?.close(),
          delay(5000, undefined, { signal: cleanup.signal }).then(() => {
            throw new Error("Browser cleanup deadline.");
          }),
        ]);
      } catch {
        closeFailure = true;
      } finally {
        cleanup.abort();
      }
      if (closeFailure) {
        (run.warnings ??= []).push("Browser cleanup failed.");
        if (!run.error) run.error = "Browser cleanup failed.";
      }
      const suspended = [
        "awaiting-answer",
        "awaiting-approval",
        "paused",
      ].includes(run.status);
      if (!suspended) run.completedAt = new Date().toISOString();
      try {
        if (closeFailure)
          await emit("error", {
            stage: "cleanup",
            message: "Browser cleanup failed.",
          });
        if (suspended)
          await emit("run_suspended", {
            status: run.status,
            savedAt: new Date().toISOString(),
            finalAnswer: run.finalAnswer,
            pending: run.pending,
          });
        else
          await emit("run_completed", {
            status: run.status,
            completedAt: run.completedAt,
            finalAnswer: run.finalAnswer,
            error: run.error,
          });
      } catch {
        run.error = `${run.error ?? "Run ended."} Final state could not be stored.`;
        if (run.status === "done") run.status = "failed";
      }
      this.controller = undefined;
      this.pending = undefined;
      this.pauseRequested = false;
    }
    return privacy.record(run);
  }
}

function makeStep(
  index: number,
  phase: AgentStep["phase"],
  status: AgentRun["status"],
  action: BrowserAction | undefined,
  observation: BrowserObservation | undefined,
  result: string,
  gate?: AgentStep["gate"],
  id = createId("step"),
): AgentStep {
  const at = new Date().toISOString();
  return {
    id,
    index,
    phase,
    status,
    action:
      action?.type === "type"
        ? { ...action, text: "[withheld]", thoughtSummary: undefined }
        : action,
    observation,
    beforeId: observation?.snapshotId,
    observationSummary: result,
    result,
    error: phase === "ERROR" || phase === "RECOVER" ? result : undefined,
    ...(gate ? { gate } : {}),
    startedAt: at,
    completedAt: at,
    durationMs: 0,
  };
}
function formatRecentSteps(steps: AgentStep[]): string {
  return steps
    .slice(-6)
    .map(
      (step) =>
        `${step.index}. ${step.phase} ${step.action?.type ?? ""} ${JSON.stringify({ action: step.action, result: step.result, error: step.error, gate: step.gate, before: step.beforeId, after: step.afterId })}`,
    )
    .join("\n");
}
function proposalKey(action: BrowserAction): string {
  return JSON.stringify({
    ...action,
    ...("snapshotId" in action ? { snapshotId: "current" } : {}),
    thoughtSummary: undefined,
  });
}

function verifyExtractiveAnswer(
  action: Extract<BrowserAction, { type: "finish" }>,
  observations: ReadonlyMap<string, BrowserObservation>,
) {
  const references = action.evidence ?? [];
  const supported =
    references.length > 0 &&
    references.some((reference) => reference.quote === action.answer) &&
    references.every((reference) => {
      const source = observations.get(reference.snapshotId);
      return (
        source &&
        (source.visibleText.includes(reference.quote) ||
          source.title === reference.quote)
      );
    });
  return {
    passed: Boolean(supported),
    detail: supported
      ? "Exact extractive answer has captured evidence."
      : "Completion needs a trusted outcome predicate or exact captured answer evidence. User judgment required.",
  };
}
async function abortable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    // A callback may settle after cancellation. Observe its rejection without admitting an act.
    void operation.catch(() => undefined);
    signal.throwIfAborted();
  }
  let abort: () => void = () => undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new Error("Operation interrupted."));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([operation, interrupted]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
async function executeAction(
  session: BrowserSession,
  action: BrowserAction,
  options: AgentRunOptions,
  signal: AbortSignal,
): Promise<string | BrowserRefusal> {
  switch (action.type) {
    case "navigate":
      await navigate(session.page, action.url);
      return `Navigated to ${session.page.url()}`;
    case "search_web":
      await navigate(
        session.page,
        `https://duckduckgo.com/?q=${encodeURIComponent(action.query)}`,
      );
      return "Search requested.";
    case "click":
      return clickTarget(session.page, action);
    case "type":
      return typeIntoTarget(session.page, { ...action, value: action.text });
    case "press":
      return pressKey(session.page, action.key, action);
    case "wait":
      await delay(action.ms, undefined, { signal });
      return `Waited ${action.ms}ms`;
    case "extract_text":
    case "summarize_page":
      return (await extractVisibleText(session.page)).slice(0, 4000);
    case "scroll":
      await scroll(session.page, action.direction, action.amount);
      return `Scrolled ${action.direction} by ${action.amount}px`;
    case "screenshot": {
      const file = await screenshot(session.page, options.screenshotsDir);
      return file
        ? `Screenshot saved to ${file}`
        : "Screenshot withheld on a credential or framed page.";
    }
    default:
      return { refused: true, reason: "This proposal is not a browser act." };
  }
}
