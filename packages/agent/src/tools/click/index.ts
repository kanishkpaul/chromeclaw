import { clickTarget } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["click"],
  effect: "activate",
  input: "trusted",
  async execute(action, { session }) {
    if (action.type !== "click")
      return { refused: true, reason: "Tool/action mismatch." };
    return clickTarget(session.page, action);
  },
};
