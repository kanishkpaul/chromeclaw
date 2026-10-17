import type { BrowserAction, BrowserObservation } from "@chromeclaw/shared";

/** Verify binding and freshness, not semantic relevance or a model's claim of absence. */
export async function verifyPageFind(
  finish: Extract<BrowserAction, { type: "finish" }>,
  observation: BrowserObservation,
  current: {
    snapshotIsCurrent: () => Promise<boolean>;
    targetIsCurrent: (target: number) => Promise<boolean>;
  },
): Promise<{ passed: boolean; detail: string }> {
  const result = finish.pageFind;
  const refuse = (detail: string) => ({ passed: false, detail });
  if (!result) return refuse("Find needs a structured pageFind result.");
  if (!(await current.snapshotIsCurrent()))
    return refuse(
      "Find results are stale. Capture again before choosing a result.",
    );
  if (result.outcome === "no-match")
    return refuse(
      "The model reported no match in the captured viewport; absence is unverified.",
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
  if (!(await current.snapshotIsCurrent()))
    return refuse("Find results changed during validation.");
  return {
    passed: true,
    detail:
      "Ranked references resolve to the current capture. Relevance is model-proposed, not independently verified. No page controls were activated.",
  };
}
