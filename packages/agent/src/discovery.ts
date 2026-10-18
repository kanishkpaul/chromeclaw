// Const result tags below describe local refusals; catalogs are parsed at their file boundary.
import type {
  BrowserAction,
  BrowserObservation,
  Discovery,
  Passage,
} from "@chromeclaw/shared";
import type { SourceRead } from "@chromeclaw/browser";
import type { SearchBackend } from "./search/contract";
import { selectHistory } from "./history";

export function discoveryQueries(scope: Discovery): string[] {
  if (scope.mode === "history") return [];
  const engine = new URL(scope.engineUrl);
  if (
    engine.search ||
    engine.hash ||
    engine.username ||
    engine.password ||
    !["http:", "https:"].includes(engine.protocol)
  )
    throw new Error("Search engine must be a plain HTTP(S) endpoint.");
  return scope.queries.map((query) => {
    const url = new URL(engine);
    url.searchParams.set("q", query);
    return url.href;
  });
}

/** Search and readers are injected capabilities, never another ability's implementation. */
export async function collectDiscovery(
  scope: Discovery,
  dependencies: {
    search: SearchBackend | undefined;
    read: (url: string, signal: AbortSignal) => Promise<SourceRead>;
    signal: AbortSignal;
    record: (entry: {
      stage: string;
      detail: string;
      url?: string;
      passages?: Passage[];
    }) => Promise<void>;
  },
) {
  const sources: Extract<SourceRead, { kind: "read" }>[] = [];
  const candidates: { url: string; title: string }[] = [];
  let historyDigest: string | undefined;
  if (scope.mode === "history") {
    const selected = await selectHistory(scope);
    if (selected.kind === "refused")
      return { sources, reason: selected.reason };
    historyDigest = selected.digest;
    candidates.push(...selected.candidates);
    await dependencies.record({
      stage: "history-scope",
      detail: JSON.stringify({
        from: scope.from,
        to: scope.to,
        terms: scope.terms,
        candidates: selected.candidates.length,
        modelDisclosure: "none",
      }),
    });
  } else {
    if (!dependencies.search)
      return { sources, reason: "No enabled search backend." };
    for (const url of discoveryQueries(scope)) {
      dependencies.signal.throwIfAborted();
      await dependencies.record({
        stage: "search",
        detail: "Trusted query fixed before source reads.",
        url,
      });
      const found = await dependencies.search.search({
        url,
        read: dependencies.read,
        signal: dependencies.signal,
      });
      if (found.kind === "refused") {
        await dependencies.record({
          stage: "source-failure",
          detail: found.reason,
          url,
        });
        // An access barrier is a hand-back, never a request to try another engine.
        if (/barrier/.test(found.reason))
          return { sources, reason: found.reason };
      } else candidates.push(...found.candidates);
    }
  }
  const urls = [...new Set(candidates.map((candidate) => candidate.url))].slice(
    0,
    scope.mode === "history" ? 3 : scope.maxSources,
  );
  for (let index = 0; index < urls.length; index += 5) {
    dependencies.signal.throwIfAborted();
    const batch = await Promise.all(
      urls.slice(index, index + 5).map(async (url) => {
        if (scope.mode === "history") {
          const current = await selectHistory(scope);
          if (current.kind === "refused" || current.digest !== historyDigest)
            return {
              kind: "refused" as const,
              url,
              reason: "History access changed or was revoked.",
            };
        }
        await dependencies.record({
          stage: "read",
          detail: `Read source ${new URL(url).host}; ${index}/${urls.length} completed.`,
          url,
        });
        return dependencies.read(url, dependencies.signal);
      }),
    );
    for (const source of batch) {
      if (source.kind === "read") {
        sources.push(source);
        await dependencies.record({
          stage: "source",
          detail: source.incomplete
            ? "Partial visible passages; omitted/unreadable regions."
            : "Captured visible passages.",
          url: source.url,
          passages: source.passages,
        });
      } else
        await dependencies.record({
          stage: "source-failure",
          detail: source.reason,
          url: source.url,
        });
    }
  }
  return {
    sources,
    reason: sources.length
      ? undefined
      : "No readable permitted sources matched the selected scope.",
  };
}

export function discoveryObservation(
  source: Extract<SourceRead, { kind: "read" }>,
): BrowserObservation {
  const id = source.passages[0]?.snapshotId ?? source.url;
  return {
    snapshotId: id,
    documentId: id,
    url: source.url,
    title: new URL(source.url).host,
    visibleText: source.passages.map((p) => p.text).join("\n"),
    passages: source.passages,
    omittedPassages: source.incomplete,
    interactiveElements: [],
    accessibilityTreeSummary: "Read-only source; no offered actions.",
    timestamp: new Date().toISOString(),
  };
}

/** Resolution is mechanical. Only exact extraction is automatically called supported. */
export function verifyDiscovery(
  action: Extract<BrowserAction, { type: "finish" }>,
  scope: Discovery,
  observations: ReadonlyMap<string, BrowserObservation>,
) {
  const resolves = (
    reference: { snapshotId: string; passageId: string; quote: string },
    url?: string,
  ) => {
    const passage = observations
      .get(reference.snapshotId)
      ?.passages?.find((p) => p.id === reference.passageId);
    return Boolean(
      passage &&
      (!url || passage.url === url) &&
      passage.text.includes(reference.quote),
    );
  };
  if (scope.mode === "research") {
    const claims = action.claims ?? [];
    const valid =
      claims.length > 0 &&
      claims.every(
        (claim) =>
          claim.evidence.every((ref) => resolves(ref)) &&
          (claim.kind === "extract"
            ? claim.evidence.some(
                (ref) =>
                  ref.quote === claim.text &&
                  observations
                    .get(ref.snapshotId)
                    ?.passages?.some(
                      (passage) =>
                        passage.id === ref.passageId &&
                        passage.text === claim.text,
                    ),
              )
            : Boolean(claim.qualification)),
      );
    const supported =
      valid && claims.every((claim) => claim.kind === "extract");
    // Do not let an uncited final answer smuggle additional factual claims past verified extracts.
    const answerMatches =
      action.answer === claims.map((claim) => claim.text).join("\n");
    return {
      passed: supported && answerMatches,
      detail: !valid
        ? "Invalid claim references or missing qualifications."
        : !answerMatches
          ? "Answer must exactly join the cited claim texts."
          : supported
            ? "Citations resolve; all claims reproduce complete captured passages. Semantic truth and contradictions still need review."
            : "Citations resolve; paraphrase/conflict support requires human review. No entailment claim.",
    };
  }
  const result = action.webFind;
  if (
    result?.outcome === "matches" &&
    new Set(result.matches.map((match) => match.url)).size !==
      result.matches.length
  )
    return { passed: false, detail: "Ranked source URLs must be unique." };
  const passed =
    result?.outcome === "matches" &&
    result.matches.every((match) =>
      match.evidence.every((ref) => resolves(ref, match.url)),
    );
  return {
    passed: Boolean(passed),
    detail: passed
      ? "Ranked URLs have captured source references; semantic relevance still requires review."
      : "No validated source matches; absence from the wider web/history is not established.",
  };
}
