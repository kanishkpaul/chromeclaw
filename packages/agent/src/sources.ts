import { setTimeout as delay } from "node:timers/promises";
import { guardNavigation, navigate, openBrowser } from "@chromeclaw/browser";
import {
  ObservationRecordSchema,
  destinationRefusal,
} from "@chromeclaw/shared";
import { JsonlRunStore } from "./storage/jsonl";

/** Explicit source display opens only a cited captured URL in a separate owned, guarded window. */
// Const tags preserve the returned success/refusal union; they assert no external input type.
export async function openCapturedSource(
  runId: string,
  passageId: string,
  options: {
    logDir?: string | undefined;
    headless?: boolean | undefined;
    profileDir?: string | undefined;
  } = {},
) {
  const store = new JsonlRunStore(options.logDir);
  const saved = await store.readDetailed(runId);
  if (saved.kind !== "ok" || !saved.run.permissions)
    return {
      ok: false as const,
      reason: "No readable source permission record.",
    };
  const permissions = saved.run.permissions;
  const passages = saved.events
    .filter((event) => event.type === "observation")
    .flatMap(
      (event) => ObservationRecordSchema.parse(event.payload).passages ?? [],
    );
  const passage = passages.find((passage) => passage.id === passageId);
  const cited = saved.run.steps.some((step) => {
    if (step.action?.type !== "finish") return false;
    const action = step.action;
    const references = [
      ...(action.evidence ?? []),
      ...(action.claims ?? []).flatMap((claim) => claim.evidence),
      ...(action.webFind?.outcome === "matches"
        ? action.webFind.matches.flatMap((match) => match.evidence)
        : []),
    ];
    return references.some(
      (reference) =>
        reference.passageId === passageId &&
        reference.snapshotId === passage?.snapshotId &&
        passage.text.includes(reference.quote),
    );
  });
  if (!passage || !cited)
    return { ok: false as const, reason: "Choose a cited captured passage." };
  let url: URL;
  try {
    url = new URL(passage.url);
  } catch {
    return { ok: false as const, reason: "Invalid source URL." };
  }
  if (
    !permissions.read ||
    Date.now() >= permissions.expiresAt ||
    destinationRefusal(url.href, permissions) ||
    url.search ||
    url.hash
  )
    return {
      ok: false as const,
      reason:
        "Source opening is outside the original read/origin/time permissions.",
    };
  const session = await openBrowser({
    headless: options.headless,
    profileDir: options.profileDir ?? ".chromeclaw/source-profile",
  });
  const close = async () => {
    const controller = new AbortController();
    try {
      await Promise.race([
        session.close(),
        delay(5000, undefined, { signal: controller.signal }).then(() => {
          throw new Error("Source window cleanup timed out.");
        }),
      ]);
    } finally {
      controller.abort();
    }
  };
  try {
    const guard = await guardNavigation(session, {
      ...permissions,
      write: false,
      irreversible: "deny",
    });
    await navigate(session.page, url.href);
    if (guard.refusal({ documentOnly: true }))
      throw new Error("Source navigation was refused.");
    await store.append({
      version: 1,
      type: "source_opened",
      runId,
      timestamp: new Date().toISOString(),
      payload: { passageId, snapshotId: passage.snapshotId, url: url.href },
    });
    return {
      ok: true as const,
      url: url.href,
      close,
    };
  } catch {
    try {
      await close();
    } catch {
      // Navigation already failed; cleanup failure must not hide that refusal.
    }
    return {
      ok: false as const,
      reason: "Source navigation failed or was refused.",
    };
  }
}
