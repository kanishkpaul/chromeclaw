import type {
  BrowserAction,
  BrowserObservation,
  PermissionRequest,
} from "@chromeclaw/shared";

const readTools: BrowserAction["type"][] = [
  "navigate",
  "wait",
  "extract_text",
  "summarize_page",
  "ask_user",
  "finish",
  "fail",
];

/** Ask can only narrow the user's powers; even an explicitly writable session stays read-only. */
export function askPermissions(request: PermissionRequest): PermissionRequest {
  return {
    ...request,
    write: false,
    irreversible: "deny",
    tools: readTools.filter(
      (tool) => !request.tools || request.tools.includes(tool),
    ),
  };
}

export function verifyAsk(
  finish: Extract<BrowserAction, { type: "finish" }>,
  observations: ReadonlyMap<string, BrowserObservation>,
) {
  const references = finish.evidence ?? [];
  const passed =
    references.length > 0 &&
    references.some((reference) => reference.quote === finish.answer) &&
    references.every((reference) => {
      const source = observations.get(reference.snapshotId);
      const passage = source?.passages?.find(
        (passage) =>
          passage.id === reference.passageId &&
          passage.snapshotId === reference.snapshotId,
      );
      return passage && passage.text.includes(reference.quote);
    });
  return {
    passed: Boolean(passed),
    detail: passed
      ? "Snapshot-bound passage citations support the exact extractive answer."
      : "Ask requires an exact extractive answer with resolvable captured passage IDs.",
  };
}

export function askNavigationRefusal(
  action: BrowserAction,
  askUrl: string,
): string | undefined {
  if (action.type !== "navigate") return undefined;
  try {
    if (new URL(action.url).href === new URL(askUrl).href) return undefined;
  } catch {
    return "Ask received an invalid navigation URL.";
  }
  return "Ask cannot leave the user-selected page.";
}
