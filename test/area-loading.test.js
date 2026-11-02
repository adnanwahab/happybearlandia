import { describe, test, expect } from "bun:test";
import { createAreaService, handleArea, handleAreaEnrichment } from "../world/api.js";
const osm = () => Response.json({ elements: [{ type: "way", id: 17, tags: { building: "apartments", "building:levels": "3" }, geometry: [{ lat: 30, lon: -95 }, { lat: 30.0001, lon: -95 }, { lat: 30.0001, lon: -94.9999 }, { lat: 30, lon: -95 }] }] });
const fema = () => Response.json({ features: [{ attributes: { FLD_ZONE: "AE" }, geometry: { rings: [[[-95,30],[-94.9,30],[-94.9,30.1],[-95,30]]] } }] });
const isFema = (url) => String(url).includes("fema") || String(url).includes("nfhl");
const fixture = (options = {}) => createAreaService({ endpoints: ["https://osm.test"], readSnapshot: () => null, writeSnapshot: () => {}, ...options });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("progressive area service", () => {
  test("cold/cached core excludes slow FEMA while legacy full response remains complete", async () => {
    let floodCalls = 0;
    const fetchImpl = async (url) => { if (isFema(url)) { floodCalls++; await sleep(90); return fema(); } await sleep(5); return osm(); };
    const service = fixture({ fetchImpl });
    const startCore = performance.now(); const core = await service.getArea(30,-95,400,{core:true}); const coreMs = performance.now()-startCore;
    expect(floodCalls).toBe(0); expect(core.source).toBe("osm"); expect(core.buildings[0].id).toBe("w17"); expect(core.floodZonesStatus).toBe("pending"); expect(core.enrichment.url).toContain("radiusM=400");
    const startCached = performance.now(); const cached = await service.getCore(30,-95,400); const cachedMs = performance.now()-startCached;
    expect(cached.cacheStatus).toBe("hit"); expect(floodCalls).toBe(0);
    const startFull = performance.now(); const full = await service.getArea(30.01,-95,400); const fullMs = performance.now()-startFull;
    expect(full.source).toBe("osm"); expect(full.floodZonesSource).toBe("fema-nfhl"); expect(full.floodZones[0].zone).toBe("AE"); expect(full.phase).toBe("complete"); expect(fullMs).toBeGreaterThanOrEqual(80);
    console.info("Area mocked load timings ms:", JSON.stringify({ coldCore: Math.round(coreMs), cachedCore: Math.round(cachedMs), coldFullWithSlowFema: Math.round(fullMs) }));
  });
  test("first valid Overpass mirror wins and aborts a slow mirror", async () => {
    let aborted = false;
    const service = fixture({ endpoints: ["https://slow.test","https://fast.test"], overpassTimeoutMs: 300, fetchImpl: (url, options) => {
      if (String(url).includes("slow")) { options.signal.addEventListener("abort", () => { aborted = true; }); return new Promise(() => {}); }
      return Promise.resolve(osm());
    } });
    const start = performance.now(); const result = await service.getCore(30,-95,150);
    expect(result.source).toBe("osm"); expect(aborted).toBe(true); expect(performance.now()-start).toBeLessThan(250);
  });
  test("deduplicates core and enrichment independently and never replaces OSM identity with overlay metadata", async () => {
    let releaseCore, releaseFlood, osmCalls = 0, floodCalls = 0;
    const service = fixture({ fetchImpl: (url) => isFema(url) ? (floodCalls++, new Promise((resolve) => { releaseFlood = resolve; })) : (osmCalls++, new Promise((resolve) => { releaseCore = resolve; })) });
    const first = service.getCore(30,-95,250), second = service.getCore(30,-95,250); await sleep(0); expect(osmCalls).toBe(1); releaseCore(osm());
    const [a,b] = await Promise.all([first,second]); expect(a.areaKey).toBe(b.areaKey);
    const floodA = service.getEnrichment(30,-95,250), floodB = service.getEnrichment(30,-95,250); await sleep(0); expect(floodCalls).toBe(1); releaseFlood(fema());
    const [fa,fb] = await Promise.all([floodA,floodB]); expect(fa.areaKey).toBe(a.areaKey); expect(fb.floodZones).toEqual(fa.floodZones);
    const ready = await service.getCore(30,-95,250); expect(ready.source).toBe("osm"); expect(ready.cacheStatus).toBe("hit"); expect(ready.enrichment.status).toBe("ready"); expect(ready.radiusM).toBe(250); expect(ready.origin).toEqual({lat:30,lng:-95});
    expect(service.stats().corePending).toBe(0); expect(service.stats().enrichmentPending).toBe(0);
  });
  test("slow or unavailable FEMA has a bounded independent error cache and cannot invalidate core", async () => {
    let clock = 1000, osmCalls = 0, floodCalls = 0;
    const service = fixture({ now: () => clock, nfhlTimeoutMs: 15, failureTtlMs: 30, fetchImpl: (url) => isFema(url) ? (floodCalls++, new Promise(() => {})) : (osmCalls++, Promise.resolve(osm())) });
    await service.getCore(30,-95,400);
    const start = performance.now(); const result = await service.getEnrichment(30,-95,400);
    expect(result.floodZonesStatus).toBe("error"); expect(result.floodZonesSource).toBe("unavailable"); expect(result.floodZones).toEqual([]); expect(performance.now()-start).toBeLessThan(200);
    await service.getEnrichment(30,-95,400); expect(floodCalls).toBe(1);
    const core = await service.getCore(30,-95,400); expect(core.source).toBe("osm"); expect(core.stale).toBe(false); expect(osmCalls).toBe(1);
    clock += 31; await service.getEnrichment(30,-95,400); expect(floodCalls).toBe(2);
    const full = await service.getArea(30,-95,400); expect(full.floodZonesSource).toBe("fallback-lowland"); expect(full.floodZonesStatus).toBe("error"); expect(full.source).toBe("osm");
  });
  test("stale NFHL polygons remain explicitly stale when refresh fails", async () => {
    let clock = 1000, fail = false;
    const service = fixture({ now: () => clock, enrichmentTtlMs: 10, fetchImpl: async (url) => { if (!isFema(url)) return osm(); if (fail) throw new Error("NFHL maintenance"); return fema(); } });
    const first = await service.getEnrichment(30,-95,400); clock += 11; fail = true;
    const stale = await service.getEnrichment(30,-95,400); expect(stale.floodZones).toEqual(first.floodZones); expect(stale.floodZonesStatus).toBe("stale"); expect(stale.stale).toBe(true); expect(stale.fetchedAt).toBe(first.fetchedAt); expect(stale.floodZonesError).toContain("maintenance");
  });
  test("saved real OSM geometry is immediate, retains snapshot center/extent and refreshes in background", async () => {
    let release, calls = 0;
    const snapshot = { source:"osm",origin:{lat:30.0004,lng:-95.0003},radiusM:250,buildings:[{id:"saved",pts:[[30,-95],[30.1,-95],[30,-94.9],[30,-95]]}],roads:[],pois:[],floodZones:[],floodZonesSource:"fallback-lowland" };
    const service = fixture({ readSnapshot: (key) => key === "30.000,-95.000,400" ? snapshot : null, fetchImpl: () => { calls++; return new Promise((resolve) => { release=resolve; }); } });
    const core = await service.getCore(30,-95,400); expect(core.source).toBe("osm"); expect(core.stale).toBe(true); expect(core.refreshing).toBe(true); expect(core.origin).toEqual(snapshot.origin); expect(core.radiusM).toBe(250); expect(core.enrichment.url).toContain("radiusM=250"); expect(core.areaKey).toBe("30.000400,-95.000300,250"); expect(calls).toBe(1); release(osm()); await sleep(0);
    const refreshed = await service.getCore(30,-95,400); expect(refreshed.stale).toBe(false); expect(refreshed.buildings[0].id).toBe("w17");
  });
  test("bounded caches/inflight, exact request keys and real unavailable data", async () => {
    const service = fixture({ maxEntries:2, fetchImpl: async () => osm() });
    for (const lat of [30,30.0001,30.0002]) await service.getCore(lat,-95,150);
    expect(service.stats().coreEntries).toBe(2);
    let release;
    const busy = fixture({ maxInFlight:1, fetchImpl: () => new Promise((resolve)=>{release=resolve;}) });
    const pending = busy.getCore(30,-95,400); await sleep(0);
    const rejected = await busy.getCore(31,-95,400); expect(rejected.source).toBe("none"); expect(rejected.cacheStatus).toBe("busy"); expect(rejected.buildings).toEqual([]); release(osm()); await pending;
    const unavailable = fixture({ fetchImpl: async () => { throw new Error("network unavailable"); } });
    expect((await unavailable.getCore(30,-95,150)).source).toBe("none");
  });
  test("core and enrichment HTTP parameter validation preserves supported radii", async () => {
    for (const radius of ["1000","NaN","","-1"]) for (const handler of [handleArea,handleAreaEnrichment]) expect((await handler(new URL(`http://local/api/area?lat=30&lng=-95&radiusM=${radius}`))).status).toBe(400);
    for (const handler of [handleArea,handleAreaEnrichment]) expect((await handler(new URL("http://local/api/area?lat=90&lng=-95"))).status).toBe(400);
  });
});
