import type { SearchBackend } from "../contract";

/** Engine links are candidates; only a separate admitted page read can supply evidence. */
export const engineTabSearch: SearchBackend = {
  id: "engine-tab",
  async search({ url, signal, read }) {
    const source = await read(url, signal);
    if (source.kind === "refused") return source;
    const candidates: { url: string; title: string }[] = [];
    for (const link of source.links) {
      try {
        const target = new URL(link.url);
        // DuckDuckGo HTML results wrap destination URLs. No redirect is followed implicitly.
        const decoded =
          (target.hostname === "duckduckgo.com" ||
            target.hostname.endsWith(".duckduckgo.com")) &&
          target.pathname === "/l/"
            ? new URL(target.searchParams.get("uddg") ?? "")
            : target;
        decoded.hash = "";
        if (
          ["http:", "https:"].includes(decoded.protocol) &&
          !decoded.search &&
          !decoded.username &&
          !decoded.password &&
          !candidates.some((c) => c.url === decoded.href)
        )
          candidates.push({ url: decoded.href, title: link.title });
      } catch {
        // Malformed result links are not navigable candidates.
      }
    }
    return { kind: "results", candidates };
  },
};
