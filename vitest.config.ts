import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@chromeclaw/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
      "@chromeclaw/browser": new URL("./packages/browser/src/index.ts", import.meta.url).pathname,
      "@chromeclaw/agent": new URL("./packages/agent/src/index.ts", import.meta.url).pathname,
      "@chromeclaw/evals": new URL("./packages/evals/src/index.ts", import.meta.url).pathname
    }
  }
});
