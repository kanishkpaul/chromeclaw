import type { BrowserAction } from "./schemas";

export type AgentStatus =
  | "idle"
  | "observing"
  | "planning"
  | "acting"
  | "waiting"
  | "done"
  | "blocked"
  | "failed"
  | "stopped";

export interface InteractiveElement {
  id: string;
  role?: string | undefined;
  name?: string | undefined;
  text?: string | undefined;
  selector?: string | undefined;
  tagName?: string | undefined;
  href?: string | undefined;
  isVisible: boolean;
  score: number;
}

export interface BrowserObservation {
  url: string;
  title: string;
  visibleText: string;
  interactiveElements: InteractiveElement[];
  accessibilityTreeSummary: string;
  screenshotPath?: string | undefined;
  timestamp: string;
}

export interface AgentStep {
  id: string;
  index: number;
  phase: "OBSERVE" | "PLAN" | "ACT" | "ERROR" | "RECOVER" | "DONE";
  status: AgentStatus;
  thoughtSummary?: string | undefined;
  action?: BrowserAction | undefined;
  observation?: BrowserObservation | undefined;
  observationSummary?: string | undefined;
  error?: string | undefined;
  startedAt: string;
  completedAt?: string | undefined;
  durationMs?: number | undefined;
}

export interface AgentRun {
  id: string;
  task: string;
  status: AgentStatus;
  startedAt: string;
  completedAt?: string | undefined;
  maxSteps: number;
  provider: string;
  model: string;
  steps: AgentStep[];
  finalAnswer?: string | undefined;
  error?: string | undefined;
}

export interface RunMetrics {
  steps: number;
  durationMs: number;
  actions: number;
  errors: number;
}
