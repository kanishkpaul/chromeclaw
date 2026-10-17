import { z } from "zod";

export interface PlannerConfig {
  provider?: string | undefined;
  model?: string | undefined;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
}
const IdentitySchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((value) =>
    [...value].every(
      (char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127,
    ),
  );
const ProviderSchema = z.enum([
  "mock",
  "openai",
  "openai-compatible",
  "huggingface",
  "local",
]);
export type ResolvedPlannerConfig =
  | { provider: "mock"; model: string; mode: "mock" }
  | {
      provider: "openai" | "openai-compatible" | "huggingface" | "local";
      model: string;
      mode: "local" | "hosted";
      baseUrl: string;
      apiKey?: string;
    };

/** Messages name invalid settings without echoing keys, URLs or untrusted input. */
export class PlannerConfigError extends Error {}

/** Explicit options win over environment. Merely possessing a key never selects a provider. */
export function resolvePlannerConfig(
  options: PlannerConfig = {},
  env: Readonly<Record<string, string | undefined>> = process.env,
): ResolvedPlannerConfig {
  const selected = options.provider ?? env.CHROMECLAW_PROVIDER ?? "mock";
  const provider = ProviderSchema.safeParse(
    selected === "hf" ? "huggingface" : selected,
  );
  if (!provider.success)
    throw new PlannerConfigError(
      "Choose mock, openai, openai-compatible, huggingface or local. Anthropic is unavailable.",
    );
  const model = IdentitySchema.safeParse(
    options.model ??
      env.CHROMECLAW_MODEL ??
      (provider.data === "mock" ? "mock-browser-operator" : undefined),
  );
  if (!model.success)
    throw new PlannerConfigError(
      "Set an explicit nonempty model for the selected provider.",
    );
  if (provider.data === "mock")
    return { provider: "mock", model: model.data, mode: "mock" };
  const local = provider.data === "local";
  const hf = provider.data === "huggingface";
  // Local settings cannot inherit hosted keys or OPENAI_BASE_URL from another project.
  const endpoint =
    options.baseUrl ??
    (local
      ? env.CHROMECLAW_LOCAL_BASE_URL
      : (env.CHROMECLAW_BASE_URL ??
        (hf ? env.HF_BASE_URL : env.OPENAI_BASE_URL))) ??
    (provider.data === "openai"
      ? "https://api.openai.com/v1"
      : hf
        ? "https://router.huggingface.co/v1"
        : undefined);
  const apiKey =
    options.apiKey ??
    (local
      ? env.CHROMECLAW_LOCAL_API_KEY
      : (env.CHROMECLAW_API_KEY ??
        (hf ? (env.HF_TOKEN ?? env.HUGGINGFACE_API_KEY) : env.OPENAI_API_KEY)));
  if (apiKey !== undefined && (!apiKey.trim() || /\s/.test(apiKey)))
    throw new PlannerConfigError(
      "The selected provider key must be nonempty and contain no whitespace.",
    );
  let url: URL;
  try {
    url = new URL(endpoint ?? "");
  } catch {
    throw new PlannerConfigError(
      "Set an explicit valid base URL for this provider.",
    );
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (apiKey && (url.href.includes(apiKey) || model.data.includes(apiKey)))
  )
    throw new PlannerConfigError(
      "Provider URLs must omit credentials, query and fragment; keys cannot appear in endpoint or model settings.",
    );
  if (
    local
      ? !loopback || !["http:", "https:"].includes(url.protocol)
      : loopback || url.protocol !== "https:"
  )
    throw new PlannerConfigError(
      local
        ? "Local requires an exact loopback HTTP(S) endpoint."
        : "Hosted providers require HTTPS. Choose local for a loopback endpoint.",
    );
  if (!local && !apiKey)
    throw new PlannerConfigError(
      "Set a key for the explicitly selected hosted provider.",
    );
  return {
    provider: provider.data,
    model: model.data,
    mode: local ? "local" : "hosted",
    baseUrl: url.href.replace(/\/+$/, ""),
    ...(apiKey ? { apiKey } : {}),
  };
}

/** This describes selection only. It neither probes a server nor claims model compatibility. */
export function describePlannerConfig(config: ResolvedPlannerConfig) {
  return {
    provider: config.provider,
    model: config.model,
    mode: config.mode,
    endpoint: config.provider === "mock" ? null : config.baseUrl,
    keyConfigured: config.provider !== "mock" && Boolean(config.apiKey),
    readiness: config.provider === "mock" ? "ready" : "accounting-required",
  };
}

/** Timer budgets stay within Node's signed 32-bit timer range instead of wrapping to 1 ms. */
export function resolveRunSettings(
  options: {
    maxSteps?: number | undefined;
    timeoutMs?: number | undefined;
    headless?: boolean | undefined;
  } = {},
  env: Readonly<Record<string, string | undefined>> = process.env,
): { maxSteps: number; timeoutMs: number; headless: boolean } {
  const settings = z
    .object({
      maxSteps: z.coerce.number().int().positive().safe(),
      timeoutMs: z.coerce.number().int().positive().max(2147483647),
      headless: z.union([
        z.boolean(),
        z.enum(["true", "false"]).transform((value) => value === "true"),
      ]),
    })
    .safeParse({
      maxSteps: options.maxSteps ?? env.CHROMECLAW_MAX_STEPS ?? 20,
      timeoutMs: options.timeoutMs ?? env.CHROMECLAW_TIMEOUT_MS ?? 120000,
      headless: options.headless ?? env.CHROMECLAW_HEADLESS ?? false,
    });
  if (!settings.success)
    throw new PlannerConfigError(
      "Step/time budgets must be positive finite integers; timeout must fit a 32-bit timer. Headless must be true or false.",
    );
  return settings.data;
}
