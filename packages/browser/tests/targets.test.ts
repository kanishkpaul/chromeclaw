import { describe, expect, it } from "vitest";
import { describeTarget } from "../src/index";

describe("target helpers", () => {
  it("describes fallback targets usefully", () => {
    expect(describeTarget({ text: "Search" })).toContain("visible text");
    expect(describeTarget({ role: "button", name: "Submit" })).toContain("button");
  });
});
