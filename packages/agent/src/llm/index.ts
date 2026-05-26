import type { BrowserObservation, BrowserAction } from "@chromeclaw/shared";
import { MockPlanner } from "./mock";
import { OpenAICompatiblePlanner } from "./openai";
import { AnthropicPlaceholderPlanner } from "./anthropic";

export interface PlannerInput {
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

export interface PlannerConfig {
  provider?: string | undefined;
  model?: string | undefined;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
}

export function createPlanner(config: PlannerConfig = {}): Planner {
  const provider =
    config.provider ??
    process.env.CHROMECLAW_PROVIDER ??
    (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY
      ? "huggingface"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "mock");
  const model = config.model ?? process.env.CHROMECLAW_MODEL ?? "mock-browser-operator";

  if (provider === "mock") return new MockPlanner(model);
  if (provider === "openai" || provider === "openai-compatible" || provider === "local") {
    return new OpenAICompatiblePlanner({
      model,
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseUrl: config.baseUrl ?? process.env.OPENAI_BASE_URL,
      providerName: provider
    });
  }
  if (provider === "huggingface" || provider === "hf") {
    return new OpenAICompatiblePlanner({
      model,
      apiKey: config.apiKey ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY,
      baseUrl: config.baseUrl ?? process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1",
      providerName: "huggingface"
    });
  }
  if (provider === "anthropic") return new AnthropicPlaceholderPlanner(model);

  throw new Error(`Unsupported provider "${provider}". Use mock, openai, openai-compatible, local, huggingface, hf, or anthropic.`);
}
