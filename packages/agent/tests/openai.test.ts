import { describe, expect, it } from "vitest";
import { parsePlannerAction } from "../src/llm/openai";

describe("strict planner actions", () => {
  it("accepts only a JSON object or one enclosing JSON fence", () => {
    expect(
      parsePlannerAction(
        '```json\n{"type":"navigate","url":"https://example.com"}\n```',
      ).type,
    ).toBe("navigate");
    for (const content of [
      'prose {"type":"finish","answer":"done"}',
      '{"type":"finish","answer":"done","permission":"all"}',
      '{"action":"navigate","target":"https://example.com"}',
      '{"type":"click","selector":"#save"}',
    ])
      expect(() => parsePlannerAction(content)).toThrow();
  });
});
