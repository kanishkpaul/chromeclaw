import { BrowserActionSchema, type BrowserAction } from "@chromeclaw/shared";
import { BROWSER_AGENT_SYSTEM_PROMPT, buildPlannerPrompt } from "../prompt";
import type { Planner, PlannerInput } from "./index";

interface OpenAIConfig {
  model: string;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  providerName?: string | undefined;
}

type LegacyActionPayload = Record<string, unknown>;

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
    return BrowserActionSchema.parse(normalizeModelActionPayload(parsePlannerJson(content)));
  }
}

function parsePlannerJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) {
      return JSON.parse(fenced);
    }

    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1));
    }

    throw new Error(`Planner returned non-JSON content: ${content.slice(0, 400)}`);
  }
}

export function normalizeModelActionPayload(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const payload: LegacyActionPayload = { ...(value as LegacyActionPayload) };
  const type = typeof payload.type === "string" ? payload.type : typeof payload.action === "string" ? payload.action : undefined;

  if (!type) return payload;

  const thoughtSummary = typeof payload.thoughtSummary === "string" ? payload.thoughtSummary : undefined;

  switch (type) {
    case "navigate": {
      const url = asString(payload.url) ?? asString(payload.target) ?? asString(payload.text);
      return thoughtSummary ? { type, thoughtSummary, url } : { type, url };
    }
    case "search_web": {
      const query = asString(payload.query) ?? asString(payload.target) ?? asString(payload.url) ?? asString(payload.text);
      return thoughtSummary ? { type, thoughtSummary, query } : { type, query };
    }
    case "click": {
      const selector = asString(payload.selector) ?? asString(payload.target) ?? asString(payload.url);
      const next = {
        type,
        thoughtSummary,
        selector,
        text: asString(payload.text),
        role: asString(payload.role),
        name: asString(payload.name)
      };
      return removeUndefined(next);
    }
    case "type": {
      const next = {
        type,
        thoughtSummary,
        selector: asString(payload.selector),
        target: asString(payload.target),
        text: asString(payload.text),
        submit: typeof payload.submit === "boolean" ? payload.submit : undefined
      };
      return removeUndefined(next);
    }
    case "press": {
      const key = asString(payload.key) ?? asString(payload.target);
      return thoughtSummary ? { type, thoughtSummary, key } : { type, key };
    }
    case "wait": {
      const ms = asNumber(payload.ms) ?? asNumber(payload.target);
      return thoughtSummary ? { type, thoughtSummary, ms } : { type, ms };
    }
    case "extract_text":
    case "summarize_page":
    case "screenshot": {
      return thoughtSummary ? { type, thoughtSummary } : { type };
    }
    case "scroll": {
      const next = {
        type,
        thoughtSummary,
        direction: asString(payload.direction),
        amount: asNumber(payload.amount)
      };
      return removeUndefined(next);
    }
    case "ask_user": {
      const question = asString(payload.question) ?? asString(payload.target) ?? asString(payload.text);
      return thoughtSummary ? { type, thoughtSummary, question } : { type, question };
    }
    case "finish": {
      const answer = asString(payload.answer) ?? asString(payload.text) ?? asString(payload.target);
      return thoughtSummary ? { type, thoughtSummary, answer } : { type, answer };
    }
    case "fail": {
      const reason = asString(payload.reason) ?? asString(payload.text) ?? asString(payload.target);
      return thoughtSummary ? { type, thoughtSummary, reason } : { type, reason };
    }
    default:
      return payload;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, currentValue]) => currentValue !== undefined)) as T;
}
