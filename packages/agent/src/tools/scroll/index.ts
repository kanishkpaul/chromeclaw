import { scroll } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["scroll"],
  effect: "read",
  input: "trusted",
  async execute(action, { session }) {
    if (action.type !== "scroll")
      return { refused: true, reason: "Tool/action mismatch." };
    await scroll(session.page, action.direction, action.amount);
    return "Sent trusted scroll input; inspect the fresh capture for movement.";
  },
};
