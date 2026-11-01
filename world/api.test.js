import { describe, expect, test } from "bun:test";

describe("/world api flood-zone fallback", () => {
  test("falls back to lowland when NFHL is unavailable", async () => {
    process.env.OVERPASS_URL = "https://overpass.test/api/interpreter";
    process.env.NFHL_LAYER_URL = "https://nfhl.test/query";

    const origFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
      const url = String(input);
      if (url.startsWith("https://overpass.test")) {
        return new Response(JSON.stringify({
          elements: [
            {
              type: "way",
              id: 1,
              tags: { building: "house" },
              geometry: [
                { lat: 29.7, lon: -95.5 },
                { lat: 29.7001, lon: -95.5 },
                { lat: 29.7001, lon: -95.4999 },
                { lat: 29.7, lon: -95.4999 },
              ],
            },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.startsWith("https://nfhl.test")) {
        throw new Error("NFHL unavailable");
      }
      return new Response("{}", { status: 404 });
    };

    try {
      const mod = await import(`./api.js?t=${crypto.randomUUID()}`);
      const out = await mod.getArea(29.7, -95.5, 150);
      expect(out.source).toBe("osm");
      expect(out.floodZonesSource).toBe("fallback-lowland");
      expect(Array.isArray(out.floodZones)).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
      delete process.env.OVERPASS_URL;
      delete process.env.NFHL_LAYER_URL;
    }
  });
});
