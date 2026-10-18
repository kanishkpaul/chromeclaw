import { admitOwnedTab } from "./tabs";
import { lookup } from "node:dns/promises";
import type { Page, Request } from "playwright";
import type { BrowserSession } from "./controller";
import { destinationRefusal, type TaskPermissions } from "@chromeclaw/shared";

/** All browser HTTP requests, including redirects and popups, pass the same origin boundary.
 * A one-request ticket admits an approved form/link destination. It cannot grant a new origin.
 */
export async function guardNavigation(
  session: BrowserSession,
  permissions: TaskPermissions,
  readers?: {
    owns: (page: Page) => Promise<boolean>;
    refusal: (request: Request) => string | undefined;
    permitsQuery?: (request: Request) => boolean;
  },
) {
  let ticket: string | undefined;
  const refusals: string[] = [];
  await session.context.routeWebSocket("**/*", (socket) => socket.close());
  await session.context.route("**/*", async (route) => {
    try {
      const request = route.request();
      let refusal =
        Date.now() >= permissions.expiresAt
          ? "Task time budget exhausted."
          : !permissions.read
            ? "Page reads are outside task permissions."
            : destinationRefusal(request.url(), permissions);
      const url = new URL(request.url());
      if (!refusal) {
        const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), {
          all: true,
        }).catch(() => []);
        if (!addresses.length) refusal = "Destination DNS resolution failed.";
        for (const address of addresses) {
          // Reuse parsed-IP restrictions. The requested origin remains the authority, not its IP.
          const ipOrigin = `${url.protocol}//${address.family === 6 ? `[${address.address}]` : address.address}${url.port ? `:${url.port}` : ""}`;
          if (
            destinationRefusal(ipOrigin, {
              ...permissions,
              origins: [new URL(ipOrigin).origin],
            })
          )
            refusal = "Destination resolves to a restricted address.";
        }
      }
      let frame;
      try {
        frame = request.frame();
      } catch {
        // Popup navigation may be intercepted before it has a frame. It has no authority.
        refusals.push(
          "A request without an established task frame is refused.",
        );
        await route.abort("blockedbyclient");
        return;
      }
      const isReader = Boolean(readers && (await readers.owns(frame.page())));
      if (isReader) refusal ??= readers?.refusal(request);
      if (frame.page() !== session.page && !isReader)
        refusal = "New tabs and popups are outside this task.";
      const source = frame.url();
      const carriesData =
        (request.method() !== "GET" && request.method() !== "HEAD") ||
        Boolean(url.search);
      if (
        !refusal &&
        carriesData &&
        !(isReader && readers?.permitsQuery?.(request))
      ) {
        const destination = `${url.origin}${url.pathname}`;
        if (source === "about:blank" || new URL(source).origin !== url.origin)
          refusal = "Cross-origin request data is refused.";
        else if (ticket !== destination)
          refusal = "A data-bearing request requires exact action approval.";
        else ticket = undefined;
      }
      if (refusal) {
        refusals.push(refusal);
        await route.abort("blockedbyclient");
      } else {
        const headers = { ...request.headers() };
        // An approved read on another origin must not disclose the previous page URL.
        delete headers.referer;
        // Playwright routes only the first URL of a redirect chain. Automatic continuation
        // would let a permitted URL redirect off-origin without another admission decision.
        const response = await route
          .fetch({ headers, maxRedirects: 0, timeout: 15000 })
          .catch(() => undefined);
        if (!response) {
          // Network/close failures are refusal outcomes. Transport diagnostics may contain secrets.
          refusals.push("The guarded browser request failed.");
          await route.abort("failed").catch(() => {
            // A closing context has already aborted the request.
          });
          return;
        }
        if (
          response.status() >= 300 &&
          response.status() < 400 &&
          response.headers().location
        ) {
          refusals.push(
            "Redirects require a fresh, permitted navigation. No redirect was followed.",
          );
          await route.abort("blockedbyclient");
        } else if (
          /attachment/i.test(response.headers()["content-disposition"] ?? "")
        ) {
          refusals.push("Downloads require hand-back.");
          await route.abort("blockedbyclient");
        } else await route.fulfill({ response });
        await response.dispose();
      }
    } catch {
      // Page closure may race an in-flight route or response disposal. A live transport error
      // is a refusal, with diagnostics withheld because URLs and bodies can contain secrets.
      if (!session.page.isClosed())
        refusals.push("The guarded browser request could not complete safely.");
      await route.abort("failed").catch(() => {
        // Closing the context has already aborted this request.
      });
    }
  });
  session.context.on("page", async (page) => {
    if (
      page !== session.page &&
      !(await admitOwnedTab(session, page)) &&
      !(readers && (await readers.owns(page)))
    )
      void page.close().catch(() => {
        // The browser may have already closed a blocked popup.
      });
  });
  session.page.on("download", (download) => {
    void download.cancel();
  });
  return {
    authorize(destination?: string) {
      ticket =
        destination &&
        permissions.write &&
        permissions.irreversible === "confirm" &&
        Date.now() < permissions.expiresAt
          ? `${new URL(destination).origin}${new URL(destination).pathname}`
          : undefined;
    },
    clear() {
      ticket = undefined;
    },
    refusal() {
      return refusals.shift();
    },
  };
}
