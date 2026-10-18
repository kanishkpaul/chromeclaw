import type { BrowserAction, TaskPermissions } from "@chromeclaw/shared";
import type { BrowserSession, BrowserRefusal } from "@chromeclaw/browser";

export interface BrowserTool {
  readonly actions: readonly BrowserAction["type"][];
  readonly effect: "navigate" | "activate" | "edit" | "read" | "wait" | "tabs";
  readonly input: "trusted" | "native-dom-fallback" | "none";
  execute(
    action: BrowserAction,
    context: {
      session: BrowserSession;
      permissions: TaskPermissions;
      signal: AbortSignal;
    },
  ): Promise<string | BrowserRefusal>;
}
