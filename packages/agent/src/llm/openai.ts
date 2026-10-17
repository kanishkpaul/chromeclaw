import { z } from "zod";
import { postJson } from "@chromeclaw/egress";
import { BrowserActionSchema, type BrowserAction } from "@chromeclaw/shared";
import { BROWSER_AGENT_SYSTEM_PROMPT, buildPlannerPrompt } from "../prompt";
import type { Planner, PlannerInput } from "./index";

interface OpenAIConfig {
  model: string;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  providerName?: string | undefined;
  timeoutMs?: number;
}
const ResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().min(1) }) }))
    .min(1),
});

export class PlannerReplyError extends Error {}

/** Only stable transport codes and HTTP status belong in public diagnostics. */
export class PlannerTransportError extends Error {}

/** JSON mode is transport syntax, not schema adherence. Every reply is parsed locally. */
export class OpenAICompatiblePlanner implements Planner {
  name: string;
  model: string;
  constructor(private config: OpenAIConfig) {
    this.name = config.providerName ?? "openai-compatible";
    this.model = config.model;
  }
  async plan(input: PlannerInput): Promise<BrowserAction> {
    const base = new URL(this.config.baseUrl ?? "https://api.openai.com/v1");
    if (
      !this.config.apiKey &&
      !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
      throw new Error("A key is required for this hosted planner.");
    if (!input.onCrossing)
      throw new Error(
        "A durable crossing recorder is required before any planner request.",
      );
    const result = await postJson({
      url: `${base.href.replace(/\/$/, "")}/chat/completions`,
      approvedOrigin: base.origin,
      apiKey: this.config.apiKey,
      signal: input.signal,
      ...(this.config.timeoutMs ? { timeoutMs: this.config.timeoutMs } : {}),
      onCrossing: input.onCrossing,
      body: {
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: BROWSER_AGENT_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildPlannerPrompt({
              ...input,
              sensitiveValues: [
                ...(input.sensitiveValues ?? []),
                ...(this.config.apiKey ? [this.config.apiKey] : []),
              ],
            }),
          },
        ],
      },
    });
    if (!result.ok)
      throw new PlannerTransportError(
        `Planner transport failed: ${result.code}${result.status ? ` (${result.status})` : ""}.`,
      );
    const response = ResponseSchema.safeParse(result.value);
    if (!response.success)
      throw new PlannerReplyError(
        "Planner response has no valid message content.",
      );
    const first = response.data.choices[0];
    if (!first) throw new PlannerReplyError("Planner response has no choices.");
    return parsePlannerAction(first.message.content);
  }
}

/** One enclosing JSON fence is accepted. Embedded objects in prose and unknown keys refuse. */
export function parsePlannerAction(content: string): BrowserAction {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  let value: unknown;
  try {
    value = JSON.parse(fenced?.[1] ?? trimmed);
  } catch {
    throw new PlannerReplyError("Planner reply is not a complete JSON action.");
  }
  const action = BrowserActionSchema.safeParse(value);
  if (!action.success)
    throw new PlannerReplyError(
      "Planner reply does not match the strict action contract.",
    );
  return action.data;
}
