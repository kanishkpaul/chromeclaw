import { goBack } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["back"],
  effect: "navigate",
  input: "none",
  async execute(action, { session }) {
    if (action.type !== "back")
      return { refused: true, reason: "Tool/action mismatch." };
    return goBack(session.page, action.url);
  },
};
