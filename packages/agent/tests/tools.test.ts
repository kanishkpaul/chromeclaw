import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { browserTools } from "../src/tools";
import { SafetyPolicy } from "../src/safety";
import {
  BrowserActionSchema,
  createPermissions,
  type BrowserObservation,
} from "@chromeclaw/shared";

const page: BrowserObservation = {
  snapshotId: "s",
  documentId: "d",
  url: "https://example.com/page",
  title: "Page",
  visibleText: "",
  accessibilityTreeSummary: "",
  timestamp: "now",
  backUrl: "https://example.com/previous",
  tabs: [
    { id: "1", active: true, url: "https://example.com/page" },
    { id: "2", active: false, url: "https://example.com/second" },
  ],
  interactiveElements: [
    {
      id: "1",
      number: 1,
      role: "combobox",
      name: "Delivery",
      options: ["Express", "Standard"],
      isVisible: true,
      isCredential: false,
      score: 0,
    },
  ],
};
const policy = new SafetyPolicy();
const permissions = createPermissions(
  { origins: ["https://example.com"], write: true, irreversible: "confirm" },
  0,
);
const context = {
  observation: page,
  permissions,
  now: 1,
  step: 0,
  spent: 0,
  task: "Edit the bounded page",
};
describe("page-work tool contracts", () => {
  it("registers each action once and declares its input path", () => {
    const actions = browserTools.flatMap((tool) => tool.actions);
    expect(new Set(actions).size).toBe(actions.length);
    expect(actions.length).toBeGreaterThan(0);
    for (const tool of browserTools) {
      expect(["trusted", "native-dom-fallback", "none"]).toContain(tool.input);
      if (tool.actions.includes("click") || tool.actions.includes("press"))
        expect(tool.input).toBe("trusted");
      if (tool.actions.includes("select") || tool.actions.includes("type"))
        expect(tool.input).toBe("native-dom-fallback");
    }
    for (const folder of readdirSync(
      new URL("../src/tools/", import.meta.url),
      { withFileTypes: true },
    ).filter((entry) => entry.isDirectory()))
      expect(
        readFileSync(
          new URL(`../src/tools/${folder.name}/index.ts`, import.meta.url),
          "utf8",
        ),
      ).not.toMatch(/from ["']\.\.\/(?!contract["'])/);
  });
  it("requires offered option labels and refuses credential and read-only selection", () => {
    const action = BrowserActionSchema.parse({
      type: "select",
      snapshotId: "s",
      target: 1,
      option: "Express",
    });
    if (action.type !== "select") throw new Error("Invalid select fixture");
    expect(policy.assess(action, context).decision).toBe("allow");
    expect(
      policy.assess({ ...action, option: "invented" }, context).decision,
    ).toBe("block");
    expect(
      policy.assess(action, {
        ...context,
        permissions: { ...permissions, write: false },
      }).decision,
    ).toBe("block");
    expect(
      policy.assess(action, {
        ...context,
        observation: {
          ...page,
          interactiveElements: page.interactiveElements.map((node) => ({
            ...node,
            isCredential: true,
          })),
        },
      }).decision,
    ).toBe("block");
  });
  it("binds history and owned tabs to the offered snapshot without widening origins", () => {
    expect(
      policy.assess(
        { type: "back", snapshotId: "s", url: page.backUrl ?? "" },
        context,
      ).decision,
    ).toBe("allow");
    expect(
      policy.assess(
        { type: "back", snapshotId: "s", url: "https://example.com/invented" },
        context,
      ).decision,
    ).toBe("block");
    expect(
      policy.assess(
        { type: "open_tab", snapshotId: "old", url: "https://example.com" },
        context,
      ).decision,
    ).toBe("block");
    expect(
      policy.assess(
        { type: "open_tab", snapshotId: "s", url: "https://foreign.example" },
        context,
      ).decision,
    ).toBe("block");
    expect(
      policy.assess(
        { type: "switch_tab", snapshotId: "s", tabId: "invented" },
        context,
      ).decision,
    ).toBe("block");
    expect(
      policy.assess({ type: "close_tab", snapshotId: "s", tabId: "2" }, context)
        .decision,
    ).toBe("confirm");
  });
});
