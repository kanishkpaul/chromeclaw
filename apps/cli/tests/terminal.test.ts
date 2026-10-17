import { describe, expect, it } from "vitest";
import { terminalRows, terminalText, terminalTheme } from "../src/terminal";

describe("terminal trust boundary", () => {
  it("renders terminal controls and directional overrides as visible data", () => {
    const attack = "page\u001b[2J\r\n\u009d52;secret\u0007\u202eapprove";
    const safe = terminalText(attack);
    expect(safe).not.toMatch(/[\p{Cc}\p{Cf}]/u);
    expect(safe).toContain("\\u001b[2J\\u000d\\u000a");
    expect(safe).toContain("\\u202eapprove");
  });

  it("keeps every wrapped data line prefixed, including wide and combining text", () => {
    const rows = terminalRows("  source ", "界".repeat(20) + "e\u0301", 20);
    expect(rows.every((row) => row.startsWith("  source "))).toBe(true);
    expect(rows.join("")).toContain("e\u0301");
    expect(rows.length).toBeGreaterThan(3);
  });

  it("honors explicit polarity and NO_COLOR without maintaining a second palette", () => {
    const dark = terminalTheme({ COLORTERM: "truecolor" }, { theme: "dark" });
    const light = terminalTheme({ COLORTERM: "truecolor" }, { theme: "light" });
    expect(dark.paint("ui_accent", "label")).not.toEqual(
      light.paint("ui_accent", "label"),
    );
    expect(terminalTheme({ NO_COLOR: "1" }).paint("ui_accent", "label")).toBe(
      "label",
    );
    expect(terminalTheme({ TERM: "dumb" }).paint("ui_accent", "label")).toBe(
      "label",
    );
  });
});
