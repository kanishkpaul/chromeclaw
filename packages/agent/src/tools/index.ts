import type { BrowserTool } from "./contract";
// Each line is the plugin's sole registration. Removing a tool needs no runtime switch edit.
export const browserTools: readonly BrowserTool[] = Object.freeze([
  (await import("./click")).tool,
  (await import("./type")).tool,
  (await import("./select")).tool,
  (await import("./press")).tool,
  (await import("./scroll")).tool,
  (await import("./navigate")).tool,
  (await import("./back")).tool,
  (await import("./wait")).tool,
  (await import("./tab")).tool,
]);
