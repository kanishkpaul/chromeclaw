import { describe, expect, it } from "vitest";
import {
  describePlannerConfig,
  resolvePlannerConfig,
  resolveRunSettings,
} from "../src/llm/config";

const hosted = {
  provider: "openai",
  model: "chosen-model",
  apiKey: "SYNTHETIC_KEY",
};
describe("provider configuration", () => {
  it("selects only explicit providers and lets options beat environment", () => {
    expect(
      resolvePlannerConfig(
        {},
        { OPENAI_API_KEY: "unselected", HF_TOKEN: "unselected" },
      ).provider,
    ).toBe("mock");
    const config = resolvePlannerConfig(hosted, {
      CHROMECLAW_PROVIDER: "local",
      CHROMECLAW_MODEL: "other",
      OPENAI_API_KEY: "other-key",
    });
    expect(config).toMatchObject({
      provider: "openai",
      model: "chosen-model",
      apiKey: "SYNTHETIC_KEY",
      baseUrl: "https://api.openai.com/v1",
    });
    expect(
      resolvePlannerConfig(
        { provider: "hf", model: "explicit" },
        { HF_TOKEN: "hf-key" },
      ).provider,
    ).toBe("huggingface");
    expect(() =>
      resolvePlannerConfig({ ...hosted, provider: "anthropic" }, {}),
    ).toThrow("unavailable");
  });

  it("requires non-mock models, hosted keys and explicit compatible endpoints", () => {
    for (const options of [
      { provider: "openai", apiKey: "key" },
      { provider: "openai", model: "model" },
      { ...hosted, model: "" },
      { ...hosted, apiKey: "" },
      { ...hosted, apiKey: "has\nnewline" },
      { ...hosted, provider: "openai-compatible" },
    ])
      expect(() => resolvePlannerConfig(options, {})).toThrow();
    expect(
      resolvePlannerConfig(
        {
          ...hosted,
          provider: "openai-compatible",
          baseUrl: "https://provider.example/v1/",
        },
        {},
      ).mode,
    ).toBe("hosted");
  });

  it("never gives local a hosted endpoint or hosted credentials", () => {
    const env = {
      OPENAI_API_KEY: "DO_NOT_SEND_HOSTED_KEY",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
    };
    expect(() =>
      resolvePlannerConfig({ provider: "local", model: "model" }, env),
    ).toThrow("base URL");
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const config = resolvePlannerConfig(
        {
          provider: "local",
          model: "model",
          baseUrl: `http://${host}:1234/v1`,
        },
        env,
      );
      expect(config).toMatchObject({ mode: "local" });
      expect("apiKey" in config).toBe(false);
    }
    const explicit = resolvePlannerConfig(
      {
        provider: "local",
        model: "model",
        baseUrl: "http://localhost:1234/v1",
      },
      { ...env, CHROMECLAW_LOCAL_API_KEY: "local-key" },
    );
    expect(explicit).toMatchObject({ apiKey: "local-key" });
  });

  it("refuses misleading local hosts, insecure hosted transport and secret-bearing settings", () => {
    for (const baseUrl of [
      "http://localhost.attacker.example/v1",
      "https://example.com/v1",
      "file:///tmp/model",
      "http://localhost:1234/v1?key=secret",
      "http://user:password@localhost/v1",
      "http://localhost/v1#secret",
    ])
      expect(() =>
        resolvePlannerConfig(
          { provider: "local", model: "model", baseUrl },
          {},
        ),
      ).toThrow();
    for (const baseUrl of [
      "http://hosted.example/v1",
      "https://localhost/v1",
      "https://example.com/SYNTHETIC_KEY",
      "https://example.com/v1?api_key=secret",
    ])
      expect(() => resolvePlannerConfig({ ...hosted, baseUrl }, {})).toThrow();
    expect(() =>
      resolvePlannerConfig({ ...hosted, model: "model-SYNTHETIC_KEY" }, {}),
    ).toThrow();
    const publicConfig = describePlannerConfig(
      resolvePlannerConfig(hosted, {}),
    );
    expect(JSON.stringify(publicConfig)).not.toContain("SYNTHETIC_KEY");
    expect(publicConfig).toMatchObject({
      keyConfigured: true,
      readiness: "accounting-required",
    });
  });

  it("rejects invalid budgets and headless values instead of silently applying defaults", () => {
    for (const value of [0, -1, NaN, Infinity, 1.5]) {
      expect(() => resolveRunSettings({ maxSteps: value }, {})).toThrow();
      expect(() => resolveRunSettings({ timeoutMs: value }, {})).toThrow();
    }
    expect(() => resolveRunSettings({ timeoutMs: 2147483648 }, {})).toThrow();
    expect(() =>
      resolveRunSettings({}, { CHROMECLAW_HEADLESS: "yes" }),
    ).toThrow();
    expect(
      resolveRunSettings(
        { maxSteps: 4, headless: false },
        {
          CHROMECLAW_MAX_STEPS: "9",
          CHROMECLAW_TIMEOUT_MS: "8000",
          CHROMECLAW_HEADLESS: "true",
        },
      ),
    ).toEqual({ maxSteps: 4, timeoutMs: 8000, headless: false });
    expect(resolveRunSettings({}, {})).toEqual({
      maxSteps: 20,
      timeoutMs: 120000,
      headless: false,
    });
  });
});
