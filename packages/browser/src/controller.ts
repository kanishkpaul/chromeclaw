import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import {
  truncateEnd,
  type BrowserObservation,
  type InteractiveElement,
} from "@chromeclaw/shared";
import {
  captureTargets,
  activateTarget,
  resolveTarget,
  type TargetQuery,
} from "./targets";
import { backDestination } from "./tabs";
import { capturePassages } from "./reading";
import { inspectField } from "./credentials";

export interface BrowserOptions {
  readPassages?: boolean | undefined;
  readHistory?: boolean | undefined;
  headless?: boolean | undefined;
  profileDir?: string | undefined;
  screenshotsDir?: string | undefined;
}

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export async function openBrowser(
  options: BrowserOptions = {},
): Promise<BrowserSession> {
  const profileDir = path.resolve(options.profileDir ?? ".chromeclaw/profile");
  await mkdir(profileDir, { recursive: true });
  const { chromium } = await import(/* webpackIgnore: true */ "playwright");

  const launchOptions: NonNullable<
    Parameters<typeof chromium.launchPersistentContext>[1]
  > = {
    headless: options.headless ?? false,
    // The runtime owns SIGINT so it can persist and print the stopped outcome before exit.
    handleSIGINT: false,
    serviceWorkers: "block",
    acceptDownloads: false,
    viewport: { width: 1440, height: 1000 },
  };

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      ...launchOptions,
      channel: "chrome",
    });
  } catch {
    context = await chromium.launchPersistentContext(profileDir, launchOptions);
  }

  const page = await newPage(context);
  return {
    context,
    page,
    close: async () => {
      await context.close();
    },
  };
}

export async function newPage(context: BrowserContext): Promise<Page> {
  const existing = context.pages()[0];
  if (existing) return existing;
  return context.newPage();
}

export async function navigate(page: Page, url: string): Promise<void> {
  const normalized = normalizeUrl(url);
  await page.goto(normalized, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
}

export async function getPageSnapshot(
  page: Page,
  options: BrowserOptions = {},
): Promise<BrowserObservation> {
  try {
    return await capturePage(page, options);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/Execution context was destroyed|Cannot find context|detached/.test(
        error.message,
      )
    )
      throw error;
    // A navigation can start between native activation and the next capture. Recapture once;
    // this retries observation only and never repeats the possibly consequential action.
    await page.waitForLoadState("domcontentloaded");
    return capturePage(page, options);
  }
}

async function capturePage(
  page: Page,
  options: BrowserOptions,
): Promise<BrowserObservation> {
  const visibleText = await extractVisibleText(page);
  const capture = await captureTargets(page);
  return {
    ...capture,
    ...(options.readHistory
      ? await backDestination(page).then((backUrl) =>
          backUrl && backUrl !== "about:blank" ? { backUrl } : {},
        )
      : {}),
    ...(options.readPassages
      ? await capturePassages(page, capture.snapshotId)
      : {}),
    url: page.url(),
    title: await page.title(),
    visibleText: truncateEnd(visibleText, 6000),
    accessibilityTreeSummary: safeAccessibilitySummary(
      capture.interactiveElements,
    ),
    screenshotPath: options.screenshotsDir
      ? await screenshot(page, options.screenshotsDir)
      : undefined,
    timestamp: new Date().toISOString(),
  };
}

function safeAccessibilitySummary(
  targets: readonly InteractiveElement[],
): string {
  return [
    "Safe DOM target summary. Native AX field values are not captured.",
    ...targets.map(
      (target) =>
        `${target.role ?? target.tagName}: ${target.name || target.text || "unnamed"}${target.isCredential ? " (credential, value withheld)" : ""}`,
    ),
  ].join("\n");
}

export async function getAccessibilitySnapshot(page: Page): Promise<string> {
  return safeAccessibilitySummary(
    (await captureTargets(page)).interactiveElements,
  );
}

export async function clickTarget(
  page: Page,
  query: TargetQuery,
): Promise<string | BrowserRefusal> {
  const outcome = await activateTarget(page, query);
  return outcome === "acted" || outcome === "toggled"
    ? `Activated target ${query.target} through trusted browser input.${outcome === "toggled" ? " Verified native toggle." : ""}`
    : {
        refused: true,
        ...(outcome === "uncertain" ? { uncertain: true } : {}),
        reason:
          outcome === "uncertain"
            ? "Activation acknowledgment is uncertain. Do not repeat this control. Ask the user."
            : "Target is stale or unavailable. Capture the page again.",
      };
}

export interface BrowserRefusal {
  refused: true;
  reason: string;
  uncertain?: boolean;
}

/** Refuses credentials independently of the planner and policy. Never submits implicitly. */
export async function typeIntoTarget(
  page: Page,
  query: TargetQuery & { value: string; submit?: boolean | undefined },
): Promise<string | BrowserRefusal> {
  if (query.submit)
    return {
      refused: true,
      reason:
        "Implicit submit is disabled. Request the submit control separately.",
    };
  const target = await resolveTarget(page, query);
  if (!target)
    return {
      refused: true,
      reason: "Target is stale or unavailable. Capture the page again.",
    };
  const element = target.element;
  try {
    const before = await element.evaluate(inspectField);
    if (before.credential)
      return {
        refused: true,
        reason: "Credential entry is refused. Enter it yourself in Chrome.",
      };
    if (
      (await element.evaluate(inspectField, { verify: query.value })).verified
    )
      return `No change: target ${query.target} already matches the requested text. This field write is complete.`;
    await element.focus();
    if (!(await resolveTarget(page, query)))
      return {
        refused: true,
        reason: "Target changed during focus. Capture the page again.",
      };
    const result = await element.evaluate(inspectField, {
      value: query.value,
      state: target.state,
    });
    if (
      result.written &&
      !(await element.evaluate(inspectField, { verify: query.value })).verified
    )
      return {
        refused: true,
        reason:
          "No change after an ordinary field write. Capture the page again.",
      };
    return result.written
      ? `Typed into target ${query.target}. Verified that the field matches the proposed text. This write is complete. Native DOM setter fallback; input/change events are untrusted.`
      : {
          refused: true,
          reason: result.refusal ?? "The field could not be written.",
        };
  } catch {
    return {
      refused: true,
      reason: "The target changed or could not be edited safely.",
    };
  }
}

/** A select uses an exact offered label; option values never leave the browser. */
export async function selectTarget(
  page: Page,
  query: TargetQuery & { option: string },
): Promise<string | BrowserRefusal> {
  const target = await resolveTarget(page, query);
  if (
    !target ||
    target.metadata.options?.filter((option) => option === query.option)
      .length !== 1
  )
    return {
      refused: true,
      reason: "Option or target is stale. Capture the page again.",
    };
  if ((await target.element.evaluate(inspectField)).credential)
    return {
      refused: true,
      reason: "Credential entry is refused. Enter it yourself in Chrome.",
    };
  const alreadySelected = await target.element.evaluate(
    (node, label) =>
      node instanceof HTMLSelectElement &&
      !node.multiple &&
      node.selectedOptions.length === 1 &&
      node.selectedOptions[0]?.label === label,
    query.option,
  );
  if (alreadySelected)
    return `No change: target ${query.target} already has the requested selection. This field write is complete.`;
  await target.element.focus();
  if (!(await resolveTarget(page, query)))
    return {
      refused: true,
      reason: "Select changed during focus. Capture the page again.",
    };
  const outcome = await target.element.evaluate(inspectField, {
    select: query.option,
    state: target.state,
  });
  if (!outcome.written)
    return {
      refused: true,
      reason: outcome.refusal ?? "The select could not be edited safely.",
    };
  const verified = await target.element.evaluate(
    (node, label) =>
      node instanceof HTMLSelectElement &&
      node.isConnected &&
      node.selectedOptions.length === 1 &&
      node.selectedOptions[0]?.label === label,
    query.option,
  );
  return verified
    ? `Selected the offered option in target ${query.target}. Verified selection; native DOM setter fallback, input/change events are untrusted.`
    : {
        refused: true,
        uncertain: true,
        reason:
          "Selection changed after input. Do not repeat without inspection.",
      };
}

/** Keyboard input cannot be used as a second path into a credential field. */
export async function pressKey(
  page: Page,
  key: string,
  query?: TargetQuery,
): Promise<string | BrowserRefusal> {
  if (!query)
    return {
      refused: true,
      reason: "Keyboard actions require an observed target.",
    };
  const target = await resolveTarget(page, query);
  if (!target)
    return {
      refused: true,
      reason: "Target is stale. Capture the page again.",
    };
  if (target.metadata.isCredential || !["Enter", "Space"].includes(key)) {
    return {
      refused: true,
      reason:
        "Credential input, character input, paste and implicit keyboard submission are refused.",
    };
  }
  const outcome = await activateTarget(page, query, key);
  return outcome === "acted" || outcome === "toggled"
    ? `Activated target ${query.target} with trusted ${key} browser input.${outcome === "toggled" ? " Verified native toggle." : ""}`
    : {
        refused: true,
        ...(outcome === "uncertain" ? { uncertain: true } : {}),
        reason:
          outcome === "uncertain"
            ? "Activation acknowledgment is uncertain. Do not repeat this control."
            : "Keyboard activation requires a current button or link. Capture the page again.",
      };
}

export async function screenshot(
  page: Page,
  screenshotsDir = ".chromeclaw/screenshots",
): Promise<string | undefined> {
  if ((await hasCredentialFields(page)) || page.frames().length > 1)
    return undefined;
  await mkdir(screenshotsDir, { recursive: true });
  const filePath = path.resolve(screenshotsDir, `shot-${Date.now()}.png`);
  await page.screenshot({
    path: filePath,
    fullPage: false,
    mask: [
      page.locator("input,textarea,select,[contenteditable],iframe,frame"),
    ],
  });
  return filePath;
}

export async function extractVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    if (!document.body) return "";
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const parts: string[] = [];
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (
        !parent ||
        parent.closest(
          "input,textarea,select,[contenteditable],script,style,noscript",
        )
      )
        continue;
      const style = getComputedStyle(parent);
      if (
        !parent.getClientRects().length ||
        style.visibility !== "visible" ||
        style.opacity === "0"
      )
        continue;
      const text = walker.currentNode.textContent?.trim();
      if (text) parts.push(text);
    }
    return parts.join("\n");
  });
}

export async function scroll(
  page: Page,
  direction: "up" | "down" | "left" | "right",
  amount: number,
): Promise<void> {
  const deltaX =
    direction === "left" ? -amount : direction === "right" ? amount : 0;
  const deltaY =
    direction === "up" ? -amount : direction === "down" ? amount : 0;
  const before = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  await page.mouse.wheel(deltaX, deltaY);
  // Wheel dispatch is asynchronous. Wait for viewport movement before the next capture;
  // a boundary or nested scroller may not move the window and reaches the bounded timeout.
  await page
    .waitForFunction(
      (before) => scrollX !== before.x || scrollY !== before.y,
      before,
      { timeout: 1000 },
    )
    .catch((error: unknown) => {
      // No viewport movement is normal at a boundary. Preserve disconnect/driver failures.
      if (!(error instanceof Error) || error.name !== "TimeoutError")
        throw error;
    });
}

async function hasCredentialFields(page: Page): Promise<boolean> {
  const elements = await page
    .locator("input,textarea,[contenteditable]")
    .elementHandles();
  try {
    for (const element of elements)
      if ((await element.evaluate(inspectField)).credential) return true;
    return false;
  } finally {
    await Promise.all(elements.map((element) => element.dispose()));
  }
}

function normalizeUrl(url: string): string {
  return new URL(url).href;
}
