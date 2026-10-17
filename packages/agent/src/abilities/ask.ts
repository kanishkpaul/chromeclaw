import type { BrowserAction, BrowserObservation } from "@chromeclaw/shared";

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
