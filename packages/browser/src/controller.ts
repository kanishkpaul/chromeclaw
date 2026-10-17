import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import {
  rankInteractiveElements,
  truncateEnd,
  type BrowserObservation,
  type InteractiveElement
} from "@chromeclaw/shared";
import { resolveTarget, type TargetQuery } from "./targets";
import { inspectField } from "./credentials";

export interface BrowserOptions {
  headless?: boolean | undefined;
  profileDir?: string | undefined;
  screenshotsDir?: string | undefined;
}

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export async function openBrowser(options: BrowserOptions = {}): Promise<BrowserSession> {
  const profileDir = path.resolve(options.profileDir ?? ".chromeclaw/profile");
  await mkdir(profileDir, { recursive: true });
  const { chromium } = await import(/* webpackIgnore: true */ "playwright");

  const launchOptions = {
    headless: options.headless ?? false,
    viewport: { width: 1440, height: 1000 }
  };

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir, { ...launchOptions, channel: "chrome" });
  } catch {
    context = await chromium.launchPersistentContext(profileDir, launchOptions);
  }

  const page = await newPage(context);
  return {
    context,
    page,
    close: async () => {
      await context.close();
    }
  };
}

export async function newPage(context: BrowserContext): Promise<Page> {
  const existing = context.pages()[0];
  if (existing) return existing;
  return context.newPage();
}

export async function navigate(page: Page, url: string): Promise<void> {
  const normalized = normalizeUrl(url);
  await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: 30000 });
}

export async function getPageSnapshot(page: Page, options: BrowserOptions = {}): Promise<BrowserObservation> {
  const [visibleText, interactiveElements] = await Promise.all([
    extractVisibleText(page),
    collectInteractiveElements(page)
  ]);

  return {
    url: page.url(),
    title: await page.title(),
    visibleText: truncateEnd(visibleText, 6000),
    interactiveElements: rankInteractiveElements(interactiveElements, 40),
    accessibilityTreeSummary: truncateEnd(safeAccessibilitySummary(interactiveElements), 4000),
    screenshotPath: options.screenshotsDir ? await screenshot(page, options.screenshotsDir) : undefined,
    timestamp: new Date().toISOString()
  };
}

function safeAccessibilitySummary(targets: readonly InteractiveElement[]): string {
  return ["Safe DOM target summary. Native AX field values are not captured.",
    ...targets.map((target) => `${target.role ?? target.tagName}: ${target.name || target.text || "unnamed"}${target.isCredential ? " (credential, value withheld)" : ""}`)
  ].join("\n");
}

export async function getAccessibilitySnapshot(page: Page): Promise<string> {
  return safeAccessibilitySummary(await collectInteractiveElements(page));
}

export async function clickTarget(page: Page, query: TargetQuery): Promise<string> {
  const locator = await resolveTarget(page, query);
  await locator.click({ timeout: 5000 });
  return `Clicked ${query.selector ?? query.name ?? query.text ?? query.role ?? "target"}`;
}

export interface BrowserRefusal {
  refused: true;
  reason: string;
}

/** Refuses credentials independently of the planner and policy. Never submits implicitly. */
export async function typeIntoTarget(
  page: Page,
  query: TargetQuery & { value: string; submit?: boolean | undefined }
): Promise<string | BrowserRefusal> {
  if (query.submit) return { refused: true, reason: "Implicit submit is disabled. Request the submit control separately." };
  // An unavailable model target is an expected refusal. Resolver errors can include raw selectors.
  const locator = await resolveTarget(page, query).catch(() => undefined);
  if (!locator) return { refused: true, reason: "The target could not be resolved safely." };
  const element = await locator.elementHandle();
  if (!element) return { refused: true, reason: "The target is no longer attached." };
  try {
    const before = await element.evaluate(inspectField);
    if (before.credential) return { refused: true, reason: "Credential entry is refused. Enter it yourself in Chrome." };
    await element.focus();
    const result = await element.evaluate(inspectField, query.value);
    return result.written ? `Typed into ${query.selector ?? query.name ?? query.text ?? "target"}`
      : { refused: true, reason: result.refusal ?? "The field could not be written." };
  } catch {
    // Focus handlers can detach the target, and browser validation can echo field contents.
    return { refused: true, reason: "The target changed or could not be edited safely." };
  } finally {
    await element.dispose();
  }
}

/** Keyboard input cannot be used as a second path into a credential field. */
export async function pressKey(page: Page, key: string): Promise<string | BrowserRefusal> {
  for (const frame of page.frames()) {
    const focused = await frame.locator(":focus").elementHandles();
    try {
      for (const element of focused) {
        if ((await element.evaluate(inspectField)).credential) {
          return { refused: true, reason: "Keyboard input into a credential field is refused. Continue in Chrome." };
        }
      }
    } finally {
      await Promise.all(focused.map((element) => element.dispose()));
    }
  }
  // Characters, paste shortcuts and activation keys can write or submit. Until target-bound
  // keyboard actions arrive, only these non-writing navigation keys are admitted.
  if (!["Tab", "Shift+Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(key)) {
    return { refused: true, reason: "This key needs a target-bound action. Character input, paste and keyboard submission are disabled." };
  }
  await page.keyboard.press(key);
  return `Pressed ${key}`;
}

export async function screenshot(page: Page, screenshotsDir = ".chromeclaw/screenshots"): Promise<string | undefined> {
  if (await hasCredentialFields(page) || page.frames().length > 1) return undefined;
  await mkdir(screenshotsDir, { recursive: true });
  const filePath = path.resolve(screenshotsDir, `shot-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false, mask: [page.locator("input,textarea,select,[contenteditable],iframe,frame")] });
  return filePath;
}

export async function extractVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    if (!document.body) return "";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || parent.closest("input,textarea,select,[contenteditable],script,style,noscript")) continue;
      const style = getComputedStyle(parent);
      if (!parent.getClientRects().length || style.visibility !== "visible" || style.opacity === "0") continue;
      const text = walker.currentNode.textContent?.trim();
      if (text) parts.push(text);
    }
    return parts.join("\n");
  });
}

export async function scroll(page: Page, direction: "up" | "down" | "left" | "right", amount: number): Promise<void> {
  const deltaX = direction === "left" ? -amount : direction === "right" ? amount : 0;
  const deltaY = direction === "up" ? -amount : direction === "down" ? amount : 0;
  await page.mouse.wheel(deltaX, deltaY);
}

async function hasCredentialFields(page: Page): Promise<boolean> {
  const elements = await page.locator("input,textarea,[contenteditable]").elementHandles();
  try {
    for (const element of elements) if ((await element.evaluate(inspectField)).credential) return true;
    return false;
  } finally {
    await Promise.all(elements.map((element) => element.dispose()));
  }
}

async function collectInteractiveElements(page: Page): Promise<InteractiveElement[]> {
  const elements = await page.locator("a,button,input,textarea,select,[role=button],[role=link],[contenteditable=true]").elementHandles();
  try {
    const targets: InteractiveElement[] = [];
    for (const [index, element] of elements.slice(0, 120).entries()) {
      const field = await element.evaluate(inspectField);
      const target = await element.evaluate((node, position) => {
        if (!(node instanceof Element)) throw new Error("Capture target is not an element.");
        const rect = node.getBoundingClientRect();
        const testId = node.getAttribute("data-testid");
        const name = node.getAttribute("name");
        const selector = node.id ? `#${CSS.escape(node.id)}` : testId ? `[data-testid="${CSS.escape(testId)}"]`
          : name ? `[name="${CSS.escape(name)}"]` : undefined;
        return {
          id: `target-${position}`, role: node.getAttribute("role") || node.tagName.toLowerCase(),
          selector, tagName: node.tagName.toLowerCase(),
          href: node instanceof HTMLAnchorElement ? node.href : undefined,
          isVisible: rect.width > 0 && rect.height > 0, score: 0
        };
      }, index);
      targets.push({ ...target, name: field.label || undefined, text: field.text.slice(0, 160) || undefined, isCredential: field.credential });
    }
    return targets;
  } finally {
    await Promise.all(elements.map((element) => element.dispose()));
  }
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
