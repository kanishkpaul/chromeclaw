import { describe, expect, it } from "vitest";
import { SafetyPolicy } from "../src/index";

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

  it("allows benign navigation", () => {
    const result = policy.assess({ type: "navigate", url: "https://example.com" }, { task: "read example.com" });
    expect(result.decision).toBe("allow");
  });
});
