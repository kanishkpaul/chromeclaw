import { describe, expect, it } from "vitest";
import {
  askNavigationRefusal,
  askPermissions,
  verifyAsk,
} from "../src/abilities/ask";
import type { BrowserObservation, PermissionRequest } from "@chromeclaw/shared";

describe("read-only ask contract", () => {
  it("narrows explicit writes and tools without granting missing reads or origins", () => {
    const request: PermissionRequest = {
      read: false,
      write: true,
      origins: ["https://example.com"],
      tools: ["type", "finish"],
    };
    expect(askPermissions(request)).toMatchObject({
      read: false,
      write: false,
      irreversible: "deny",
      tools: ["finish"],
      origins: request.origins,
    });
  });
  it("keeps navigation on the selected page even when another origin is permitted", () => {
    expect(
      askNavigationRefusal(
        { type: "navigate", url: "https://example.com/" },
        "https://example.com",
      ),
    ).toBeUndefined();
    expect(
      askNavigationRefusal(
        { type: "navigate", url: "https://example.com/other" },
        "https://example.com",
      ),
    ).toBeTruthy();
    expect(
      askNavigationRefusal(
        { type: "navigate", url: "javascript:alert(1)" },
        "https://example.com",
      ),
    ).toBeTruthy();
  });
  it("rejects invented or stale passage IDs even when the quote appears on the page", () => {
    const page: BrowserObservation = {
      snapshotId: "s",
      documentId: "d",
      url: "https://example.com",
      title: "Fact",
      visibleText: "The code is CEDAR.",
      interactiveElements: [],
      accessibilityTreeSummary: "",
      timestamp: "now",
      passages: [
        {
          id: "s:p1",
          snapshotId: "s",
          text: "The code is CEDAR.",
          url: "https://example.com",
          kind: "document",
        },
      ],
    };
    const sources = new Map([["s", page]]);
    for (const reference of [
      { snapshotId: "s", passageId: "invented", quote: page.visibleText },
      { snapshotId: "old", passageId: "s:p1", quote: page.visibleText },
      { snapshotId: "s", passageId: "s:p1", quote: "Not captured" },
    ])
      expect(
        verifyAsk(
          { type: "finish", answer: reference.quote, evidence: [reference] },
          sources,
        ).passed,
      ).toBe(false);
    expect(
      verifyAsk(
        {
          type: "finish",
          answer: page.visibleText,
          evidence: [
            { snapshotId: "s", passageId: "s:p1", quote: page.visibleText },
          ],
        },
        sources,
      ).passed,
    ).toBe(true);
  });
});
