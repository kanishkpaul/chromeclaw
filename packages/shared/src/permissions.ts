import { BrowserActionSchema, type BrowserAction } from "./schemas";

export interface TaskPermissions {
  readonly origins: readonly string[];
  readonly tools: readonly BrowserAction["type"][];
  readonly read: boolean;
  readonly write: boolean;
  readonly irreversible: "deny" | "confirm";
  readonly allowLoopback: boolean;
  readonly maxSteps: number;
  readonly expiresAt: number;
  // Zero allows local inference only. Hosted attempts reserve their full declared ceiling.
  readonly maxCost: number;
}

export type PermissionRequest = Partial<Omit<TaskPermissions, "expiresAt">> & {
  timeoutMs?: number;
};

/** Freeze user-supplied powers before reading a page. Nothing in an observation can widen them. */
export function createPermissions(
  request: PermissionRequest,
  now: number,
): TaskPermissions {
  if (
    request.irreversible !== undefined &&
    !["deny", "confirm"].includes(request.irreversible)
  )
    throw new Error("Irreversible permission must be deny or confirm.");
  for (const value of [request.read, request.write, request.allowLoopback])
    if (value !== undefined && typeof value !== "boolean")
      throw new Error("Task permissions must be booleans.");
  const knownTools = BrowserActionSchema.options.map(
    (schema) => schema.shape.type.value,
  );
  if (request.tools?.some((tool) => !knownTools.includes(tool)))
    throw new Error("Unknown task tool permission.");
  const maxSteps = request.maxSteps ?? 20;
  const timeout = request.timeoutMs ?? 120000;
  if (
    !Number.isInteger(maxSteps) ||
    maxSteps <= 0 ||
    !Number.isFinite(timeout) ||
    timeout <= 0 ||
    !Number.isFinite(now)
  ) {
    throw new Error("Task step and time budgets must be positive and finite.");
  }
  const maxCost = request.maxCost ?? 0;
  if (!Number.isFinite(maxCost) || maxCost < 0)
    throw new Error("Task cost budget must be finite and nonnegative.");
  const envelope: TaskPermissions = {
    origins: Object.freeze(
      (request.origins ?? []).map((origin) => {
        const url = new URL(origin);
        if (url.href !== `${url.origin}/`)
          throw new Error(
            "Permissions require origins without paths, query or credentials.",
          );
        return url.origin;
      }),
    ),
    tools: Object.freeze([
      ...(request.tools ?? [
        "navigate",
        "click",
        "type",
        "press",
        "wait",
        "extract_text",
        "summarize_page",
        "scroll",
        "screenshot",
        "ask_user",
        "finish",
        "fail",
      ]),
    ]),
    read: request.read ?? true,
    write: request.write ?? false,
    irreversible: request.irreversible ?? "deny",
    allowLoopback: request.allowLoopback ?? false,
    maxSteps,
    expiresAt: now + timeout,
    maxCost,
  };
  for (const origin of envelope.origins) {
    const refusal = destinationRefusal(origin, envelope);
    if (refusal) throw new Error(refusal);
  }
  return Object.freeze(envelope);
}

/** URL parsing precedes host checks so decimal, octal and mapped private addresses cannot hide. */
export function destinationRefusal(
  value: string,
  envelope: TaskPermissions,
): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "A complete HTTP(S) URL is required.";
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return "Browser, file and credential-bearing URLs are refused.";
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const loopback =
    host === "localhost" || host === "[::1]" || /^127\./.test(host);
  if (loopback && !envelope.allowLoopback)
    return "Loopback destinations require explicit harness scope.";
  const privateHost =
    /^0\./.test(host) ||
    /^(?:22[4-9]|2[3-5]\d)\./.test(host) ||
    /^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(
      host,
    ) ||
    /^\[(?:f[cd]|fe[89a-f]|ff|::(?:\]|ffff:))/.test(host) ||
    (!host.includes(".") && !host.startsWith("[") && !loopback) ||
    /\.(?:local|internal|localhost)$/.test(host);
  if (privateHost) return "Private and local-network destinations are refused.";
  if (!envelope.origins.includes(url.origin))
    return "The destination origin is outside the fixed task permissions.";
  return undefined;
}
