import { describe, expect, it } from "vitest";
import {
  BrowserActionSchema,
  type BrowserAction,
  type BrowserObservation,
} from "@chromeclaw/shared";
import { verifyPageFind } from "../src/abilities/find";

const observation: BrowserObservation = {
  snapshotId: "s",
  documentId: "d",
  url: "https://example.com",
  title: "Page",
  visibleText: "Delivery takes two days.",
  accessibilityTreeSummary: "",
  timestamp: "now",
  interactiveElements: [
    {
      id: "1",
      number: 1,
      name: "Delivery",
      isVisible: true,
      isCredential: false,
      score: 0,
    },
    {
      id: "2",
      number: 2,
      name: "Password",
      isVisible: true,
      isCredential: true,
      score: 0,
    },
  ],
  passages: [
    {
      id: "s:p1",
      snapshotId: "s",
      url: "https://example.com",
      text: "Delivery takes two days.",
      kind: "document",
    },
  ],
};
const current = {
  passagesAreCurrent: async () => true,
  targetIsCurrent: async () => true,
};
type Finish = Extract<BrowserAction, { type: "finish" }>;
const finish = (
  matches: Extract<
    NonNullable<Finish["pageFind"]>,
    { outcome: "matches" }
  >["matches"],
): Finish => ({
  type: "finish",
  answer: "Candidates",
  pageFind: { outcome: "matches", confidence: 1, matches },
});
const target = { snapshotId: "s", target: 1, reason: "Delivery options" };
describe("find on the current page", () => {
  it("accepts mixed ranked references without claiming semantic verification", async () => {
    const result = await verifyPageFind(
      finish([
        target,
        { snapshotId: "s", passageId: "s:p1", reason: "Delivery timing" },
      ]),
      observation,
      current,
    );
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("not independently verified");
  });
  it("refuses invented, credential and duplicate references", async () => {
    for (const matches of [
      [{ ...target, target: 99 }],
      [{ ...target, target: 2 }],
      [target, target],
      [{ ...target, snapshotId: "old" }],
      [{ snapshotId: "s", passageId: "invented", reason: "No evidence" }],
    ])
      expect(
        (await verifyPageFind(finish(matches), observation, current)).passed,
      ).toBe(false);
  });
  it("checks target freshness and changes during validation", async () => {
    expect(
      (
        await verifyPageFind(finish([target]), observation, {
          ...current,
          targetIsCurrent: async () => false,
        })
      ).passed,
    ).toBe(false);
    let checks = 0;
    expect(
      (
        await verifyPageFind(finish([target]), observation, {
          ...current,
          passagesAreCurrent: async () => ++checks === 1,
        })
      ).passed,
    ).toBe(false);
  });
  it("rechecks only the cited passages and every cited target", async () => {
    const rechecked: string[][] = [];
    const targets: number[] = [];
    const result = await verifyPageFind(
      finish([
        target,
        { snapshotId: "s", passageId: "s:p1", reason: "Delivery timing" },
      ]),
      observation,
      {
        passagesAreCurrent: async (ids) => {
          rechecked.push(ids);
          return true;
        },
        targetIsCurrent: async (number) => {
          targets.push(number);
          return true;
        },
      },
    );
    expect(result.passed).toBe(true);
    expect(rechecked).toEqual([["s:p1"], ["s:p1"]]);
    expect(targets).toEqual([1, 1]);
  });
  it("leaves no-match uncertain and rejects unstructured completion", async () => {
    expect(
      (
        await verifyPageFind(
          {
            type: "finish",
            answer: "Absent",
            pageFind: { outcome: "no-match", reason: "Not captured" },
          },
          observation,
          current,
        )
      ).passed,
    ).toBe(false);
    expect(
      (
        await verifyPageFind(
          { type: "finish", answer: "Done" },
          observation,
          current,
        )
      ).passed,
    ).toBe(false);
  });
  it("hands back below the frozen confidence threshold without exposing a ranked result", async () => {
    const action = finish([target]);
    if (action.pageFind?.outcome !== "matches")
      throw new Error("Invalid fixture");
    action.pageFind.confidence = 0.95;
    expect((await verifyPageFind(action, observation, current)).passed).toBe(
      false,
    );
    delete action.pageFind.confidence;
    expect((await verifyPageFind(action, observation, current)).passed).toBe(
      false,
    );
  });
  it("requires a trusted ordinal for indistinguishable control labels", async () => {
    const first = observation.interactiveElements[0];
    if (!first) throw new Error("Missing fixture control");
    const repeated = {
      ...observation,
      interactiveElements: [first, { ...first, id: "2", number: 2 }],
    };
    expect(
      (await verifyPageFind(finish([target]), repeated, current)).passed,
    ).toBe(false);
    expect(
      (
        await verifyPageFind(finish([target]), repeated, {
          ...current,
          description: "Find the second control",
        })
      ).passed,
    ).toBe(false);
    expect(
      (
        await verifyPageFind(finish([{ ...target, target: 2 }]), repeated, {
          ...current,
          description: "Find the second control",
        })
      ).passed,
    ).toBe(true);
  });
  it("rejects empty lists, four results, permission fields and ambiguous references at the wire boundary", () => {
    for (const matches of [
      [],
      [target, target, target, target],
      [{ ...target, approved: true }],
      [{ ...target, passageId: "s:p1" }],
    ])
      expect(BrowserActionSchema.safeParse(finish(matches)).success).toBe(
        false,
      );
  });
});
