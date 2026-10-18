// Const assertions below preserve locally constructed result tags, never external data.
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Discovery } from "@chromeclaw/shared";

const CatalogSchema = z
  .object({
    version: z.literal(1),
    entries: z
      .array(
        z
          .object({
            url: z.string().url().max(2048),
            title: z.string().max(500),
            visitedAt: z.string().datetime(),
            kind: z.enum(["history", "bookmark"]),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict();

/** Explicit portable snapshots only. Never open Chrome's live profile databases. */
export async function selectHistory(
  scope: Extract<Discovery, { mode: "history" }>,
) {
  if (!scope.catalog.endsWith(".json"))
    return {
      kind: "refused" as const,
      reason: "Choose a selected JSON history/bookmark snapshot.",
    };
  if (Date.parse(scope.from) > Date.parse(scope.to))
    return {
      kind: "refused" as const,
      reason: "History time window is reversed.",
    };
  try {
    // Nonblocking open lets the regular-file check refuse a named pipe without hanging.
    const file = await open(
      scope.catalog,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    let text: string;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 1048576)
        return {
          kind: "refused" as const,
          reason: "History snapshots must be regular files of at most 1 MiB.",
        };
      // A bounded handle read also limits a file that grows after stat.
      const buffer = Buffer.alloc(1048577);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const chunk = await file.read(
          buffer,
          bytesRead,
          buffer.length - bytesRead,
          bytesRead,
        );
        if (!chunk.bytesRead) break;
        bytesRead += chunk.bytesRead;
      }
      if (bytesRead > 1048576)
        return {
          kind: "refused" as const,
          reason: "History snapshot exceeded its byte budget.",
        };
      text = buffer.subarray(0, bytesRead).toString("utf8");
    } finally {
      await file.close();
    }
    const parsed = CatalogSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return {
        kind: "refused" as const,
        reason: "Invalid version-one history snapshot.",
      };
    const terms = scope.terms.map((term) => term.toLowerCase());
    const ranked = parsed.data.entries
      .filter(
        (entry) =>
          Date.parse(entry.visitedAt) >= Date.parse(scope.from) &&
          Date.parse(entry.visitedAt) <= Date.parse(scope.to),
      )
      .map((entry) => ({
        entry,
        score: terms.filter((term) =>
          `${entry.title} ${entry.url}`.toLowerCase().includes(term),
        ).length,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Date.parse(b.entry.visitedAt) - Date.parse(a.entry.visitedAt),
      );
    const seen = new Set<string>();
    const candidates = ranked
      .flatMap(({ entry }) => {
        const url = new URL(entry.url);
        url.hash = "";
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.search ||
          url.username ||
          url.password ||
          seen.has(url.href)
        )
          return [];
        seen.add(url.href);
        return [{ url: url.href, title: entry.title }];
      })
      .slice(0, 3);
    return {
      kind: "selected" as const,
      digest: createHash("sha256").update(text).digest("hex"),
      candidates,
    };
  } catch {
    // Parse and filesystem diagnostics may reveal unselected private entries or paths.
    return {
      kind: "refused" as const,
      reason: "History snapshot is unavailable, revoked or invalid.",
    };
  }
}
