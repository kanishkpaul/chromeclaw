import type { BrowserAction, BrowserObservation } from "@chromeclaw/shared";

// Measured on the Phase 6 development set; freeze before Phase 8 held-out evaluation.
export const FIND_CONFIDENCE_THRESHOLD = 0.98;

/**
 * Verify binding and freshness of the cited references, not semantic relevance or a model's
 * claim of absence. Freshness is per reference (D-032): unrelated page activity such as timers
 * or scroll spies does not invalidate a read-only result, but any change to a cited control or
 * passage does. Find never acts, so this never admits an activation.
 */
export async function verifyPageFind(
  finish: Extract<BrowserAction, { type: "finish" }>,
  observation: BrowserObservation,
  current: {
    passagesAreCurrent: (passageIds: string[]) => Promise<boolean>;
    targetIsCurrent: (target: number) => Promise<boolean>;
    description?: string;
  },
): Promise<{ passed: boolean; detail: string }> {
  const result = finish.pageFind;
  const refuse = (detail: string) => ({ passed: false, detail });
  if (!result) return refuse("Find needs a structured pageFind result.");
  const citedPassages =
    result.outcome === "matches"
      ? result.matches.flatMap((match) =>
          "passageId" in match ? [match.passageId] : [],
        )
      : [];
  if (!(await current.passagesAreCurrent(citedPassages)))
    return refuse(
      "Find results are stale. Capture again before choosing a result.",
    );
  if (result.outcome === "no-match")
    return refuse(
      "The model reported no match in the captured viewport; absence is unverified.",
    );
  if (
    result.confidence === undefined ||
    result.confidence < FIND_CONFIDENCE_THRESHOLD
  )
    return refuse(
      "Find confidence is missing or below the frozen development threshold. Clarify the description.",
    );
  const seen = new Set<string>();
  for (const match of result.matches) {
    if (match.snapshotId !== observation.snapshotId)
      return refuse("Find results must reference the current snapshot.");
    const identity =
      "target" in match
        ? `target:${match.target}`
        : `passage:${match.passageId}`;
    if (seen.has(identity))
      return refuse("Find results contain duplicate references.");
    seen.add(identity);
    if ("target" in match) {
      const node = observation.interactiveElements.find(
        (node) => node.number === match.target,
      );
      if (
        !node ||
        node.isCredential ||
        !node.isVisible ||
        node.isOccluded ||
        node.isDisabled ||
        !(await current.targetIsCurrent(match.target))
      )
        return refuse(
          "Find target is unavailable, credential-bearing or stale.",
        );
      const peers = observation.interactiveElements.filter(
        (other) =>
          other.name === node.name &&
          other.role === node.role &&
          !other.isCredential,
      );
      if (peers.length > 1) {
        // Identical offered labels do not establish which one the person intended. Support an
        // explicit ordinal in trusted input; other context disambiguation still needs hand-back.
        const ordinals = [
          ...(current.description ?? "").matchAll(
            /\b(first|second|third|1st|2nd|3rd)\b/gi,
          ),
        ].map((match) =>
          ["first", "1st"].includes(match[1]?.toLowerCase() ?? "")
            ? 0
            : ["second", "2nd"].includes(match[1]?.toLowerCase() ?? "")
              ? 1
              : 2,
        );
        const positions = new Set(ordinals);
        const position = positions.size === 1 ? ordinals[0] : undefined;
        if (position === undefined || peers[position]?.number !== match.target)
          return refuse(
            "Several controls share this label. Clarify a position (first, second or third) before choosing.",
          );
      }
    } else if (
      !observation.passages?.some(
        (passage) =>
          passage.id === match.passageId &&
          passage.snapshotId === match.snapshotId,
      )
    )
      return refuse("Find passage was not offered in this snapshot.");
  }
  // Target checks can cross browser turns; catch changes during those checks as well.
  if (!(await current.passagesAreCurrent(citedPassages)))
    return refuse("Find results changed during validation.");
  for (const match of result.matches)
    if ("target" in match && !(await current.targetIsCurrent(match.target)))
      return refuse("Find results changed during validation.");
  return {
    passed: true,
    detail:
      "Ranked references resolve to the current capture. Relevance is model-proposed, not independently verified. No page controls were activated.",
  };
}
