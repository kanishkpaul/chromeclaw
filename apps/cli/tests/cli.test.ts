import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const cli = ["--import", "tsx", "apps/cli/src/index.ts"];

describe("CLI process interface", () => {
  it("describes controlled fixture evals without opening a browser", () => {
    const help = execFileSync(process.execPath, [...cli, "eval", "--help"], { cwd: root, encoding: "utf8" });
    expect(help).toContain("--inject-failure");
    expect(help).toContain("every controlled fixture");
  });

  it("rejects unknown commands with a nonzero status", () => {
    const result = spawnSync(process.execPath, [...cli, "not-a-command"], { cwd: root, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unknown command");
  });

  it("returns failure when a requested trace is absent", () => {
    const result = spawnSync(process.execPath, [...cli, "show", "missing", "--log-dir", "/nonexistent-chromeclaw-fixture"], {
      cwd: root, encoding: "utf8"
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Run not found");
  });
});
