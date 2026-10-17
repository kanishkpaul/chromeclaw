import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, appendFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { JsonlRunStore } from "../src/storage/jsonl";
const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0))
    await rm(dir, { recursive: true, force: true });
});
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "chromeclaw-store-"));
  directories.push(dir);
  return { dir, store: new JsonlRunStore(dir) };
}
const header = {
  id: "run_fixture_1",
  task: "read",
  status: "observing",
  startedAt: "now",
  maxSteps: 3,
  provider: "script",
  model: "fixture",
};
describe("durable run events", () => {
  it("recovers a killed writer from complete lines and reports its corrupt tail", async () => {
    const { dir, store } = await fixture();
    await store.append({
      version: 1,
      type: "run_started",
      timestamp: "now",
      runId: header.id,
      payload: header,
    });
    await store.append({
      version: 1,
      type: "state",
      timestamp: "now",
      runId: header.id,
      payload: {
        status: "awaiting-answer",
        pending: { id: "p", kind: "answer", question: "Which city?" },
      },
    });
    await appendFile(path.join(dir, `${header.id}.jsonl`), '{"partial":');
    const result = await store.readDetailed(header.id);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.run.status).toBe("paused");
      expect(result.run.pending?.kind).toBe("answer");
      expect(result.warnings).toHaveLength(2);
    }
  });
  it("distinguishes a missing file, invalid record, traversal and symlink", async () => {
    const { dir, store } = await fixture();
    expect(await store.readDetailed("missing")).toEqual({ kind: "missing" });
    expect(await store.readDetailed("../outside")).toMatchObject({
      kind: "invalid",
    });
    await writeFile(path.join(dir, "bad.jsonl"), "{}\n{}\n");
    expect(await store.readDetailed("bad")).toMatchObject({ kind: "invalid" });
    const outside = path.join(dir, "target");
    await writeFile(outside, "unchanged");
    await symlink(outside, path.join(dir, `${header.id}.jsonl`));
    expect(await store.readDetailed(header.id)).toMatchObject({ kind: "io" });
    await expect(
      store.append({
        version: 1,
        type: "run_started",
        timestamp: "now",
        runId: header.id,
        payload: header,
      }),
    ).rejects.toThrow();
  });
  it("rejects malformed payloads before writing", async () => {
    const { store } = await fixture();
    expect(() =>
      store.append({
        version: 1,
        type: "state",
        timestamp: "now",
        runId: header.id,
        payload: { status: "invented" },
      }),
    ).toThrow();
  });
});
