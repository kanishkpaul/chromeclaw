import type { SearchBackend } from "./contract";
export type { SearchBackend } from "./contract";
// Each backend has one registration and imports only its shared contract.
export const searchBackends: readonly SearchBackend[] = Object.freeze([
  (await import("./engine-tab/index")).engineTabSearch,
]);
