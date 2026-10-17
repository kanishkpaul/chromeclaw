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
  onProgress?: ((progress: { receivedBytes: number }) => void) | undefined;
  signal?: AbortSignal | undefined;
  permissions?: TaskPermissions;
  sensitiveValues?: readonly string[] | undefined;
  answers?: readonly string[];
  notes?: readonly { snapshotId: string; url: string; text: string }[];
  onCrossing?: (
    crossing: import("@chromeclaw/egress").Crossing,
  ) => Promise<void | boolean>;
  onUsage?: (usage: {
    promptTokens: number | null;
    completionTokens: number | null;
  }) => Promise<void>;
  task: string;
  observation: BrowserObservation;
  observationSummary: string;
  recentSteps: string;
  maxSteps: number;
}

export interface Planner {
  name: string;
  model: string;
  configuration?:
    | {
        stream: boolean;
        responseFormat: "json" | "llama-schema";
        endpoint: string;
        mode: "local" | "hosted";
        requestCost: number | null;
        maxOutputTokens: number;
        tokenLimitField: "max_tokens" | "max_completion_tokens";
        requestTimeoutMs: number;
      }
    | undefined;
  sensitiveValues?: readonly string[] | undefined;
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
    responseFormat: config.responseFormat,
    stream: config.stream,
    providerName: config.provider,
    mode: config.mode,
    requestCost: config.mode === "local" ? 0 : config.requestCost,
    maxOutputTokens: config.maxOutputTokens,
    tokenLimitField: config.tokenLimitField,
    timeoutMs: config.requestTimeoutMs,
  });
}
