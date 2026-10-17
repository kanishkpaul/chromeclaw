import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const cli = ["--import", "tsx", "apps/cli/src/index.ts"];

describe("CLI process interface", () => {
  it("describes controlled fixture evals without opening a browser", () => {
    const help = execFileSync(process.execPath, [...cli, "eval", "--help"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(help).toContain("--inject-failure");
    expect(help).toContain("every controlled fixture");
  });

  it("rejects unknown commands with a nonzero status", () => {
    const result = spawnSync(process.execPath, [...cli, "not-a-command"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unknown command");
  });

  it("returns failure when a requested trace is absent", () => {
    const result = spawnSync(
      process.execPath,
      [
        ...cli,
        "show",
        "missing",
        "--log-dir",
        "/nonexistent-chromeclaw-fixture",
      ],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Run not found");
  });
});

describe("provider CLI boundary", () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("CHROMECLAW_") &&
        ![
          "OPENAI_API_KEY",
          "OPENAI_BASE_URL",
          "HF_TOKEN",
          "HUGGINGFACE_API_KEY",
          "HF_BASE_URL",
        ].includes(key),
    ),
  );
  env.DOTENV_CONFIG_PATH = "/nonexistent-chromeclaw-fixture-env";
  it("inspects explicit local selection as clean JSON without inheriting hosted keys", () => {
    const result = spawnSync(
      process.execPath,
      [
        ...cli,
        "config",
        "--provider",
        "local",
        "--model",
        "fixture-model",
        "--base-url",
        "http://127.0.0.1:1234/v1",
        "--json",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...env,
          OPENAI_API_KEY: "DO_NOT_SEND_HOSTED_KEY",
          CHROMECLAW_PROVIDER: "openai",
        },
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      provider: "local",
      mode: "local",
      keyConfigured: false,
      readiness: "accounting-required",
    });
    expect(result.stdout).not.toContain("DO_NOT_SEND_HOSTED_KEY");
    expect(result.stdout).not.toContain("\u001b");
  });

  it("rejects invalid provider and run settings with no successful run", () => {
    for (const args of [
      ["config", "--provider", "local", "--model", "model", "--json"],
      ["config", "--provider", "openai", "--json"],
      ["config", "--provider", "anthropic", "--json"],
      ["run", "fixture", "--provider", "mock", "--max-steps", "NaN", "--json"],
      ["run", "fixture", "--provider", "mock", "--timeout-ms", "0", "--json"],
    ]) {
      const result = spawnSync(process.execPath, [...cli, ...args], {
        cwd: root,
        encoding: "utf8",
        env,
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("DO_NOT_SEND_HOSTED_KEY");
    }
  });
});
