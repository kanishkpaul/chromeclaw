import { navigate } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["navigate"],
  effect: "navigate",
  input: "none",
  async execute(action, { session }) {
    if (action.type !== "navigate")
      return { refused: true, reason: "Tool/action mismatch." };
    await navigate(session.page, action.url);
    return "Navigated to the permitted destination.";
  },
};
