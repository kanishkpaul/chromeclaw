import { z } from "zod";

/** Trusted configuration is parsed before any source or catalog is opened. */
export const DiscoverySchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.enum(["research", "web"]),
      engineUrl: z.string().url(),
      queries: z.array(z.string().trim().min(1).max(500)).min(1).max(3),
      maxSources: z.number().int().min(1).max(15).default(10),
    })
    .strict(),
  z
    .object({
      mode: z.literal("history"),
      catalog: z.string().min(1).max(4096),
      from: z.string().datetime(),
      to: z.string().datetime(),
      terms: z.array(z.string().trim().min(1).max(100)).min(1).max(8),
    })
    .strict(),
]);
export type Discovery = z.infer<typeof DiscoverySchema>;

export const CitationSchema = z
  .object({
    snapshotId: z.string().min(1),
    passageId: z.string().min(1),
    quote: z.string().min(1).max(2000),
  })
  .strict();
export const ResearchClaimSchema = z
  .object({
    text: z.string().min(1).max(2000),
    kind: z.enum(["extract", "qualified", "conflict"]),
    qualification: z.string().min(1).max(500).optional(),
    evidence: z.array(CitationSchema).min(1).max(4),
  })
  .strict();
export const WebFindSchema = z.union([
  z
    .object({
      outcome: z.literal("matches"),
      matches: z
        .array(
          z
            .object({
              url: z.string().url(),
              reason: z.string().min(1).max(500),
              evidence: z.array(CitationSchema).min(1).max(3),
            })
            .strict(),
        )
        .min(1)
        .max(3),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("no-match"),
      reason: z.string().min(1).max(500),
    })
    .strict(),
]);
