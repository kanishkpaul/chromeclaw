import { setTimeout as delay } from "node:timers/promises";
import type { BrowserTool } from "../contract";
export const tool: BrowserTool = {
  actions: ["wait"],
  effect: "wait",
  input: "none",
  async execute(action, { signal }) {
    if (action.type !== "wait")
      return { refused: true, reason: "Tool/action mismatch." };
    await delay(action.ms, undefined, { signal });
    return `Waited ${action.ms}ms`;
  },
};
