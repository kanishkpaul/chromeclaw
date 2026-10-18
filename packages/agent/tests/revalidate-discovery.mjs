import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import {
  DiscoverySchema,
  ObservationRecordSchema,
  FinishActionSchema,
} from "@chromeclaw/shared";
import { verifyDiscovery } from "../src/discovery.ts";
const reportPath = process.argv[2];
if (!reportPath)
  throw new Error("Provide the immutable actual-local report path.");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const results = [];
for (const result of report.results) {
  const events = (
    await readFile(path.join(path.dirname(reportPath), result.log), "utf8")
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const scope = DiscoverySchema.parse(
    events.find((event) => event.type === "run_started").payload.discovery,
  );
  const observations = new Map(
    events
      .filter((event) => event.type === "observation")
      .map((event) => {
        const observation = ObservationRecordSchema.parse(event.payload);
        return [observation.snapshotId, observation];
      }),
  );
  const finish = FinishActionSchema.parse(
    events
      .filter(
        (event) =>
          event.type === "step" && event.payload.action?.type === "finish",
      )
      .at(-1).payload.action,
  );
  const verdict = verifyDiscovery(finish, scope, observations);
  const expected = result.mode !== "web" || result.id <= 15;
  assert.equal(verdict.passed, expected, `${result.mode}-${result.id}`);
  results.push({
    mode: result.mode,
    id: result.id,
    allowed: verdict.passed,
    expected,
    detail: verdict.detail,
    requestAttempts: events.filter((event) => event.type === "crossing").length,
    usage: events
      .filter((event) => event.type === "model_usage")
      .map((event) => event.payload),
  });
}
const output = {
  kind: "deterministic replay of recorded proposals against final verifier; no inference rerun",
  report: path.basename(reportPath),
  results,
  passed: results.length,
};
if (process.argv[3])
  await writeFile(process.argv[3], JSON.stringify(output, null, 2) + "\n");
console.log(
  JSON.stringify({
    revalidated: results.length,
    requestAttempts: results.reduce(
      (sum, result) => sum + result.requestAttempts,
      0,
    ),
  }),
);
