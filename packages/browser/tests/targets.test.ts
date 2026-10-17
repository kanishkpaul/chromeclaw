import { describe, expect, it } from "vitest";
import { BrowserActionSchema } from "@chromeclaw/shared";

describe("numbered target contract", () => {
  it("rejects every legacy selector, fallback label and coordinate proposal", () => {
    for (const action of [
      { type: "click", selector: "#save" },
      { type: "click", text: "Save" },
      { type: "type", target: "Password", text: "secret" },
      { type: "click", x: 1, y: 1 },
    ]) {
      expect(BrowserActionSchema.safeParse(action).success).toBe(false);
    }
  });
});
