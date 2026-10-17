import type { BrowserAction, PermissionRequest } from "@chromeclaw/shared";

const readTools: BrowserAction["type"][] = [
  "navigate",
  "wait",
  "extract_text",
  "summarize_page",
  "ask_user",
  "finish",
  "fail",
];

/** Page reading can only narrow the user's powers; even an explicitly writable session stays read-only. */
export function readOnlyPagePermissions(
  request: PermissionRequest,
): PermissionRequest {
  return {
    ...request,
    write: false,
    irreversible: "deny",
    tools: readTools.filter(
      (tool) => !request.tools || request.tools.includes(tool),
    ),
  };
}

export function pageNavigationRefusal(
  action: BrowserAction,
  pageUrl: string,
): string | undefined {
  if (action.type !== "navigate") return undefined;
  try {
    if (new URL(action.url).href === new URL(pageUrl).href) return undefined;
  } catch {
    return "Read-only page mode received an invalid navigation URL.";
  }
  return "Read-only page mode cannot leave the user-selected page.";
}
