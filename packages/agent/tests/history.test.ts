import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { selectHistory } from "../src/history";
import type { Discovery } from "@chromeclaw/shared";

describe("selected history snapshot boundary", () => {
  it("filters timestamps numerically, deduplicates URLs, and refuses revocation and symlinks", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "chromeclaw-history-"));
    const catalog = path.join(dir, "selected.json");
    const scope: Extract<Discovery, { mode: "history" }> = {
      mode: "history",
      catalog,
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.999Z",
      terms: ["atlas"],
    };
    try {
      await writeFile(
        catalog,
        JSON.stringify({
          version: 1,
          entries: [
            {
              url: "https://example.com/atlas#one",
              title: "Atlas",
              visitedAt: "2026-10-01T00:00:00Z",
              kind: "history",
            },
            {
              url: "https://example.com/atlas#two",
              title: "Atlas",
              visitedAt: "2026-10-01T00:00:00Z",
              kind: "bookmark",
            },
            {
              url: "https://example.com/latest",
              title: "Atlas latest",
              visitedAt: "2026-10-01T00:00:00.999Z",
              kind: "history",
            },
            {
              url: "https://example.com/private",
              title: "Private atlas",
              visitedAt: "2020-01-01T00:00:00Z",
              kind: "history",
            },
          ],
        }),
      );
      const selected = await selectHistory(scope);
      expect(selected.kind).toBe("selected");
      if (selected.kind === "selected")
        expect(selected.candidates).toEqual([
          { url: "https://example.com/latest", title: "Atlas latest" },
          { url: "https://example.com/atlas", title: "Atlas" },
        ]);
      const link = path.join(dir, "link.json");
      await symlink(catalog, link);
      expect((await selectHistory({ ...scope, catalog: link })).kind).toBe(
        "refused",
      );
      await rm(catalog);
      expect((await selectHistory(scope)).kind).toBe("refused");
      expect(
        (await selectHistory({ ...scope, catalog: path.join(dir, "History") }))
          .kind,
      ).toBe("refused");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
