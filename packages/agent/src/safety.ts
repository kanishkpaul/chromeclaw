import {
  destinationRefusal,
  type BrowserAction,
  type BrowserObservation,
  type TaskPermissions,
} from "@chromeclaw/shared";

export type SafetyDecision = "allow" | "confirm" | "block";
export interface SafetyResult {
  decision: SafetyDecision;
  reason?: string;
}

/** Pure admission. Time and spend come from the runtime, never from page or model text. */
export class SafetyPolicy {
  assess(
    action: BrowserAction,
    context: {
      task: string;
      observation?: BrowserObservation | undefined;
      permissions: TaskPermissions;
      now: number;
      step: number;
      spent: number;
    },
  ): SafetyResult {
    const { permissions, observation } = context;
    const block = (reason: string): SafetyResult => ({
      decision: "block",
      reason,
    });
    if (
      context.now >= permissions.expiresAt ||
      context.step >= permissions.maxSteps ||
      context.spent > permissions.maxCost
    )
      return block("Task budget exhausted.");
    if (!permissions.tools.includes(action.type))
      return block("This tool is outside the fixed task permissions.");
    if (
      !permissions.read &&
      !["finish", "fail", "ask_user"].includes(action.type)
    )
      return block("Page reads are outside the fixed task permissions.");
    // Retain intentional bypass refusal without treating innocent task/page words as authority.
    if (
      /\b(?:bypass|solve|evade)\b.{0,40}\b(?:captcha|paywall|security|bot check)\b|\b(?:steal|phishing)\b/i.test(
        context.task,
      )
    )
      return block("Security, CAPTCHA and access-barrier bypass is refused.");
    if (observation && observation.url !== "about:blank") {
      const refusal = destinationRefusal(observation.url, permissions);
      if (refusal) return block(refusal);
    }
    if (action.type === "navigate" || action.type === "search_web") {
      const destination =
        action.type === "navigate"
          ? action.url
          : `https://duckduckgo.com/?q=${encodeURIComponent(action.query)}`;
      const refusal = destinationRefusal(destination, permissions);
      if (refusal) return block(refusal);
      const url = new URL(destination);
      if (url.search || url.hash) {
        if (
          !observation ||
          observation.url === "about:blank" ||
          new URL(observation.url).origin !== url.origin
        )
          return block(
            "Cross-origin data movement through URL parameters is refused.",
          );
        return permissions.write && permissions.irreversible === "confirm"
          ? {
              decision: "confirm",
              reason:
                "Navigation carries data in a URL. Approve this exact destination.",
            }
          : block(
              "Data-bearing navigation requires write and confirmation permissions.",
            );
      }
      return { decision: "allow" };
    }
    if (
      action.type !== "click" &&
      action.type !== "type" &&
      action.type !== "press"
    )
      return { decision: "allow" };
    const target =
      observation?.snapshotId === action.snapshotId
        ? observation.interactiveElements.find(
            (node) => node.number === action.target,
          )
        : undefined;
    if (!target)
      return block(
        "Target is not in the offered snapshot. Capture the page again.",
      );
    if (target.isCredential)
      return block("Credential entry is refused. Enter it yourself in Chrome.");
    if (!target.isVisible || target.isOccluded || target.isDisabled)
      return block("The observed control is not actionable.");
    if (
      /\b(?:captcha|paywall|security check|bot check)\b/i.test(
        target.name ?? "",
      )
    )
      return block("Access-barrier controls require hand-back.");
    const destination = target.destination ?? target.formDestination;
    if (destination) {
      const refusal = destinationRefusal(destination, permissions);
      if (refusal) return block(refusal);
      if (
        observation &&
        new URL(destination).origin !== new URL(observation.url).origin &&
        (action.type === "type" ||
          target.formDestination ||
          new URL(destination).search ||
          new URL(destination).hash)
      )
        return block(
          "Cross-origin data movement is refused, including form and URL parameters.",
        );
    }
    if (action.type === "type")
      return permissions.write
        ? { decision: "allow" }
        : block("Editing is outside the fixed task permissions.");
    if (action.type === "press" && !["Enter", "Space"].includes(action.key))
      return block(
        "Only target-bound button or link activation is supported. Implicit submission is refused.",
      );
    if (action.type === "press" && !["button", "link"].includes(target.role ?? "")) return block("Implicit keyboard submission is refused. Select the submit control separately.");
    // Label heuristics cannot prove that an unknown handler is harmless. Confirm every remaining
    // activation, including unnamed buttons, instead of guessing that "Continue" cannot commit.
    if (!permissions.write || permissions.irreversible !== "confirm")
      return block(
        "Control activation requires write permission and exact action confirmation.",
      );
    return {
      decision: "confirm",
      reason: `Activate ${target.role ?? "control"} "${target.name || "unnamed"}". Its handler may commit a change.`,
    };
  }
}
