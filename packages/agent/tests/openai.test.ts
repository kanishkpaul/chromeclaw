import { describe, expect, it } from "vitest";
import { normalizeModelActionPayload } from "../src/llm/openai";
import { BrowserActionSchema } from "@chromeclaw/shared";

describe("normalizeModelActionPayload", () => {
  it("converts legacy navigate output into the current schema", () => {
    const payload = normalizeModelActionPayload({
      action: "navigate",
      url: "https://example.com",
    });

    expect(BrowserActionSchema.parse(payload)).toEqual({
      type: "navigate",
      url: "https://example.com",
    });
  });

  it("rejects legacy selector clicks instead of restoring fallback targeting", () => {
    const payload = normalizeModelActionPayload({
      action: "click",
      target: "button[name=submit]",
    });

    expect(BrowserActionSchema.safeParse(payload).success).toBe(false);
  });
});
