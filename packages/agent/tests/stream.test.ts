import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  OpenAICompatiblePlanner,
  PlannerTransportError,
} from "../src/llm/openai";
import type { PlannerInput } from "../src/llm/index";
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
const input: PlannerInput = {
  task: "Read",
  observation: {
    snapshotId: "s",
    documentId: "d",
    url: "about:blank",
    title: "",
    visibleText: "",
    interactiveElements: [],
    accessibilityTreeSummary: "",
    timestamp: "now",
  },
  observationSummary: "",
  recentSteps: "",
  maxSteps: 4,
  onCrossing: async () => undefined,
};
async function fixture(mode: string) {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.setHeader("content-type", "text/event-stream");
    const text = JSON.stringify({
      type: "finish",
      answer: mode === "key" ? "SYNTHETIC_KEY" : "Captured fact.",
    });
    for (const character of text)
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: character }, finish_reason: null }] })}\n\n`,
      );
    if (mode === "slow") return;
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 8 } })}\n\n`,
    );
    response.end(mode === "truncated" ? "" : "data: [DONE]\n\n");
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture address");
  const planner = new OpenAICompatiblePlanner({
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    mode: "local",
    requestCost: 0,
    stream: true,
    apiKey: mode === "key" ? "SYNTHETIC_KEY" : undefined,
  });
  return { planner, requests: () => requests };
}
describe("bounded streamed action proposals", () => {
  it("collects frames before parsing one action and records usage separately from byte progress", async () => {
    const site = await fixture("valid");
    const progress: number[] = [];
    const usage: unknown[] = [];
    const action = await site.planner.plan({
      ...input,
      onProgress: (p) => progress.push(p.receivedBytes),
      onUsage: async (u) => {
        usage.push(u);
      },
    });
    expect(action).toMatchObject({ type: "finish", answer: "Captured fact." });
    expect(progress.at(-1)).toBeGreaterThan(0);
    expect(usage).toEqual([{ promptTokens: 12, completionTokens: 8 }]);
    expect(site.requests()).toBe(1);
  });
  it("refuses a disconnected stream instead of executing its partial JSON", async () => {
    const site = await fixture("truncated");
    await expect(site.planner.plan(input)).rejects.toBeInstanceOf(
      PlannerTransportError,
    );
    expect(site.requests()).toBe(1);
  });
  it("detects keys split across individually valid frames without exposing content in progress", async () => {
    const site = await fixture("key");
    const progress: unknown[] = [];
    await expect(
      site.planner.plan({ ...input, onProgress: (p) => progress.push(p) }),
    ).rejects.toThrow("credential echo");
    expect(JSON.stringify(progress)).not.toContain("SYNTHETIC_KEY");
    expect(site.requests()).toBe(1);
  });
  it("aborts a long stream without a parser repair or another send", async () => {
    const site = await fixture("slow");
    const abort = new AbortController();
    await expect(
      site.planner.plan({
        ...input,
        signal: abort.signal,
        onProgress: () => abort.abort(),
      }),
    ).rejects.toThrow("aborted");
    expect(site.requests()).toBe(1);
  });
});
