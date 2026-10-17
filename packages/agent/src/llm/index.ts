import type {
  BrowserObservation,
  BrowserAction,
  TaskPermissions,
} from "@chromeclaw/shared";
import { MockPlanner } from "./mock";
import { OpenAICompatiblePlanner } from "./openai";
import { resolvePlannerConfig, type PlannerConfig } from "./config";
export {
  resolvePlannerConfig,
  describePlannerConfig,
  resolveRunSettings,
  PlannerConfigError,
} from "./config";
export type { PlannerConfig, ResolvedPlannerConfig } from "./config";

export interface PlannerInput {
  signal?: AbortSignal | undefined;
  permissions?: TaskPermissions;
  sensitiveValues?: readonly string[];
  answers?: readonly string[];
  notes?: readonly { snapshotId: string; url: string; text: string }[];
  onCrossing?: (
    crossing: import("@chromeclaw/egress").Crossing,
  ) => Promise<void>;
  task: string;
  observation: BrowserObservation;
  observationSummary: string;
  recentSteps: string;
  maxSteps: number;
}

export interface Planner {
  name: string;
  model: string;
  plan(input: PlannerInput): Promise<BrowserAction>;
}

/** Provider selection is validated before a browser or HTTP request can start. */
export function createPlanner(options: PlannerConfig = {}): Planner {
  const config = resolvePlannerConfig(options);
  if (config.provider === "mock") return new MockPlanner(config.model);
  return new OpenAICompatiblePlanner({
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    providerName: config.provider,
  });
}
