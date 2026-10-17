import { describe, expect, it } from "vitest";
import { SafetyPolicy } from "../src/index";
import type { BrowserObservation } from "@chromeclaw/shared";

describe("SafetyPolicy", () => {
  const policy = new SafetyPolicy();

  it("blocks sensitive browser navigation", () => {
    const result = policy.assess({ type: "navigate", url: "chrome://settings" }, { task: "open settings" });
    expect(result.decision).toBe("block");
  });

  it("requires confirmation for credential entry", () => {
    const result = policy.assess(
      { type: "type", target: "password", text: "secret" },
      { task: "log in to my bank account" }
    );
    expect(result.decision).toBe("confirm");
  });

  it("refuses a credential-marked field even when the task and selector sound benign", () => {
    const observation: BrowserObservation = {
      url: "https://example.com", title: "Form", visibleText: "Field", accessibilityTreeSummary: "withheld",
      timestamp: "2026-10-17T00:00:00.000Z",
      interactiveElements: [{ id: "target-0", selector: "#f", name: "Field", isVisible: true, isCredential: true, score: 0 }]
    };
    expect(policy.assess({ type: "type", selector: "#f", text: "synthetic" }, {
      task: "Fill the field", observation
    }).decision).toBe("block");
  });

  it("allows benign navigation", () => {
    const result = policy.assess({ type: "navigate", url: "https://example.com" }, { task: "read example.com" });
    expect(result.decision).toBe("allow");
  });
});
