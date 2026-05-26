import { BrowserActionSchema, type BrowserAction } from "@chromeclaw/shared";
import { BROWSER_AGENT_SYSTEM_PROMPT, buildPlannerPrompt } from "../prompt";
import type { Planner, PlannerInput } from "./index";

interface OpenAIConfig {
  model: string;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  providerName?: string | undefined;
}

export class OpenAICompatiblePlanner implements Planner {
  name: string;
  model: string;
  private apiKey?: string | undefined;
  private baseUrl: string;

  constructor(config: OpenAIConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
    this.name = config.providerName ?? "openai-compatible";
  }

  async plan(input: PlannerInput): Promise<BrowserAction> {
    if (!this.apiKey && !this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1")) {
      const credential = this.name === "huggingface" ? "HF_TOKEN or HUGGINGFACE_API_KEY" : "OPENAI_API_KEY";
      throw new Error(`${credential} is required for hosted ${this.name} requests. Use CHROMECLAW_PROVIDER=mock for keyless mode.`);
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: BROWSER_AGENT_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildPlannerPrompt({
              task: input.task,
              observationSummary: input.observationSummary,
              recentSteps: input.recentSteps,
              maxSteps: input.maxSteps
            })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Planner request failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Planner returned no content.");
    return BrowserActionSchema.parse(JSON.parse(content));
  }
}
