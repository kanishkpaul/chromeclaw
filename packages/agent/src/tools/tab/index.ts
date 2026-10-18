import { changeTab } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["open_tab", "switch_tab", "close_tab"],
  effect: "tabs",
  input: "none",
  async execute(action, { session, permissions }) {
    if (
      action.type !== "open_tab" &&
      action.type !== "switch_tab" &&
      action.type !== "close_tab"
    )
      return { refused: true, reason: "Tool/action mismatch." };
    return changeTab(session, action, permissions);
  },
};
