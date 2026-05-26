import type { Locator, Page } from "playwright";

export interface TargetQuery {
  selector?: string | undefined;
  text?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
}

export function describeTarget(query: TargetQuery): string {
  if (query.selector) return `selector "${query.selector}"`;
  if (query.role && query.name) return `role "${query.role}" named "${query.name}"`;
  if (query.name) return `name "${query.name}"`;
  if (query.text) return `visible text "${query.text}"`;
  return "unspecified target";
}

export async function resolveTarget(page: Page, query: TargetQuery): Promise<Locator> {
  const attempts: Array<{ label: string; locator: Locator }> = [];

  if (query.selector) {
    attempts.push({ label: `selector ${query.selector}`, locator: page.locator(query.selector).first() });
  }

  if (query.role && query.name) {
    attempts.push({
      label: `role ${query.role} named ${query.name}`,
      locator: page.getByRole(query.role as never, { name: new RegExp(escapeRegex(query.name), "i") }).first()
    });
  }

  if (query.name) {
    attempts.push({ label: `label ${query.name}`, locator: page.getByLabel(query.name, { exact: false }).first() });
    attempts.push({ label: `placeholder ${query.name}`, locator: page.getByPlaceholder(query.name, { exact: false }).first() });
    attempts.push({ label: `text ${query.name}`, locator: page.getByText(query.name, { exact: false }).first() });
  }

  if (query.text) {
    attempts.push({ label: `text ${query.text}`, locator: page.getByText(query.text, { exact: false }).first() });
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      await attempt.locator.waitFor({ state: "visible", timeout: 1500 });
      return attempt.locator;
    } catch (error) {
      errors.push(`${attempt.label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }

  throw new Error(`Could not resolve ${describeTarget(query)}. Tried ${attempts.length} strategies. ${errors.join(" | ")}`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
