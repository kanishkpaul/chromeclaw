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
  const [visibleText, interactiveElements, accessibilityTreeSummary] = await Promise.all([
    extractVisibleText(page),
    collectInteractiveElements(page),
    getAccessibilitySnapshot(page)
  ]);

  return {
    url: page.url(),
    title: await page.title(),
    visibleText: truncateEnd(visibleText, 6000),
    interactiveElements: rankInteractiveElements(interactiveElements, 40),
    accessibilityTreeSummary: truncateEnd(accessibilityTreeSummary, 4000),
    screenshotPath: options.screenshotsDir ? await screenshot(page, options.screenshotsDir) : undefined,
    timestamp: new Date().toISOString()
  };
}

export async function getAccessibilitySnapshot(page: Page): Promise<string> {
  try {
    const accessibility = (page as unknown as { accessibility?: { snapshot: (options: { interestingOnly: boolean }) => Promise<AxNode | null> } })
      .accessibility;
    if (!accessibility) return "Accessibility snapshot unavailable in this Playwright runtime.";
    const snapshot = await accessibility.snapshot({ interestingOnly: true });
    return summarizeAxNode(snapshot, 0).join("\n");
  } catch (error) {
    return `Accessibility snapshot unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function clickTarget(page: Page, query: TargetQuery): Promise<string> {
  const locator = await resolveTarget(page, query);
  await locator.click({ timeout: 5000 });
  return `Clicked ${query.selector ?? query.name ?? query.text ?? query.role ?? "target"}`;
}

export async function typeIntoTarget(
  page: Page,
  query: TargetQuery & { value: string; submit?: boolean | undefined }
): Promise<string> {
  const locator = await resolveTarget(page, query);
  await locator.fill(query.value, { timeout: 5000 });
  if (query.submit) {
    await locator.press("Enter");
  }
  return `Typed into ${query.selector ?? query.name ?? query.text ?? "target"}`;
}

export async function screenshot(page: Page, screenshotsDir = ".chromeclaw/screenshots"): Promise<string> {
  await mkdir(screenshotsDir, { recursive: true });
  const filePath = path.resolve(screenshotsDir, `shot-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

export async function extractVisibleText(page: Page): Promise<string> {
  try {
    return await page.locator("body").innerText({ timeout: 5000 });
  } catch {
    return "";
  }
}

export async function scroll(page: Page, direction: "up" | "down" | "left" | "right", amount: number): Promise<void> {
  const deltaX = direction === "left" ? -amount : direction === "right" ? amount : 0;
  const deltaY = direction === "up" ? -amount : direction === "down" ? amount : 0;
  await page.mouse.wheel(deltaX, deltaY);
}

async function collectInteractiveElements(page: Page): Promise<InteractiveElement[]> {
  try {
    return await page.locator("a,button,input,textarea,select,[role=button],[role=link],[contenteditable=true]").evaluateAll(
      (nodes) =>
        nodes.slice(0, 120).map((node, index) => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          const input = element as HTMLInputElement;
          const text = (element.innerText || input.value || element.getAttribute("aria-label") || "").trim();
          const id = element.id ? `#${element.id}` : "";
          const selector = id || element.getAttribute("data-testid") || element.getAttribute("name") || undefined;
          return {
            id: `target-${index}`,
            role: element.getAttribute("role") || element.tagName.toLowerCase(),
            name: element.getAttribute("aria-label") || element.getAttribute("name") || undefined,
            text: text.slice(0, 160) || undefined,
            selector: selector
              ? selector.startsWith("#")
                ? selector
                : `[data-testid="${selector}"], [name="${selector}"]`
              : undefined,
            tagName: element.tagName.toLowerCase(),
            href: element instanceof HTMLAnchorElement ? element.href : undefined,
            isVisible: rect.width > 0 && rect.height > 0,
            score: 0
          };
        })
    );
  } catch {
    return [];
  }
}

interface AxNode {
  role: string;
  name?: string;
  children?: AxNode[];
}

function summarizeAxNode(node: AxNode | null, depth: number): string[] {
  if (!node || depth > 3) return [];
  const current = `${"  ".repeat(depth)}- ${node.role}${node.name ? `: ${node.name}` : ""}`;
  const children = (node.children ?? []).flatMap((child) => summarizeAxNode(child, depth + 1));
  return [current, ...children].slice(0, 80);
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
