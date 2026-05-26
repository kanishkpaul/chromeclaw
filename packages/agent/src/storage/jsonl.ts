import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentRun, AgentStep } from "@chromeclaw/shared";

export interface RunLogEvent {
  type: "run_started" | "step" | "run_completed";
  timestamp: string;
  runId: string;
  run?: AgentRun;
  step?: AgentStep;
}

export class JsonlRunStore {
  constructor(private dir = ".chromeclaw/runs") {}

  async append(event: RunLogEvent): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const filePath = this.fileFor(event.runId);
    await writeFile(filePath, `${JSON.stringify(event)}\n`, { flag: "a" });
  }

  async listRuns(): Promise<AgentRun[]> {
    try {
      const files = (await readdir(this.dir)).filter((file) => file.endsWith(".jsonl"));
      const runs = await Promise.all(files.map((file) => this.readRun(file.replace(/\.jsonl$/, ""))));
      return runs.filter((run): run is AgentRun => Boolean(run)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    } catch {
      return [];
    }
  }

  async readRun(runId: string): Promise<AgentRun | null> {
    try {
      const content = await readFile(this.fileFor(runId), "utf8");
      const events = content
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as RunLogEvent);
      const completed = [...events].reverse().find((event) => event.type === "run_completed" && event.run)?.run;
      if (completed) return completed;
      const started = events.find((event) => event.type === "run_started" && event.run)?.run;
      if (!started) return null;
      return {
        ...started,
        steps: events.flatMap((event) => (event.step ? [event.step] : []))
      };
    } catch {
      return null;
    }
  }

  private fileFor(runId: string): string {
    return path.resolve(this.dir, `${runId}.jsonl`);
  }
}
