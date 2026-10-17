import { describe, expect, it } from "vitest";
import {
  createPermissions,
  destinationRefusal,
  type BrowserAction,
  type BrowserObservation,
} from "@chromeclaw/shared";
import { SafetyPolicy } from "../src/index";

const permissions = createPermissions(
  {
    origins: ["https://example.com", "https://other.example"],
    write: true,
    irreversible: "confirm",
  },
  0,
);
const observation: BrowserObservation = {
  snapshotId: "snapshot",
  documentId: "document",
  url: "https://example.com",
  title: "PostgreSQL research",
  visibleText: "payment analysis",
  accessibilityTreeSummary: "",
  timestamp: "2026-10-17T00:00:00Z",
  interactiveElements: [
    {
      id: "1",
      number: 1,
      role: "button",
      name: "Transfer",
      isVisible: true,
      isCredential: false,
      score: 0,
    },
  ],
};
const policy = new SafetyPolicy();
const assess = (action: BrowserAction, overrides = {}) =>
  policy.assess(action, {
    task: "Read PostgreSQL documentation",
    observation,
    permissions,
    now: 1,
    step: 0,
    spent: 0,
    ...overrides,
  });

describe("fixed task permissions", () => {
  it("copies and freezes powers before page reads", () => {
    const origins = ["https://example.com"];
    const fixed = createPermissions({ origins }, 0);
    origins.push("https://other.example");
    expect(fixed.origins).toEqual(["https://example.com"]);
    expect(Object.isFrozen(fixed)).toBe(true);
    expect(Object.isFrozen(fixed.origins)).toBe(true);
    expect(Object.isFrozen(fixed.tools)).toBe(true);
  });

  it("rejects private, browser, credential-bearing and noncanonical destinations", () => {
    for (const url of [
      "chrome://settings",
      "file:///tmp/secret",
      "http://2130706433",
      "http://0x7f000001",
      "http://192.168.1.1",
      "http://[::ffff:7f00:1]",
      "https://x:secret@example.com",
      "http://localhost.evil.example",
      "https://unapproved.example",
    ]) {
      expect(destinationRefusal(url, permissions), url).toBeTruthy();
    }
  });

  it("allows harmless PostgreSQL reading regardless of page keywords", () => {
    expect(assess({ type: "extract_text" }).decision).toBe("allow");
    expect(
      assess({ type: "navigate", url: "https://example.com/postgresql" })
        .decision,
    ).toBe("allow");
  });

  it("requires exact approval for known and unknown activations", () => {
    for (const name of ["Transfer", "Pay", "Post", "Delete", "Continue", ""]) {
      const page = {
        ...observation,
        interactiveElements: observation.interactiveElements.map((node) => ({
          ...node,
          name,
        })),
      };
      expect(
        assess(
          { type: "click", target: 1, snapshotId: "snapshot" },
          { observation: page },
        ).decision,
      ).toBe("confirm");
      expect(
        assess(
          { type: "press", target: 1, snapshotId: "snapshot", key: "Enter" },
          { observation: page },
        ).decision,
      ).toBe("confirm");
    }
  });

  it("refuses missing tools, writes, expired time, steps and unenforced spend", () => {
    const click: BrowserAction = {
      type: "click",
      target: 1,
      snapshotId: "snapshot",
    };
    expect(
      assess(click, { permissions: { ...permissions, write: false } }).decision,
    ).toBe("block");
    expect(
      assess(click, { permissions: { ...permissions, tools: [] } }).decision,
    ).toBe("block");
    expect(assess(click, { now: permissions.expiresAt }).decision).toBe(
      "block",
    );
    expect(assess(click, { step: permissions.maxSteps }).decision).toBe(
      "block",
    );
    expect(assess(click, { spent: 1 }).decision).toBe("block");
    expect(() => createPermissions({ maxCost: 1 }, 0)).toThrow();
  });

  it("never lets approval widen origins or move cross-origin data through URLs", () => {
    expect(
      assess({ type: "navigate", url: "https://other.example/?secret=hidden" })
        .decision,
    ).toBe("block");
    expect(
      assess({ type: "navigate", url: "https://example.com/?city=Kolkata" })
        .decision,
    ).toBe("confirm");
    const page = {
      ...observation,
      interactiveElements: observation.interactiveElements.map((node) => ({
        ...node,
        formDestination: "https://other.example/save",
      })),
    };
    expect(
      assess(
        { type: "click", target: 1, snapshotId: "snapshot" },
        { observation: page },
      ).decision,
    ).toBe("block");
  });

  it("refuses credentials and access-barrier bypass without task-keyword false positives", () => {
    const page = {
      ...observation,
      interactiveElements: observation.interactiveElements.map((node) => ({
        ...node,
        isCredential: true,
      })),
    };
    expect(
      assess(
        { type: "type", target: 1, snapshotId: "snapshot", text: "synthetic" },
        { observation: page },
      ).decision,
    ).toBe("block");
    expect(
      assess({ type: "extract_text" }, { task: "Bypass the paywall" }).decision,
    ).toBe("block");
    expect(
      assess(
        { type: "extract_text" },
        { task: "Explain CAPTCHA and PostgreSQL" },
      ).decision,
    ).toBe("allow");
  });
});
