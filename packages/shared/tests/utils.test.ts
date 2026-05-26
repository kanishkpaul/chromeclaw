import { describe, expect, it } from "vitest";
import { rankInteractiveElements, truncateEnd } from "../src/index";

describe("observation utilities", () => {
  it("truncates long text", () => {
    const text = "a".repeat(1000);
    expect(truncateEnd(text, 100)).toContain("[truncated]");
    expect(truncateEnd(text, 100).length).toBeLessThan(130);
  });

  it("ranks visible named targets first", () => {
    const ranked = rankInteractiveElements([
      { id: "a", isVisible: false, score: 0, text: "hidden" },
      { id: "b", isVisible: true, score: 0, role: "button", name: "Submit" }
    ]);
    expect(ranked[0]?.id).toBe("b");
  });
});
