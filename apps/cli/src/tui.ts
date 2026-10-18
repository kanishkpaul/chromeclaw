import { createInterface, clearLine, cursorTo, type Key } from "node:readline";
import { stdin, stdout } from "node:process";
import {
  BrowserAgentRuntime,
  JsonlRunStore,
  openCapturedSource,
  resolvePlannerConfig,
  describePlannerConfig,
  type AgentRunOptions,
  type RuntimeReply,
} from "@chromeclaw/agent";
import {
  createPermissions,
  DiscoverySchema,
  type Discovery,
  ObservationRecordSchema,
  type AgentRun,
  type AgentStep,
} from "@chromeclaw/shared";
import { terminalRows, terminalText, terminalTheme } from "./terminal";

interface TerminalOptions extends Omit<AgentRunOptions, "task"> {
  theme?: string;
  color?: string;
}

/** The terminal owns interaction; the existing runtime remains the only owner of browser acts. */
export async function runTerminal(options: TerminalOptions): Promise<number> {
  if (!stdin.isTTY || !stdout.isTTY || process.env.TERM === "dumb") {
    stdout.write(
      "The TUI needs an interactive terminal. Use run --json or --jsonl for scripts.\n",
    );
    return 2;
  }
  const theme = terminalTheme(process.env, options);
  const { paint, identity } = theme;
  const settings = { ...options };
  const runtime = new BrowserAgentRuntime();
  const store = new JsonlRunStore(options.logDir);
  const rl = createInterface({
    input: stdin,
    output: stdout,
    historySize: 0,
    // Leave time to decode arrow sequences without swallowing the next command after Esc.
    escapeCodeTimeout: 50,
  });
  let closed = false,
    busy = false,
    composing = false;
  let taskLines: string[] = [];
  let current: AgentRun | undefined;
  let running: Promise<void> | undefined;
  let openingSource: Promise<void> | undefined;
  let sourceOpening = false;
  let sourceWindow: Awaited<ReturnType<typeof openCapturedSource>> | undefined;
  let lastProgress = 0;
  let shownPending: string | undefined;
  const columns = () => stdout.columns || 80;
  const row = (
    prefix: string,
    value: string,
    tone: Parameters<typeof paint>[0] = "banner_text",
  ) => {
    // Even source labels and runtime errors are data. Only this renderer supplies ANSI or rows.
    const lines = terminalRows(
      prefix,
      terminalText(value).slice(0, 12000),
      columns(),
    );
    clearLine(stdout, 0);
    cursorTo(stdout, 0);
    stdout.write(lines.map((line) => paint(tone, line)).join("\n") + "\n");
    if (!closed) rl.prompt(true);
  };
  const notice = (text: string) => row("  ", text, "ui_label");
  const data = (label: string, value: unknown) =>
    row(`  ${label} `, JSON.stringify(value) ?? "null");
  const selected = () => describePlannerConfig(resolvePlannerConfig(settings));
  const status = () => {
    const config = selected();
    const model = current?.model ?? config.model;
    const mode = current
      ? (current.configuration?.mode ??
        (current.provider === "mock"
          ? "mock"
          : current.provider === "local-history"
            ? "local"
            : "unknown"))
      : config.mode;
    row(
      " ",
      columns() < 60
        ? `${mode} │ ${current?.status ?? "ready"}`
        : `${model} │ ${mode} │ ${current?.status ?? "ready"} │ reserved USD ${current?.reservedCost ?? 0}`,
      "status_bar_strong",
    );
    row("", "─".repeat(columns()), "input_rule");
  };
  const step = (item: AgentStep) => {
    const action = item.action;
    const detail =
      action?.type === "type"
        ? `target ${action.target}; value withheld`
        : JSON.stringify(action ?? item.status);
    row(
      "  ┊ ",
      `${(action?.type ?? item.phase.toLowerCase()).padEnd(9)} ${detail} · ${item.durationMs ?? 0} ms`,
      item.error ? "ui_error" : "banner_text",
    );
    if (item.error) data("error", item.error);
  };
  const state = (run: AgentRun) => {
    current = run;
    const pending = run.pending;
    if (!pending || pending.id === shownPending) return;
    shownPending = pending.id;
    if (pending.kind === "approval") {
      row("╭─ ", "Approve once? Inspect Chrome before deciding.", "ui_warn");
      data("│ action", pending.proposal.action);
      data("│ target", pending.proposal.targetName);
      data("│ destination", pending.proposal.destination);
      data("│ reason", pending.proposal.reason);
      row(
        "╰─ ",
        `/approve ${pending.id} · /deny or Esc denies · Enter denies`,
        "ui_warn",
      );
    } else if (pending.kind === "answer") {
      data("question", pending.question);
      notice(
        pending.credentialHandback
          ? "Complete the sign-in yourself in Chrome, then /continue. Do not type credentials here."
          : "Reply with /answer followed by your answer.",
      );
    } else
      notice(
        "Paused. Take over in Chrome if needed. /continue recaptures before acting.",
      );
    status();
  };
  const respond = (reply: RuntimeReply) => {
    if (!runtime.respond(reply))
      notice("That pending request is no longer active.");
  };
  const execute = (
    task: string,
    resume = false,
    askUrl?: string,
    findUrl?: string,
    discovery?: Discovery,
  ) => {
    if (sourceOpening) {
      notice("The source window is still opening.");
      return;
    }
    if (sourceWindow?.ok) {
      notice(
        "Close the source window with /close-source before starting work.",
      );
      return;
    }
    busy = true;
    current = undefined;
    lastProgress = 0;
    shownPending = undefined;
    row(" ", `${identity.glyph} ${identity.agent}`, "response_border");
    const runOptions: Omit<AgentRunOptions, "task"> = {
      ...settings,
      askUrl,
      findUrl,
      discovery,
      onProgress: ({ receivedBytes }) => {
        if (receivedBytes - lastProgress >= 512 || lastProgress === 0) {
          lastProgress = receivedBytes;
          row(
            "  ┊ ",
            `receive   model proposal · ${receivedBytes} bytes; not validated`,
            "ui_label",
          );
        }
      },
      interactive: true,
      onState: state,
      onStep: step,
      onEvent: (event) => {
        if (event.type === "discovery") data("research", event.payload);
        if (event.type === "configuration") data("provider", event.payload);
        if (event.type === "crossing") {
          const crossing = event.payload;
          if (
            crossing &&
            typeof crossing === "object" &&
            "destination" in crossing &&
            "requestBytes" in crossing
          )
            row(
              "  ┊ ",
              `send      ${JSON.stringify(crossing.destination)} · ${String(crossing.requestBytes)} bytes`,
              "ui_label",
            );
        }
        if (event.type === "error") data("error", event.payload);
      },
    };
    running = (
      resume
        ? runtime.reopen(task, runOptions)
        : runtime.run({ ...runOptions, task })
    )
      .then((run) => {
        current = run;
        const finish = run.steps.at(-1)?.action;
        if (finish?.type === "finish" && finish.claims)
          data("claims", finish.claims);
        if (finish?.type === "finish" && finish.webFind)
          data("ranked URLs", finish.webFind);
        if (finish?.type === "finish" && finish.evidence)
          data("citations", finish.evidence);
        if (run.findUrl && finish?.type === "finish" && finish.pageFind) {
          if (run.status === "done" && finish.pageFind.outcome === "matches")
            finish.pageFind.matches.forEach((match, index) => {
              const observation = run.steps.at(-1)?.observation;
              const label =
                "target" in match
                  ? observation?.interactiveElements.find(
                      (node) => node.number === match.target,
                    )?.name
                  : observation?.passages?.find(
                      (passage) => passage.id === match.passageId,
                    )?.text;
              data(`match ${index + 1}`, { ...match, label });
            });
          else
            notice(
              run.error ??
                "No validated matches. Narrow the description or capture again.",
            );
        }
        data("result", {
          status: run.status,
          answer: run.finalAnswer,
          error: run.error,
          runId: run.id,
        });
        notice("/history · /trace · /sources · /resume <run-id>");
      })
      .catch((error: unknown) =>
        row(
          "error: ",
          error instanceof Error
            ? error.message
            : "Run failed. Inspect the trace.",
          "ui_error",
        ),
      )
      .finally(() => {
        busy = false;
        status();
      });
  };
  const inspect = async (view: string, argument: string) => {
    if (!current) return notice("Run a task or /resume a saved run first.");
    if (view === "/history") {
      current.steps.forEach(step);
      return;
    }
    const saved = await store.readDetailed(current.id);
    if (saved.kind !== "ok")
      return notice("Trace unavailable. Check the run log directory.");
    if (view === "/trace") {
      // Read the durable filtered record; never dump a browser object or unsanitized page state.
      for (const event of saved.events.slice(-40))
        data(`trace ${event.type}`, event.payload);
      if (saved.events.length > 40)
        notice(
          "Showing the last 40 events. The complete JSONL remains in the log directory.",
        );
      return;
    }
    if (view === "/passage" || view === "/open") {
      const passages = saved.events
        .filter((event) => event.type === "observation")
        .flatMap(
          (event) =>
            ObservationRecordSchema.parse(event.payload).passages ?? [],
        );
      const passage = passages.find((passage) => passage.id === argument);
      if (!passage)
        return notice(
          "Choose a passage ID from the answer citations or /sources.",
        );
      if (view === "/passage") {
        data("passage", passage);
        return;
      }
      if (busy)
        return notice(
          "Pause or finish the active task before opening a source window.",
        );
      if (sourceWindow?.ok) await sourceWindow.close();
      sourceWindow = await openCapturedSource(current.id, argument, {
        logDir: options.logDir,
        headless: options.headless,
      });
      if (sourceWindow.ok) data("opened source", sourceWindow.url);
      else notice(sourceWindow.reason);
      return;
    }
    const sources = saved.events.filter(
      (event) => event.type === "observation",
    );
    if (view === "/sources") {
      sources.forEach((event, index) => {
        const observation = event.payload;
        // Storage has validated payloads; keep narrowing here rather than asserting a page type.
        if (
          observation &&
          typeof observation === "object" &&
          "url" in observation
        )
          data(`source ${index + 1}`, {
            snapshot:
              "snapshotId" in observation
                ? observation.snapshotId
                : "unavailable",
            url: observation.url,
          });
      });
    } else {
      const source = sources[Number(argument) - 1];
      if (!source) return notice("Choose a source number from /sources.");
      data("source", source.payload);
    }
  };
  const help = () =>
    notice(
      "Task + Enter · /research JSON · /find-web JSON · /find-history JSON · /forget RUN-ID · /origins URL ... · /find URL description · /ask URL question · /passage ID · /open ID · /close-source · /compose then /send · /settings · /history · /trace · /sources · /source N · /pause · /continue · /cancel · /resume ID · /quit",
    );
  const handle = (line: string) => {
    if (closed) return;
    const [command = "", ...words] = line.trim().split(/\s+/);
    const argument = words.join(" ");
    const pending = current?.pending;
    // Resolve input at arrival, never queue it across a future approval or another task.
    if (busy && pending) {
      const address = { runId: current?.id ?? "", pendingId: pending.id };
      if (
        (command === "/deny" || line === "\u001b" || !line.trim()) &&
        pending.kind === "approval"
      )
        return respond({ ...address, kind: "approval", approved: false });
      if (command === "/approve" && pending.kind === "approval") {
        if (argument !== pending.id)
          return notice(
            "Copy the current pending ID to approve exactly once, or /deny.",
          );
        return respond({ ...address, kind: "approval", approved: true });
      }
      if (
        command === "/answer" &&
        pending.kind === "answer" &&
        !pending.credentialHandback &&
        argument
      )
        return respond({ ...address, kind: "answer", answer: argument });
      if (command === "/continue" && pending.kind === "pause")
        return respond({ ...address, kind: "pause" });
      if (
        command === "/continue" &&
        pending.kind === "answer" &&
        pending.credentialHandback
      )
        return respond({
          ...address,
          kind: "answer",
          answer: "Completed manually in Chrome.",
        });
    }
    if (command === "/close-source") {
      if (sourceWindow?.ok) {
        const window = sourceWindow;
        sourceWindow = undefined;
        void window
          .close()
          .then(() => notice("Source window closed."))
          .catch(() => notice("Source window cleanup failed."));
      }
      return;
    }
    if (command === "/quit") {
      runtime.cancel();
      rl.close();
      return;
    }
    if (command === "/cancel") {
      runtime.cancel();
      return notice(
        "Cancellation requested; in-flight effects may already have happened.",
      );
    }
    if (command === "/pause") {
      if (busy) runtime.pause();
      return notice(
        busy ? "Pause requested before another act." : "No active task.",
      );
    }
    if (
      [
        "/history",
        "/trace",
        "/sources",
        "/source",
        "/passage",
        "/open",
      ].includes(command)
    ) {
      if (command === "/open") {
        if (sourceOpening || busy)
          return notice("Wait for the active task or source window.");
        sourceOpening = true;
        openingSource = inspect(command, argument)
          .catch(() => notice("Source window could not be opened."))
          .finally(() => {
            sourceOpening = false;
          });
      } else
        void inspect(command, argument).catch(() =>
          notice("Trace could not be read. Check the log directory."),
        );
      return;
    }
    if (command === "/settings") {
      data("settings", selected());
      data("permissions", settings.permissions ?? {});
      return;
    }
    if (command === "/help") return help();
    if (busy)
      return notice(
        "A task is active. Use its pending command, /pause or /cancel.",
      );
    if (command === "/origins") {
      try {
        if (!words.length)
          return notice(
            "Use /origins followed by complete permitted origins for future tasks.",
          );
        const envelope = createPermissions(
          { ...settings.permissions, origins: words },
          Date.now(),
        );
        settings.permissions = {
          ...settings.permissions,
          origins: envelope.origins,
        };
        data("future task origins", envelope.origins);
      } catch {
        notice(
          "Invalid origin scope. Active and saved tasks retain their original permissions.",
        );
      }
      return;
    }
    if (command === "/forget") {
      if (!argument)
        return notice(
          "Use /forget RUN-ID to delete that local run and its retained notes.",
        );
      void store
        .forget(argument)
        .then(() => {
          if (current?.id === argument) current = undefined;
          notice(
            "Run and retained source notes deleted. Original catalog and external copies are unchanged.",
          );
        })
        .catch(() =>
          notice("Run could not be forgotten. Check its ID and log directory."),
        );
      return;
    }
    if (["/research", "/find-web", "/find-history"].includes(command)) {
      try {
        const payload: unknown = JSON.parse(argument);
        const scope = DiscoverySchema.parse(payload);
        if (
          scope.mode !==
          (command === "/research"
            ? "research"
            : command === "/find-web"
              ? "web"
              : "history")
        )
          return notice("Command and explicit discovery mode must agree.");
        const task =
          scope.mode === "history"
            ? `Find in the selected snapshot: ${scope.terms.join(" ")}`
            : scope.queries.join("; ");
        execute(task, false, undefined, undefined, scope);
      } catch {
        notice(
          'Provide discovery JSON: {"mode":"research" or "web","engineUrl":"https://html.duckduckgo.com/html/","queries":["question"],"maxSources":10}; history uses mode/catalog/from/to/terms.',
        );
      }
      return;
    }
    if (command === "/ask" || command === "/find") {
      const [url, ...question] = words;
      if (!url || !question.length)
        return notice(
          `Use ${command} URL followed by a question or description, within the permitted origins.`,
        );
      execute(
        question.join(" "),
        false,
        command === "/ask" ? url : undefined,
        command === "/find" ? url : undefined,
      );
      return;
    }
    if (command === "/resume") {
      if (argument) execute(argument, true);
      else notice("Use /resume followed by a saved run ID.");
      return;
    }
    if (["/provider", "/model", "/endpoint"].includes(command)) {
      const key =
        command === "/provider"
          ? "provider"
          : command === "/model"
            ? "model"
            : "baseUrl";
      const next = { ...settings, [key]: argument };
      try {
        resolvePlannerConfig(next);
        Object.assign(settings, next);
        data("settings", selected());
      } catch (error) {
        notice(
          error instanceof Error ? error.message : "Invalid provider settings.",
        );
      }
      return;
    }
    if (command === "/compose") {
      composing = true;
      taskLines = [];
      rl.setPrompt(paint("prompt", "· "));
      return notice("Compose multiple lines. /send submits; /discard clears.");
    }
    if (composing) {
      if (command === "/discard") {
        composing = false;
        taskLines = [];
        rl.setPrompt(paint("prompt", "❯ "));
        return notice("Draft discarded.");
      }
      if (command === "/send") {
        const task = taskLines.join("\n");
        composing = false;
        taskLines = [];
        rl.setPrompt(paint("prompt", "❯ "));
        if (task.trim()) execute(task);
        return;
      }
      if (taskLines.join("\n").length + line.length > 6000)
        return notice("Draft is limited to 6,000 characters.");
      taskLines.push(line);
      rl.prompt();
      return;
    }
    if (command.startsWith("/"))
      return notice("Unknown command. /help lists controls.");
    if (line.length > 6000)
      return notice(
        "Task input is limited to 6,000 characters. Narrow the request before submitting.",
      );
    if (line.trim()) execute(line);
    else rl.prompt();
  };
  const interrupt = () => {
    if (busy) {
      runtime.cancel();
      notice("Stopping the task; the session will remain open.");
    } else rl.close();
  };
  const escape = (_character: string, key: Key) => {
    const pending = current?.pending;
    if (key.name === "escape" && pending?.kind === "approval" && current)
      respond({
        runId: current.id,
        pendingId: pending.id,
        kind: "approval",
        approved: false,
      });
  };
  const resize = () => status();
  const finished = new Promise<void>((resolve) =>
    rl.once("close", () => {
      closed = true;
      runtime.cancel();
      resolve();
    }),
  );
  rl.on("line", handle);
  rl.on("SIGINT", interrupt);
  process.on("SIGINT", interrupt);
  stdout.on("resize", resize);
  stdin.on("keypress", escape);
  try {
    const banner = identity.banner.split("\n");
    stdout.write(
      (columns() >= Math.max(...banner.map((line) => line.length)) + 4
        ? banner
            .map((line, index) =>
              paint(
                index < 2
                  ? "banner_title"
                  : index < 4
                    ? "banner_accent"
                    : "banner_border",
                line,
              ),
            )
            .join("\n")
        : paint("banner_title", `${identity.glyph} ${identity.agent}`)) + "\n",
    );
    rl.setPrompt(paint("prompt", "❯ "));
    const config = selected();
    row(
      " ",
      `ChromeClaw 0.1.0 · ${config.model} · ${config.mode} · ${config.endpoint ?? "no network"}`,
      "banner_dim",
    );
    help();
    status();
    await finished;
    await running;
    await openingSource;
    if (sourceWindow?.ok) await sourceWindow.close();
    stdout.write(`${identity.goodbye}\n`);
    return 0;
  } finally {
    process.off("SIGINT", interrupt);
    stdout.off("resize", resize);
    stdin.off("keypress", escape);
    rl.close();
  }
}
