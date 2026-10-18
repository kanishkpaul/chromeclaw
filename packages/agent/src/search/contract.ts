import type { SourceRead } from "@chromeclaw/browser";
export interface SearchBackend {
  id: string;
  search(input: {
    url: string;
    signal: AbortSignal;
    read: (url: string, signal: AbortSignal) => Promise<SourceRead>;
  }): Promise<
    | { kind: "results"; candidates: { url: string; title: string }[] }
    | { kind: "refused"; reason: string }
  >;
}
