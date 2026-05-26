import { afterEach, describe, expect, it } from "vitest";
import { createPlanner } from "../src/index";

describe("createPlanner", () => {
  afterEach(() => {
    delete process.env.CHROMECLAW_PROVIDER;
    delete process.env.CHROMECLAW_MODEL;
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("builds a Hugging Face planner from explicit provider config", () => {
    const planner = createPlanner({
      provider: "huggingface",
      model: "Qwen/Qwen2.5-Coder-32B-Instruct",
      apiKey: "hf_test"
    });

    expect(planner.name).toBe("huggingface");
    expect(planner.model).toBe("Qwen/Qwen2.5-Coder-32B-Instruct");
  });

  it("prefers Hugging Face when HF credentials are present in env", () => {
    process.env.HF_TOKEN = "hf_test";
    process.env.CHROMECLAW_MODEL = "openai/gpt-oss-120b";

    const planner = createPlanner();

    expect(planner.name).toBe("huggingface");
    expect(planner.model).toBe("openai/gpt-oss-120b");
  });
});
