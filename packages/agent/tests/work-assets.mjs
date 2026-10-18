import { build } from "tsup";
await build({ entry: ["packages/agent/tests/fixtures/work-react.jsx"], format: ["iife"], outDir: ".chromeclaw/phase6-assets", noExternal: [/.*/], minify: true, silent: true, define: { "process.env.NODE_ENV": '"production"' } });
