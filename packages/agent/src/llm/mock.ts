import type { BrowserAction } from "@chromeclaw/shared";
import type { Planner, PlannerInput } from "./index";

export class MockPlanner implements Planner {
  name = "mock";

  constructor(public model = "mock-browser-operator") {}

  async plan(input: PlannerInput): Promise<BrowserAction> {
    const task = input.task.toLowerCase();
    const url = input.observation.url.toLowerCase();
    const title = input.observation.title || "Untitled";

    if (task.includes("example.com") || task.includes("example domain")) {
      if (!url.includes("example.com")) {
        return {
          type: "navigate",
          url: "https://example.com",
          thoughtSummary: "Open the target page first so I can inspect its title."
        };
      }
      return {
        type: "finish",
        answer: `The page title is "${title}".`,
        thoughtSummary: "The requested page is open and the title is visible in the browser state."
      };
    }

    if (task.includes("hacker news") || task.includes("hn")) {
      if (!url.includes("news.ycombinator.com")) {
        return {
          type: "navigate",
          url: "https://news.ycombinator.com",
          thoughtSummary: "Open Hacker News to inspect the current front page."
        };
      }
      if (input.recentSteps.includes("extract_text")) {
        return {
          type: "finish",
          answer: `I inspected the Hacker News front page. The visible top content begins: ${input.observation.visibleText.slice(0, 500)}`,
          thoughtSummary: "The page text has been extracted, so I can summarize the visible front-page content."
        };
      }
      return {
        type: "extract_text",
        thoughtSummary: "Extract the visible front-page text so the next response can identify the top story."
      };
    }

    if (task.includes("playwright") && (task.includes("docs") || task.includes("documentation"))) {
      if (!url.includes("playwright.dev")) {
        return {
          type: "navigate",
          url: "https://playwright.dev/docs/accessibility-testing",
          thoughtSummary: "Go directly to the official Playwright documentation."
        };
      }
      return {
        type: "finish",
        answer: `Opened official Playwright docs: ${input.observation.url}`,
        thoughtSummary: "The official documentation page is open."
      };
    }

    if (url === "about:blank") {
      return {
        type: "search_web",
        query: input.task,
        thoughtSummary: "No page is open yet, so search the web for the task."
      };
    }

    return {
      type: "finish",
      answer: `I inspected "${title}" at ${input.observation.url}. Visible text starts with: ${input.observation.visibleText.slice(0, 500)}`,
      thoughtSummary: "The browser has enough visible page content to provide a concise answer."
    };
  }
}
