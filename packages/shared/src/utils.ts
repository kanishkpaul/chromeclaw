import type { BrowserObservation, InteractiveElement } from "./types";

export function truncateMiddle(value: string, maxLength = 8000): string {
  if (value.length <= maxLength) return value;
  const half = Math.floor((maxLength - 32) / 2);
  return `${value.slice(0, half)}\n...[truncated ${value.length - maxLength} chars]...\n${value.slice(-half)}`;
}

export function truncateEnd(value: string, maxLength = 8000): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 32))}\n...[truncated]`;
}

export function rankInteractiveElements(elements: InteractiveElement[], limit = 40): InteractiveElement[] {
  return [...elements]
    .map((element) => ({
      ...element,
      score:
        (element.isVisible ? 20 : 0) +
        (element.name ? 10 : 0) +
        (element.text ? 8 : 0) +
        (element.role ? 6 : 0) +
        (element.href ? 4 : 0) +
        Math.max(0, 10 - (element.text?.length ?? element.name?.length ?? 0) / 40)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function summarizeObservation(observation: BrowserObservation): string {
  const elements = observation.interactiveElements
    .slice(0, 8)
    .map((element) => {
      const label = element.name || element.text || element.selector || element.role || element.id;
      return `${element.role ?? element.tagName ?? "target"}:${label}`;
    })
    .join(" | ");

  return truncateEnd(
    `Title: ${observation.title}\nURL: ${observation.url}\nVisible text: ${observation.visibleText}\nTop targets: ${elements}`,
    1800
  );
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
