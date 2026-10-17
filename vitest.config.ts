import { defineConfig } from "vitest/config";
import type { Task } from "vitest";

function skippedTasks(tasks: readonly Task[]): string[] {
  return tasks.flatMap((task) => [
    ...(task.mode === "skip" || task.mode === "todo" || task.result?.state === "skip" || task.result?.state === "todo" ? [task.name] : []),
    ...("tasks" in task ? skippedTasks(task.tasks) : [])
  ]);
}

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"],
    reporters: ["default", {
      onFinished(files) {
        const skipped = skippedTasks(files);
        if (skipped.length) throw new Error(`Skipped tests fail the check: ${skipped.join(", ")}`);
      }
    }]
  },
  resolve: {
    alias: {
      "@chromeclaw/egress": new URL("./packages/egress/src/index.ts", import.meta.url).pathname,
      "@chromeclaw/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
      "@chromeclaw/browser": new URL("./packages/browser/src/index.ts", import.meta.url).pathname,
      "@chromeclaw/agent": new URL("./packages/agent/src/index.ts", import.meta.url).pathname,
      "@chromeclaw/evals": new URL("./packages/evals/src/index.ts", import.meta.url).pathname
    }
  }
});
