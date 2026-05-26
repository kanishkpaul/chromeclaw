"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, CircleStop, Compass, FileClock, Play, Radar, RefreshCw, Terminal } from "lucide-react";
import clsx from "clsx";
import type { AgentRun, AgentStep } from "@chromeclaw/shared";
import { useChromeClawStore } from "@/lib/store";

const samples = [
  "Find the top 5 recent papers on browser agents and summarize them",
  "Open Hacker News and find the highest-ranked AI story",
  "Compare prices for a product across 3 sites without logging in",
  "Extract the headings from this webpage",
  "Find documentation for Playwright accessibility snapshots"
];

export function ChromeClawConsole() {
  const { task, setTask, activeRun, setRun, runs, setRuns, isRunning, setRunning, error, setError } = useChromeClawStore();
  const abortRef = useRef<AbortController | null>(null);
  const [provider, setProvider] = useState("mock");
  const metrics = useMemo(() => buildMetrics(activeRun), [activeRun]);
  const lastObservation = getLastObservation(activeRun);

  useEffect(() => {
    void refreshRuns(setRuns);
  }, [setRuns]);

  async function startRun() {
    setError(undefined);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, provider, maxSteps: 20, headless: false }),
        signal: controller.signal
      });
      const payload = (await response.json()) as AgentRun | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Run failed");
      setRun(payload);
      await refreshRuns(setRuns);
    } catch (runError) {
      if ((runError as Error).name !== "AbortError") setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stopRun() {
    abortRef.current?.abort();
    setRunning(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(70,214,200,0.12),transparent_28%),linear-gradient(180deg,#080a0f,#0a0d13_42%,#07090d)] text-claw-text">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4 lg:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-claw-line pb-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-claw-line bg-claw-panel">
                <Bot className="h-5 w-5 text-claw-cyan" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-normal">ChromeClaw</h1>
                <p className="text-sm text-claw-muted">A transparent browser-control agent for Chrome.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <StatusPill status={activeRun?.status ?? (isRunning ? "planning" : "idle")} />
            <span className="border border-claw-line px-3 py-2 text-claw-muted">provider:{provider}</span>
          </div>
        </header>

        <section className="grid flex-1 gap-4 xl:grid-cols-[390px_minmax(0,1fr)_420px]">
          <aside className="flex min-h-[520px] flex-col border border-claw-line bg-claw-panel/86 shadow-glow">
            <PanelHeader icon={<Terminal className="h-4 w-4" />} title="Task Console" />
            <div className="flex flex-1 flex-col gap-4 p-4">
              <textarea
                value={task}
                onChange={(event) => setTask(event.target.value)}
                className="min-h-36 resize-none border border-claw-line bg-[#090d14] p-3 text-sm leading-6 outline-none transition focus:border-claw-cyan"
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="border border-claw-line bg-[#090d14] px-3 py-2 text-sm outline-none"
                >
                  <option value="mock">mock</option>
                  <option value="openai">openai</option>
                  <option value="local">local OpenAI-compatible</option>
                </select>
                {isRunning ? (
                  <button className="inline-flex items-center gap-2 border border-claw-red px-3 py-2 text-sm text-claw-red" onClick={stopRun}>
                    <CircleStop className="h-4 w-4" />
                    Stop
                  </button>
                ) : (
                  <button className="inline-flex items-center gap-2 bg-claw-cyan px-3 py-2 text-sm font-medium text-[#041014]" onClick={startRun}>
                    <Play className="h-4 w-4" />
                    Start
                  </button>
                )}
              </div>
              {error ? <div className="border border-claw-red/50 bg-claw-red/10 p-3 text-sm text-claw-red">{error}</div> : null}
              <div className="space-y-2">
                <div className="font-mono text-xs uppercase text-claw-muted">Sample prompts</div>
                {samples.map((sample) => (
                  <button
                    key={sample}
                    className="block w-full border border-claw-line bg-[#090d14] px-3 py-2 text-left text-xs text-claw-muted transition hover:border-claw-cyan hover:text-claw-text"
                    onClick={() => setTask(sample)}
                  >
                    {sample}
                  </button>
                ))}
              </div>
              <RunHistory runs={runs} onSelect={setRun} />
            </div>
          </aside>

          <section className="grid min-h-[520px] grid-rows-[minmax(300px,1fr)_260px] gap-4">
            <div className="border border-claw-line bg-claw-panel/80">
              <PanelHeader icon={<Compass className="h-4 w-4" />} title="Browser State" />
              <div className="grid h-[calc(100%-49px)] gap-0 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col justify-between bg-[#070a10] p-5">
                  {lastObservation?.screenshotPath ? (
                    <div className="flex h-full items-center justify-center overflow-hidden border border-claw-line bg-black">
                      <img src={`/api/screenshot?path=${encodeURIComponent(lastObservation.screenshotPath)}`} alt="Browser screenshot" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center border border-dashed border-claw-line text-center text-sm text-claw-muted">
                      Start a run to capture browser observations.
                    </div>
                  )}
                </div>
                <div className="border-l border-claw-line p-4">
                  <div className="mb-3 font-mono text-xs uppercase text-claw-muted">Current page</div>
                  <div className="space-y-3 text-sm">
                    <Fact label="Title" value={lastObservation?.title ?? "No page observed"} />
                    <Fact label="URL" value={lastObservation?.url ?? "about:blank"} mono />
                    <Fact label="Targets" value={`${lastObservation?.interactiveElements.length ?? 0} ranked`} />
                  </div>
                  <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap border border-claw-line bg-[#090d14] p-3 font-mono text-xs leading-5 text-claw-muted">
                    {lastObservation?.accessibilityTreeSummary ?? "Accessibility tree summary will appear here."}
                  </pre>
                </div>
              </div>
            </div>

            <div className="border border-claw-line bg-claw-panel/80">
              <PanelHeader icon={<Activity className="h-4 w-4" />} title="Run Metrics" />
              <div className="grid h-[calc(100%-49px)] grid-cols-2 gap-px bg-claw-line md:grid-cols-4">
                <Metric label="steps" value={metrics.steps} />
                <Metric label="actions" value={metrics.actions} />
                <Metric label="errors" value={metrics.errors} />
                <Metric label="duration" value={`${metrics.duration}s`} />
              </div>
            </div>
          </section>

          <aside className="min-h-[520px] border border-claw-line bg-claw-panel/86">
            <PanelHeader icon={<Radar className="h-4 w-4" />} title="Agent Trace" />
            <div className="h-[calc(100%-49px)] overflow-auto p-4">
              {isRunning ? <TraceLoading /> : null}
              {activeRun?.steps.length ? (
                <div className="space-y-3">
                  {activeRun.steps.map((step) => (
                    <TraceStep key={step.id} step={step} />
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-claw-muted">
                  The flight recorder is quiet. Run the example.com task to see OBSERVE, PLAN, ACT, and DONE events.
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-claw-line px-4 font-mono text-xs uppercase text-claw-muted">
      <span className="text-claw-cyan">{icon}</span>
      {title}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "done" ? "text-claw-cyan" : status === "blocked" || status === "failed" ? "text-claw-red" : "text-claw-amber";
  return <span className={clsx("border border-claw-line px-3 py-2 uppercase", tone)}>{status}</span>;
}

function TraceStep({ step }: { step: AgentStep }) {
  return (
    <div className="border border-claw-line bg-[#090d14] p-3">
      <div className="mb-2 flex items-center justify-between gap-2 font-mono text-xs">
        <span className={clsx("font-semibold", step.phase === "ERROR" ? "text-claw-red" : step.phase === "DONE" ? "text-claw-cyan" : "text-claw-amber")}>{step.phase}</span>
        <span className="text-claw-muted">#{step.index} {step.durationMs ?? 0}ms</span>
      </div>
      {step.thoughtSummary ? <p className="mb-2 text-sm text-claw-text">{step.thoughtSummary}</p> : null}
      {step.action ? <pre className="overflow-auto border border-claw-line bg-black/30 p-2 font-mono text-xs text-claw-muted">{JSON.stringify(step.action, null, 2)}</pre> : null}
      {step.observationSummary ? <p className="mt-2 line-clamp-4 text-xs leading-5 text-claw-muted">{step.observationSummary}</p> : null}
      {step.error ? <p className="mt-2 text-xs text-claw-red">{step.error}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#090d14] p-4">
      <div className="font-mono text-xs uppercase text-claw-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase text-claw-muted">{label}</div>
      <div className={clsx("mt-1 break-words", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}

function RunHistory({ runs, onSelect }: { runs: AgentRun[]; onSelect: (run: AgentRun) => void }) {
  return (
    <div className="mt-auto space-y-2">
      <div className="flex items-center gap-2 font-mono text-xs uppercase text-claw-muted">
        <FileClock className="h-3.5 w-3.5" />
        Run logs
      </div>
      <div className="max-h-48 space-y-2 overflow-auto">
        {runs.slice(0, 8).map((run) => (
          <button key={run.id} className="block w-full border border-claw-line px-3 py-2 text-left text-xs hover:border-claw-cyan" onClick={() => onSelect(run)}>
            <div className="flex justify-between gap-2 font-mono">
              <span>{run.status}</span>
              <span className="text-claw-muted">{run.steps.length} steps</span>
            </div>
            <div className="mt-1 truncate text-claw-muted">{run.task}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TraceLoading() {
  return (
    <div className="mb-3 flex items-center gap-2 border border-claw-line bg-[#090d14] p-3 text-sm text-claw-muted">
      <RefreshCw className="h-4 w-4 animate-spin text-claw-cyan" />
      Agent is operating Chrome. The completed trace will appear when the local run returns.
    </div>
  );
}

function buildMetrics(run?: AgentRun) {
  if (!run) return { steps: 0, actions: 0, errors: 0, duration: "0.0" };
  const started = new Date(run.startedAt).getTime();
  const completed = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  return {
    steps: run.steps.length,
    actions: run.steps.filter((step) => step.action).length,
    errors: run.steps.filter((step) => step.error).length,
    duration: ((completed - started) / 1000).toFixed(1)
  };
}

function getLastObservation(run?: AgentRun) {
  if (!run) return undefined;
  for (let index = run.steps.length - 1; index >= 0; index -= 1) {
    const observation = run.steps[index]?.observation;
    if (observation) return observation;
  }
  return undefined;
}

async function refreshRuns(setRuns: (runs: AgentRun[]) => void) {
  const response = await fetch("/api/runs", { cache: "no-store" });
  if (response.ok) {
    const payload = (await response.json()) as { runs: AgentRun[] };
    setRuns(payload.runs);
  }
}
