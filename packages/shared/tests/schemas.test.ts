import { describe, expect, it } from "vitest";
import { BrowserActionSchema } from "../src/index";

describe("BrowserActionSchema", () => {
  it("parses a valid navigate action", () => {
    expect(BrowserActionSchema.parse({ type: "navigate", url: "https://example.com" }).type).toBe("navigate");
  });

  it("rejects click actions without a target", () => {
    expect(() => BrowserActionSchema.parse({ type: "click" })).toThrow();
  });

  it("keeps model outputs strict", () => {
    expect(() => BrowserActionSchema.parse({ type: "finish", answer: "done", extra: true })).toThrow();
  });
});
