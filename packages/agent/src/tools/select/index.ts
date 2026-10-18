import { selectTarget } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["select"],
  effect: "edit",
  input: "native-dom-fallback",
  async execute(action, { session }) {
    if (action.type !== "select")
      return { refused: true, reason: "Tool/action mismatch." };
    return selectTarget(session.page, action);
  },
};
