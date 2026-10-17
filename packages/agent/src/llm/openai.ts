import { z } from "zod";
import { postJson, type HttpRequest } from "@chromeclaw/egress";
import { BrowserActionSchema, type BrowserAction } from "@chromeclaw/shared";
import { BROWSER_AGENT_SYSTEM_PROMPT, buildPlannerPrompt } from "../prompt";
import { PLANNER_WIRE_SCHEMA } from "./schema";
import type { Planner, PlannerInput } from "./index";

interface OpenAIConfig {
  model: string;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  providerName?: string | undefined;
  timeoutMs?: number;
  mode?: "local" | "hosted";
  responseFormat?: "json" | "llama-schema";
  requestCost?: number | null;
  maxOutputTokens?: number;
  tokenLimitField?: "max_tokens" | "max_completion_tokens";
}
const ResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

export class PlannerReplyError extends Error {}

/** Only stable transport codes and HTTP status belong in public diagnostics. */
export class PlannerTransportError extends Error {}

/** JSON mode is transport syntax, not schema adherence. Every reply is parsed locally. */
export class OpenAICompatiblePlanner implements Planner {
  name: string;
  model: string;
  readonly configuration;
  readonly sensitiveValues;
  constructor(private config: OpenAIConfig) {
    this.name = config.providerName ?? "openai-compatible";
    this.model = config.model;
    this.sensitiveValues = config.apiKey ? [config.apiKey] : [];
    this.configuration = config.mode
      ? {
          responseFormat: config.responseFormat ?? "json",
          endpoint: config.baseUrl ?? "https://api.openai.com/v1",
          mode: config.mode,
          requestCost: config.requestCost ?? null,
          maxOutputTokens: config.maxOutputTokens ?? 1024,
          tokenLimitField: config.tokenLimitField ?? "max_tokens",
          requestTimeoutMs: config.timeoutMs ?? 60000,
        }
      : undefined;
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
    const reservation: HttpRequest["reservation"] =
      this.configuration && this.configuration.requestCost !== null
        ? {
            cost: Math.ceil(this.configuration.requestCost * 1000000) / 1000000,
            accounting:
              this.configuration.mode === "local"
                ? "local-zero"
                : "user-ceiling",
          }
        : undefined;
    const result = await postJson({
      url: `${base.href.replace(/\/$/, "")}/chat/completions`,
      approvedOrigin: base.origin,
      apiKey: this.config.apiKey,
      signal: input.signal,
      ...(this.config.timeoutMs ? { timeoutMs: this.config.timeoutMs } : {}),
      onCrossing: input.onCrossing,
      ...(reservation ? { reservation } : {}),
      body: {
        model: this.model,
        [this.config.tokenLimitField ?? "max_tokens"]:
          this.config.maxOutputTokens ?? 1024,
        n: 1,
        stream: false,
        response_format: {
          type: "json_object",
          ...(this.config.responseFormat === "llama-schema"
            ? { schema: PLANNER_WIRE_SCHEMA }
            : {}),
        },
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
    const usage = z
      .object({
        usage: z
          .object({
            prompt_tokens: z.number().int().nonnegative(),
            completion_tokens: z.number().int().nonnegative(),
          })
          .optional(),
      })
      .safeParse(result.value);
    if (!usage.success)
      throw new PlannerTransportError("Planner returned invalid token usage.");
    if (
      usage.data.usage &&
      usage.data.usage.completion_tokens > (this.config.maxOutputTokens ?? 1024)
    )
      throw new PlannerTransportError(
        "Planner exceeded the configured output token limit.",
      );
    await input.onUsage?.({
      promptTokens: usage.data.usage?.prompt_tokens ?? null,
      completionTokens: usage.data.usage?.completion_tokens ?? null,
    });
    const response = ResponseSchema.safeParse(result.value);
    if (!response.success)
      throw new PlannerReplyError(
        "Planner response has no valid message content.",
      );
    const first = response.data.choices[0];
    if (!first) throw new PlannerReplyError("Planner response has no choices.");
    if (first.finish_reason === "length")
      throw new PlannerReplyError(
        "Planner output was truncated at its token limit.",
      );
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
