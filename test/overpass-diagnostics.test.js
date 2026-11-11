import { expect, test } from "bun:test";
import { createAreaService, handleOverpassHealth, publicProviderOrigin } from "../world/api.js";

const syntheticEndpoint = "https://demo-user:demo-password@maps.example.test:8443/private-path?key=demo-token#demo-fragment";
const publicOrigin = "https://maps.example.test:8443";
const privateParts = ["demo-user", "demo-password", "private-path", "demo-token", "demo-fragment"];

function expectRedacted(value) {
  const text = JSON.stringify(value);
  for (const part of privateParts) expect(text).not.toContain(part);
}

test("provider display origins drop credentials, paths, query and fragments", () => {
  expect(publicProviderOrigin(syntheticEndpoint)).toBe(publicOrigin);
  expect(publicProviderOrigin("invalid-private-path")).toBeNull();
  expect(publicProviderOrigin("data:text/plain,private-path")).toBeNull();
});

test("health routes the original endpoint while returning only the origin and safe probe details", async () => {
  const calls = [];
  const response = await handleOverpassHealth({
    endpoints: [syntheticEndpoint],
    fetchImpl: async (url, { method }) => {
      calls.push({ url, method });
      return new Response(null, { status: method === "POST" ? 405 : 503 });
    },
  });
  expect(calls[0]).toEqual({ url: syntheticEndpoint, method: "POST" });
  expect(calls[1].method).toBe("GET");
  expect(calls[1].url.startsWith(syntheticEndpoint + "&data=")).toBe(true);
  const report = await response.json();
  expect(report.endpoints).toEqual([publicOrigin]);
  expect(report.results[0]).toMatchObject({
    endpoint: publicOrigin, host: "maps.example.test:8443", ok: false, status: 503, error: "HTTP 503",
  });
  expectRedacted(report);
});

test("map and health failures never echo configured URLs or arbitrary provider messages", async () => {
  let attempts = 0;
  const failure = async () => {
    attempts++;
    throw new Error(`network failure ${syntheticEndpoint}`);
  };
  const service = createAreaService({
    endpoints: [syntheticEndpoint], fetchImpl: failure, readSnapshot: () => null,
    writeSnapshot: () => {},
  });
  const area = await service.getCore(29, -95, 400);
  expect(area.source).toBe("none");
  expect(area.error).toContain("maps.example.test:8443 network unavailable");
  expect(attempts).toBe(1);
  expectRedacted(area);

  const enrichment = await service.getEnrichment(29, -95, 400);
  expect(enrichment.floodZonesError).toBe("network unavailable");
  expectRedacted(enrichment);

  const report = await (await handleOverpassHealth({
    endpoints: [syntheticEndpoint, "invalid-private-path"], fetchImpl: failure,
  })).json();
  expect(report.results[0]).toMatchObject({ status: null, error: "network unavailable" });
  expect(report.results[1]).toMatchObject({ endpoint: null, host: "invalid provider endpoint" });
  expectRedacted(report);
});
