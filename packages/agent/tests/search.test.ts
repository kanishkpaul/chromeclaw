import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { searchBackends } from "../src/search";

describe("independent search backends", () => {
  it("keeps registration unique and plugins free of peer imports", () => {
    expect(new Set(searchBackends.map((backend) => backend.id)).size).toBe(
      searchBackends.length,
    );
    for (const folder of readdirSync(
      new URL("../src/search/", import.meta.url),
      { withFileTypes: true },
    ).filter((entry) => entry.isDirectory()))
      expect(
        readFileSync(
          new URL(`../src/search/${folder.name}/index.ts`, import.meta.url),
          "utf8",
        ),
      ).not.toMatch(/from ["']\.\.\/(?!contract["'])/);
  });
  it("unwraps only genuine engine result hosts and leaves snippets as candidates", async () => {
    for (const backend of searchBackends) {
      const result = await backend.search({
        url: "https://html.duckduckgo.com/",
        signal: new AbortController().signal,
        read: async () => ({
          kind: "read",
          url: "https://html.duckduckgo.com/",
          passages: [],
          incomplete: false,
          links: [
            {
              url: "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage",
              title: "Candidate",
            },
            {
              url: "https://evilduckduckgo.com/l/?uddg=https%3A%2F%2Fattacker.com%2F",
              title: "Spoof",
            },
            { url: "https://example.com/page#duplicate", title: "Duplicate" },
          ],
        }),
      });
      expect(result.kind).toBe("results");
      if (result.kind === "results")
        expect(result.candidates).toEqual([
          { url: "https://example.com/page", title: "Candidate" },
        ]);
    }
  });
});
