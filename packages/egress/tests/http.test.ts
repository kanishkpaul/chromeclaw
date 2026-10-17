import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { postJson, type Crossing } from "../src/index";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
async function fixture() {
  const paths: string[] = [];
  const bodies: string[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url ?? "");
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: unknown) => {
      if (typeof chunk === "string") body += chunk;
    });
    request.on("end", () => {
      bodies.push(body);
      response.setHeader("content-type", "application/json");
      if (request.url === "/redirect") {
        response.writeHead(302, { location: "/target" });
        response.end();
      } else if (request.url === "/slow") {
        response.writeHead(200);
        response.write('{"partial":');
      } else if (request.url === "/retry") {
        response.writeHead(429, { "retry-after": "0" });
        response.end("SYNTHETIC_BODY_SECRET");
      } else if (request.url === "/error") {
        response.writeHead(500);
        response.end("SYNTHETIC_BODY_SECRET");
      } else if (request.url === "/large")
        response.end(JSON.stringify({ text: "x".repeat(5000) }));
      else if (request.url === "/echo")
        response.end(JSON.stringify({ content: "SYNTHETIC_KEY" }));
      else if (request.url === "/bad") response.end("not-json");
      else response.end(JSON.stringify({ accepted: true }));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture address.");
  const origin = `http://127.0.0.1:${address.port}`;
  return { origin, paths, bodies };
}
describe("bounded application egress", () => {
  it("records metadata before sending exactly the approved body", async () => {
    const site = await fixture();
    const crossings: Crossing[] = [];
    const result = await postJson({
      url: `${site.origin}/ok`,
      approvedOrigin: site.origin,
      apiKey: "SYNTHETIC_KEY",
      body: { content: "approved" },
      onCrossing: async (crossing) => {
        expect(site.paths).toHaveLength(0);
        crossings.push(crossing);
      },
    });
    expect(result.ok).toBe(true);
    expect(site.bodies).toEqual(['{"content":"approved"}']);
    expect(JSON.stringify(crossings)).not.toContain("SYNTHETIC_KEY");
    expect(crossings[0]?.requestBytes).toBe(22);
  });
  it("never sends after an audit failure, abort or origin mismatch", async () => {
    const site = await fixture();
    const abort = new AbortController();
    abort.abort();
    for (const request of [
      { approvedOrigin: "https://other.example" },
      { signal: abort.signal },
      {
        onCrossing: async () => {
          throw new Error("storage failed");
        },
      },
    ]) {
      const result = await postJson({
        url: `${site.origin}/ok`,
        approvedOrigin: site.origin,
        body: {},
        onCrossing: async () => undefined,
        ...request,
      });
      expect(result.ok).toBe(false);
    }
    expect(site.paths).toHaveLength(0);
    expect(
      await postJson({
        url: `${site.origin}/ok`,
        approvedOrigin: site.origin,
        body: {},
        timeoutMs: 40,
        onCrossing: async () => new Promise<void>(() => undefined),
      }),
    ).toMatchObject({ ok: false, code: "timeout", attempts: 0 });
    expect(site.paths).toHaveLength(0);
  });
  it("bounds request bytes, response bytes and streaming-body time", async () => {
    const site = await fixture();
    const send = (path: string, options = {}) =>
      postJson({
        url: `${site.origin}${path}`,
        approvedOrigin: site.origin,
        body: { text: "long" },
        onCrossing: async () => undefined,
        ...options,
      });
    expect(await send("/ok", { requestLimit: 2 })).toMatchObject({
      ok: false,
      code: "request-limit",
    });
    expect(await send("/large", { responseLimit: 100 })).toMatchObject({
      ok: false,
      code: "response-limit",
    });
    expect(await send("/slow", { timeoutMs: 80 })).toMatchObject({
      ok: false,
      code: "timeout",
    });
  });
  it("caps 429 retries and withholds HTTP error bodies", async () => {
    const site = await fixture();
    const result = await postJson({
      url: `${site.origin}/retry`,
      approvedOrigin: site.origin,
      body: {},
      onCrossing: async () => undefined,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "http",
      attempts: 3,
      status: 429,
    });
    expect(site.paths).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_BODY_SECRET");
  });
  it("refuses configured credentials in a body or echoed response", async () => {
    const site = await fixture();
    const send = (path: string, body: unknown) =>
      postJson({
        url: `${site.origin}${path}`,
        approvedOrigin: site.origin,
        apiKey: "SYNTHETIC_KEY",
        body,
        onCrossing: async () => undefined,
      });
    expect(await send("/ok", { content: "SYNTHETIC_KEY" })).toMatchObject({
      ok: false,
      code: "invalid-request",
      attempts: 0,
    });
    expect(await send("/echo", {})).toMatchObject({
      ok: false,
      code: "credential-echo",
    });
  });
  it("refuses automatic redirects and malformed JSON", async () => {
    const site = await fixture();
    const send = (path: string) =>
      postJson({
        url: `${site.origin}${path}`,
        approvedOrigin: site.origin,
        body: {},
        onCrossing: async () => undefined,
      });
    expect(await send("/redirect")).toMatchObject({
      ok: false,
      code: "network",
    });
    expect(site.paths).not.toContain("/target");
    expect(await send("/bad")).toMatchObject({
      ok: false,
      code: "malformed-json",
    });
    expect(await send("/error")).toMatchObject({
      ok: false,
      code: "http",
      status: 500,
    });
  });
});

describe("pre-send request reservations", () => {
  it("asks admission for each retry and never sends a refused attempt", async () => {
    const site = await fixture();
    const crossings: Crossing[] = [];
    const result = await postJson({
      url: `${site.origin}/retry`,
      approvedOrigin: site.origin,
      body: {},
      reservation: { cost: 0.1, accounting: "user-ceiling" },
      onCrossing: async (crossing) => {
        crossings.push(crossing);
        return crossings.length === 1;
      },
    });
    expect(result).toEqual({
      ok: false,
      code: "budget-exhausted",
      attempts: 1,
    });
    expect(site.paths).toHaveLength(1);
    expect(crossings).toHaveLength(2);
    expect(
      crossings.every(
        (crossing) =>
          crossing.estimatedCost === 0.1 &&
          crossing.accounting === "user-ceiling",
      ),
    ).toBe(true);
  });

  it("rejects invalid declared cost instead of inventing a zero-cost hosted send", async () => {
    const site = await fixture();
    for (const cost of [-1, 0, NaN, Infinity]) {
      const result = await postJson({
        url: `${site.origin}/ok`,
        approvedOrigin: site.origin,
        body: {},
        reservation: { cost, accounting: "user-ceiling" },
        onCrossing: async () => undefined,
      });
      expect(result).toEqual({
        ok: false,
        code: "invalid-request",
        attempts: 0,
      });
    }
    expect(site.paths).toHaveLength(0);
  });
});
