#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runEvaluationCli } from "./fixtures";

export * from "./scoring";
export * from "./tasks";
export { runEvaluationCli, runFixtureEvals } from "./fixtures";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).find((arg) => !["--all", "--headed", "--inject-failure"].includes(arg));
  if (unknown) {
    console.error(`Unknown eval option: ${unknown}`);
    process.exitCode = 1;
  } else {
    runEvaluationCli({ headed: process.argv.includes("--headed"), injectFailure: process.argv.includes("--inject-failure") })
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
  }
}
