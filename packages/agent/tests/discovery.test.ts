import { describe, it, expect } from "vitest";
import { discoveryQueries, verifyDiscovery } from "../src/discovery";
import type {
  BrowserAction,
  BrowserObservation,
  Discovery,
} from "@chromeclaw/shared";
const scope: Discovery = {
  mode: "research",
  engineUrl: "https://example.com/search",
  queries: ["user intent"],
  maxSources: 5,
};
const observation: BrowserObservation = {
  snapshotId: "s1",
  documentId: "d1",
  url: "https://source.example/",
  title: "Source",
  visibleText: "",
  interactiveElements: [],
  accessibilityTreeSummary: "",
  timestamp: "",
  passages: [
    {
      id: "p1",
      snapshotId: "s1",
      url: "https://source.example/",
      text: "The fixture count is 17.",
      kind: "document",
    },
  ],
};
const observations = new Map([["s1", observation]]);
const reference = {
  snapshotId: "s1",
  passageId: "p1",
  quote: "The fixture count is 17.",
};
describe("research reference and support boundary", () => {
  it("accepts exact extracts but refuses fabricated references and uncited answer claims", () => {
    const action: Extract<BrowserAction, { type: "finish" }> = {
      type: "finish",
      answer: reference.quote,
      claims: [
        { text: reference.quote, kind: "extract", evidence: [reference] },
      ],
    };
    expect(verifyDiscovery(action, scope, observations).passed).toBe(true);
    expect(
      verifyDiscovery(
        {
          ...action,
          answer: "17",
          claims: [
            {
              text: "17",
              kind: "extract",
              evidence: [{ ...reference, quote: "17" }],
            },
          ],
        },
        scope,
        observations,
      ).passed,
    ).toBe(false);
    expect(
      verifyDiscovery(
        { ...action, answer: "Therefore all products are safe." },
        scope,
        observations,
      ).passed,
    ).toBe(false);
    expect(
      verifyDiscovery(
        {
          ...action,
          claims: [
            {
              text: reference.quote,
              kind: "extract",
              evidence: [{ ...reference, passageId: "invented" }],
            },
          ],
        },
        scope,
        observations,
      ).passed,
    ).toBe(false);
  });
  it("never calls overlap or conflicting evidence entailed", () => {
    const result = verifyDiscovery(
      {
        type: "finish",
        answer: "The count is always 17.",
        claims: [
          {
            text: "The count is always 17.",
            kind: "qualified",
            qualification: "Source scope is unclear.",
            evidence: [reference],
          },
        ],
      },
      scope,
      observations,
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("human review");
  });
  it("requires each ranked URL to resolve on its own captured page", () => {
    expect(
      verifyDiscovery(
        {
          type: "finish",
          answer: "Match",
          webFind: {
            outcome: "matches",
            matches: [
              {
                url: "https://other.example/",
                reason: "A confident guess",
                evidence: [reference],
              },
            ],
          },
        },
        { ...scope, mode: "web" },
        observations,
      ).passed,
    ).toBe(false);
  });
  it("does not count one cited URL multiple times in a ranked result", () => {
    const match = {
      url: observation.url,
      reason: "Captured source",
      evidence: [reference],
    };
    const action: Extract<BrowserAction, { type: "finish" }> = {
      type: "finish",
      answer: "Source",
      webFind: { outcome: "matches", matches: [match] },
    };
    expect(
      verifyDiscovery(action, { ...scope, mode: "web" }, observations).passed,
    ).toBe(true);
    expect(
      verifyDiscovery(
        { ...action, webFind: { outcome: "matches", matches: [match, match] } },
        { ...scope, mode: "web" },
        observations,
      ).passed,
    ).toBe(false);
  });
  it("builds only exact trusted queries and refuses a parameter-bearing engine", () => {
    expect(discoveryQueries(scope)).toEqual([
      "https://example.com/search?q=user+intent",
    ]);
    expect(() =>
      discoveryQueries({
        ...scope,
        engineUrl: "https://example.com/?private=source",
      }),
    ).toThrow();
  });
});
