import { pressKey } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["press"],
  effect: "activate",
  input: "trusted",
  async execute(action, { session }) {
    if (action.type !== "press")
      return { refused: true, reason: "Tool/action mismatch." };
    return pressKey(session.page, action.key, action);
  },
};
