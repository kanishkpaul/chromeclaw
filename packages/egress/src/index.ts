import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export interface Crossing {
  destination: string;
  requestBytes: number;
  payloadHash: string;
  attempt: number;
  estimatedCost: null;
  accounting: "not-estimated";
}
export interface HttpRequest {
  url: string;
  approvedOrigin: string;
  body: unknown;
  apiKey?: string | undefined;
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
  requestLimit?: number;
  responseLimit?: number;
  onCrossing: (crossing: Crossing) => Promise<void>;
}
export type HttpResult =
  | { ok: true; value: unknown; attempts: number }
  | {
      ok: false;
      code:
        | "invalid-request"
        | "request-limit"
        | "response-limit"
        | "timeout"
        | "aborted"
        | "http"
        | "network"
        | "malformed-json"
        | "audit-failed"
        | "credential-echo";
      status?: number;
      attempts: number;
    };

/** The sole application HTTP sender. Redirects refuse, diagnostics omit bodies and secrets. */
export async function postJson(request: HttpRequest): Promise<HttpResult> {
  let url: URL;
  let body: string;
  try {
    url = new URL(request.url);
    body = JSON.stringify(request.body);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.origin !== request.approvedOrigin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !body
    )
      return { ok: false, code: "invalid-request", attempts: 0 };
  } catch {
    return { ok: false, code: "invalid-request", attempts: 0 };
  }
  if (
    request.apiKey &&
    (body.includes(request.apiKey) || url.href.includes(request.apiKey))
  )
    return { ok: false, code: "invalid-request", attempts: 0 };
  const timeout = request.timeoutMs ?? 15000;
  const requestLimit = request.requestLimit ?? 128000;
  const responseLimit = request.responseLimit ?? 1000000;
  if (
    ![timeout, requestLimit, responseLimit].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    return { ok: false, code: "invalid-request", attempts: 0 };
  if (Buffer.byteLength(body) > requestLimit)
    return { ok: false, code: "request-limit", attempts: 0 };
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), timeout);
  const signal = request.signal
    ? AbortSignal.any([request.signal, deadline.signal])
    : deadline.signal;
  let attempts = 0;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal.aborted)
        return {
          ok: false,
          code: request.signal?.aborted ? "aborted" : "timeout",
          attempts,
        };
      try {
        const recording = request.onCrossing({
          destination: `${url.origin}${url.pathname}`,
          requestBytes: Buffer.byteLength(body),
          payloadHash: createHash("sha256").update(body).digest("hex"),
          attempt: attempt + 1,
          estimatedCost: null,
          accounting: "not-estimated",
        });
        let abortRecord: () => void = () => undefined;
        const interrupted = new Promise<never>((_resolve, reject) => {
          abortRecord = () => reject(new Error("Recording interrupted."));
          signal.addEventListener("abort", abortRecord, { once: true });
        });
        try {
          if (signal.aborted) abortRecord();
          await Promise.race([recording, interrupted]);
        } finally {
          signal.removeEventListener("abort", abortRecord);
        }
      } catch {
        if (signal.aborted) throw new Error("Interrupted before send.");
        return { ok: false, code: "audit-failed", attempts };
      }
      signal.throwIfAborted();
      attempts++;
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          "content-type": "application/json",
          ...(request.apiKey
            ? { authorization: `Bearer ${request.apiKey}` }
            : {}),
        },
        body,
      });
      if ([429, 502, 503, 504].includes(response.status) && attempt < 2) {
        await response.body?.cancel();
        // Retry-After cannot override the total deadline or force an unbounded wait.
        const seconds = Number(response.headers.get("retry-after"));
        await delay(
          Number.isFinite(seconds) && seconds > 0
            ? Math.min(seconds * 1000, 2000)
            : 100 * (attempt + 1),
          undefined,
          { signal },
        );
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        return { ok: false, code: "http", status: response.status, attempts };
      }
      const reader = response.body?.getReader();
      if (!reader) return { ok: false, code: "malformed-json", attempts };
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > responseLimit) {
          await reader.cancel();
          return { ok: false, code: "response-limit", attempts };
        }
        chunks.push(chunk.value);
      }
      const responseText = Buffer.concat(chunks).toString("utf8");
      if (request.apiKey && responseText.includes(request.apiKey))
        return { ok: false, code: "credential-echo", attempts };
      try {
        return {
          ok: true,
          value: JSON.parse(responseText),
          attempts,
        };
      } catch {
        return { ok: false, code: "malformed-json", attempts };
      }
    }
    return { ok: false, code: "http", attempts };
  } catch {
    // Fetch and parser diagnostics can echo URLs, headers and bodies. Only a stable code crosses.
    return {
      ok: false,
      code: signal.aborted
        ? request.signal?.aborted
          ? "aborted"
          : "timeout"
        : "network",
      attempts,
    };
  } finally {
    clearTimeout(timer);
  }
}
