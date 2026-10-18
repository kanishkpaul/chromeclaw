import { typeIntoTarget } from "@chromeclaw/browser";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["type"],
  effect: "edit",
  input: "native-dom-fallback",
  async execute(action, { session }) {
    if (action.type !== "type")
      return { refused: true, reason: "Tool/action mismatch." };
    return typeIntoTarget(session.page, { ...action, value: action.text });
  },
};
