import { randomUUID } from "node:crypto";
import type { Page, Request } from "playwright";
import {
  destinationRefusal,
  type Passage,
  type TaskPermissions,
} from "@chromeclaw/shared";
import type { BrowserSession } from "./controller";
import { capturePassages } from "./reading";

export type SourceRead =
  | { kind: "read"; url: string; passages: Passage[]; incomplete: boolean }
  | { kind: "refused"; url: string; reason: string };

/**
 * Background readers share only the owned task context. They never select the foreground page.
 * Compose this admission with guardNavigation before calling read; this is not an action tool.
 */
export function createSourceReaders(
  session: BrowserSession,
  permissions: TaskPermissions,
) {
  const pages = new Map<Page, string>();
  const opening = new Set<Promise<Page>>();
  const visited = new Set<string>();
  let active = 0;
  let closed = false;
  const owns = async (page: Page) => {
    if (pages.has(page)) return true;
    // Compare exact newPage results, so a racing popup cannot borrow reader admission.
    return (await Promise.all([...opening])).includes(page);
  };
  const refusal = (request: Request): string | undefined => {
    const page = request.frame().page();
    const url = new URL(request.url());
    if (closed) return "Source readers are closed.";
    if (
      request.method() !== "GET" ||
      url.search ||
      url.hash ||
      request.redirectedFrom() ||
      !["document", "stylesheet", "image", "font"].includes(
        request.resourceType(),
      )
    )
      return "Source readers allow only static, data-free reads.";
    if (
      request.isNavigationRequest() &&
      (request.frame() !== page.mainFrame() || pages.get(page) !== url.href)
    )
      return "Source navigation differs from the admitted URL.";
    if (new URL(pages.get(page) ?? "about:blank").origin !== url.origin)
      return "Source assets must remain on the admitted origin.";
    return undefined;
  };
  const read = async (
    value: string,
    signal: AbortSignal,
  ): Promise<SourceRead> => {
    const denied = (reason: string): SourceRead => ({
      kind: "refused",
      url: value,
      reason,
    });
    const destination = destinationRefusal(value, permissions);
    if (destination) return denied(destination);
    const url = new URL(value);
    url.hash = "";
    if (url.search) return denied("Source URLs cannot carry query data.");
    if (
      !permissions.read ||
      !permissions.tools.includes("navigate") ||
      Date.now() >= permissions.expiresAt
    )
      return denied("Source reading is outside the current task permissions.");
    if (closed || signal.aborted)
      return denied("Source reading was cancelled.");
    if (active >= 5)
      return denied("The five concurrent reader limit is reached.");
    // Twenty admitted sources is the initial controlled research budget, not a per-batch reset.
    if (visited.size >= 20)
      return denied("The twenty-source task budget is exhausted.");
    if (visited.has(url.href))
      return denied("This source URL was already admitted.");
    visited.add(url.href);
    active++;
    let page: Page | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      void page?.close().catch(() => {
        // Context closure already cancels this reader; the result below remains a refusal.
      });
    };
    const result = await (async (): Promise<SourceRead> => {
      try {
        const pending = session.context.newPage();
        opening.add(pending);
        try {
          page = await pending;
          pages.set(page, url.href);
        } finally {
          opening.delete(pending);
        }
        signal.addEventListener("abort", cancel, { once: true });
        expiry = setTimeout(
          cancel,
          Math.max(1, Math.min(15000, permissions.expiresAt - Date.now())),
        );
        if (closed || signal.aborted)
          return denied("Source reading was cancelled.");
        // Disable inline scripts too. Blocking external scripts alone leaves inline exfiltration.
        const cdp = await session.context.newCDPSession(page);
        try {
          await cdp.send("Emulation.setScriptExecutionDisabled", {
            value: true,
          });
          const response = await page.goto(url.href, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          if (!response?.ok())
            return denied("Source navigation failed or was refused.");
          const captured = await capturePassages(page, randomUUID());
          if (closed || signal.aborted || Date.now() >= permissions.expiresAt)
            return denied("Source reading was cancelled or expired.");
          return {
            kind: "read",
            url: url.href,
            passages: captured.passages,
            incomplete:
              captured.omittedPassages || captured.unreadableRegions > 0,
          };
        } finally {
          await cdp.detach().catch(() => {
            // Cancellation can close the target before its CDP session detaches.
          });
        }
      } catch {
        // Transport diagnostics can contain private URLs. Preserve an explicit per-source failure.
        return denied("Source reading failed, expired or was cancelled.");
      }
    })();
    if (expiry) clearTimeout(expiry);
    signal.removeEventListener("abort", cancel);
    if (page) {
      try {
        await page.close();
        pages.delete(page);
      } catch {
        // Keep ownership for close() to retry, and refuse further tabs after uncertain cleanup.
        closed = true;
        return denied("Source tab cleanup failed; reader pool disabled.");
      }
    }
    active--;
    return result;
  };
  return {
    owns,
    refusal,
    read,
    async close() {
      closed = true;
      await Promise.all(
        [...opening].map(async (pending) =>
          pages.set(await pending, "about:blank"),
        ),
      );
      await Promise.all([...pages.keys()].map((page) => page.close()));
    },
  };
}
