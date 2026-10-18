import type { Page } from "playwright";
import { destinationRefusal, type TaskPermissions } from "@chromeclaw/shared";
import type { BrowserSession, BrowserRefusal } from "./controller";

interface OwnedTabs {
  pages: Map<string, Page>;
  next: number;
  opening?: {
    result: Promise<Page | undefined>;
    resolve: (page: Page | undefined) => void;
  };
}
const sessions = new WeakMap<BrowserSession, OwnedTabs>();
function owned(session: BrowserSession): OwnedTabs {
  let tabs = sessions.get(session);
  if (!tabs) {
    tabs = { pages: new Map([["1", session.page]]), next: 2 };
    sessions.set(session, tabs);
  }
  return tabs;
}

/** Only a tab explicitly opened by this adapter may join the task. Popups stay refused. */
export async function admitOwnedTab(
  session: BrowserSession,
  page: Page,
): Promise<boolean> {
  const tabs = owned(session);
  if ([...tabs.pages.values()].includes(page)) return true;
  // Await the exact Page returned by context.newPage. A racing noopener popup cannot consume it.
  return Boolean(tabs.opening && (await tabs.opening.result) === page);
}
export function listOwnedTabs(session: BrowserSession) {
  const tabs = owned(session);
  for (const [id, page] of tabs.pages)
    if (page.isClosed()) tabs.pages.delete(id);
  return [...tabs.pages].map(([id, page]) => ({
    id,
    url: page.url(),
    active: page === session.page,
  }));
}
export async function changeTab(
  session: BrowserSession,
  action:
    | { type: "open_tab"; url: string }
    | { type: "switch_tab" | "close_tab"; tabId: string },
  permissions: TaskPermissions,
): Promise<string | BrowserRefusal> {
  const tabs = owned(session);
  const refuse = (reason: string): BrowserRefusal => ({
    refused: true,
    reason,
  });
  if (
    !permissions.read ||
    Date.now() >= permissions.expiresAt ||
    !permissions.tools.includes(action.type)
  )
    return refuse("Tab operation is outside the current task permissions.");
  listOwnedTabs(session);
  if (action.type === "open_tab") {
    const url = new URL(action.url);
    const refusal = destinationRefusal(url.href, permissions);
    if (refusal || url.search || url.hash)
      return refuse(refusal ?? "New tabs cannot carry URL data.");
    if (tabs.pages.size >= 5)
      return refuse("The five owned-tab limit is reached.");
    let resolve: (page: Page | undefined) => void = () => undefined;
    const result = new Promise<Page | undefined>((accept) => {
      resolve = accept;
    });
    tabs.opening = { result, resolve };
    try {
      const page = await session.context.newPage();
      tabs.pages.set(String(tabs.next++), page);
      session.page = page;
      page.on("download", (download) => void download.cancel());
      resolve(page);
      await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      return "Opened an owned task tab.";
    } finally {
      resolve(undefined);
      delete tabs.opening;
    }
  }
  const page = tabs.pages.get(action.tabId);
  if (!page || page.isClosed())
    return refuse("Tab is not in the owned task list.");
  const refusal = destinationRefusal(page.url(), permissions);
  if (page.url() !== "about:blank" && refusal) return refuse(refusal);
  if (action.type === "switch_tab") {
    session.page = page;
    await page.bringToFront();
    return "Switched to the observed owned tab.";
  }
  if (tabs.pages.size === 1)
    return refuse(
      "The last task tab must remain open; cancel the task to close it.",
    );
  tabs.pages.delete(action.tabId);
  if (session.page === page) {
    const next = tabs.pages.values().next().value;
    if (!next) return refuse("No owned tab remains.");
    session.page = next;
  }
  await page.close();
  return "Closed the observed owned tab.";
}

/** CDP history belongs only to this owned task page, never a personal profile database. */
export async function backDestination(page: Page): Promise<string | undefined> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const history = await cdp.send("Page.getNavigationHistory");
    return history.entries[history.currentIndex - 1]?.url;
  } finally {
    await cdp.detach();
  }
}
export async function goBack(
  page: Page,
  expected: string,
): Promise<string | BrowserRefusal> {
  if ((await backDestination(page)) !== expected)
    return {
      refused: true,
      reason: "History changed. Capture the page again.",
    };
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
  return "Returned to the offered history destination.";
}
