import { describe, expect, test } from "bun:test";
import { createMapStreamer } from "../world/render/map-streamer.js";
import { projector, buildTown } from "../world/gen.js";

const origin = { lat: 29.75, lng: -95.35 };
const initialArea = { source: "osm", origin, radiusM: 400, buildings: [{ id: "resident" }], attribution: "OSM" };
const delay = () => new Promise((resolve) => setTimeout(resolve, 1));
const waitFor = async (condition) => { for (let i = 0; i < 500 && !condition(); i++) await delay(); expect(condition()).toBe(true); };
const options = () => ({ origin, projector: projector(origin), initialArea, initialBuildingIds: ["resident"],
  schedulerOptions: { requestFrame: (callback) => setTimeout(callback, 0), cancelFrame: clearTimeout },
  attachBuilding: () => () => {} });
function response(tile, ids = ["shared"]) {
  return { source: "osm", origin: { lat: tile.lat, lng: tile.lng }, radiusM: tile.radiusM, attribution: "OSM",
    buildings: ids.map((id) => ({ id, levels: 3, pts: [[tile.lat, tile.lng], [tile.lat + 0.0001, tile.lng], [tile.lat, tile.lng + 0.0001], [tile.lat, tile.lng]] })), roads: [] };
}
describe("camera-driven bounded real-map context", () => {
  test("fetches neighboring cores with bounded concurrency and deduplicates boundary OSM IDs", async () => {
    let active = 0, peak = 0;
    const attached = [], loaded = [], disposed = [];
    const streamer = createMapStreamer({ ...options(), concurrency: 2,
      fetchArea: async (tile) => { active++; peak = Math.max(peak, active); await delay(); active--; return response(tile, ["resident", "shared"]); },
      loadBuilding: async (building) => { loaded.push(building.id); return { id: building.id }; },
      attachBuilding: (data, building, tile) => { attached.push({ data, building, tile }); return () => disposed.push(building.id); } });
    streamer.update({ x: 0, z: 0, halfWidth: 250, halfDepth: 250 });
    await waitFor(() => streamer.getState().tiles.filter((tile) => tile.status === "ready").length === 8);
    expect(peak).toBeLessThanOrEqual(2);
    expect(loaded).toEqual(["shared"]);
    expect(attached.length).toBe(1);
    expect(attached[0].building.contextOnly).toBe(true);
    expect(attached[0].building.poly.length).toBe(3);
    expect(streamer.getState().tileCount).toBe(9);
    expect(streamer.getMinimapData().buildings.map((building) => building.id)).toEqual(["shared"]);
    expect(streamer.getState().tiles.filter((tile) => tile.contextOnly === false).length).toBe(1);
    streamer.dispose();
    expect(disposed).toEqual(["shared"]);
  });
  test("pan aborts obsolete requests and starts replacements without reload or resident mutation", async () => {
    const pending = [], aborted = [];
    const original = structuredClone(initialArea);
    const streamer = createMapStreamer({ ...options(), maxTiles: 4,
      fetchArea: (tile, { signal }) => new Promise((resolve, reject) => {
        const task = { tile, resolve }; pending.push(task);
        signal.addEventListener("abort", () => { aborted.push(tile.key); reject(new Error("aborted")); }, { once: true });
      }), loadBuilding: () => ({}) });
    streamer.update({ x: 0, z: 0 }); await delay();
    expect(pending.length).toBe(2);
    streamer.update({ x: 5000, z: 0 }); await delay();
    expect(aborted.length).toBe(2);
    expect(pending.length).toBe(4);
    expect(streamer.getState().tileCount).toBeLessThanOrEqual(4);
    expect(initialArea).toEqual(original);
    streamer.dispose();
    expect(streamer.getState().status).toBe("disposed");
  });
  test("global geometry window bounds worker requests across all tile schedulers", async () => {
    let active = 0, peak = 0;
    const streamer = createMapStreamer({ ...options(), geometryConcurrency: 3,
      fetchArea: async (tile) => response(tile, Array.from({ length: 8 }, (_, index) => `${tile.key}-${index}`)),
      loadBuilding: async () => { active++; peak = Math.max(peak, active); await delay(); active--; return {}; } });
    streamer.update({ x: 0, z: 0 });
    await waitFor(() => streamer.getState().tiles.filter((tile) => tile.status === "ready").length === 8);
    expect(peak).toBeLessThanOrEqual(3);
    expect(streamer.getState().buildingCount).toBe(64);
    streamer.dispose();
  });
  test("eviction disposes only owned neighbor resources and keeps adjacent footprints aligned", async () => {
    let attached = 0, cleanups = 0, tileCleanups = 0;
    const streamer = createMapStreamer({ ...options(), maxTiles: 3,
      fetchArea: async (tile) => response(tile, [`${tile.key}-building`]), loadBuilding: () => ({}),
      attachTile: () => () => tileCleanups++, attachBuilding: () => { attached++; return () => cleanups++; } });
    streamer.update({ x: 0, z: 0 });
    await waitFor(() => streamer.getState().tiles.filter((tile) => tile.status === "ready").length === 2);
    const initial = streamer.getState().tiles.find((tile) => tile.key === "0:0").bounds;
    const neighbor = streamer.getState().tiles.find((tile) => tile.key !== "0:0").bounds;
    // Touching neighborhoods overlap slightly instead of leaving projection seams.
    expect(neighbor.maxX >= initial.minX && neighbor.minX <= initial.maxX && neighbor.maxZ >= initial.minZ && neighbor.minZ <= initial.maxZ).toBe(true);
    streamer.update({ x: 5000, z: 5000 });
    await waitFor(() => streamer.getState().tiles.filter((tile) => tile.status === "ready").length === 2);
    expect(cleanups).toBe(2); expect(tileCleanups).toBe(2);
    streamer.dispose();
    expect(cleanups).toBe(attached); expect(tileCleanups).toBe(4);
  });
  test("map errors remain explicit, retry is real, and smaller returned coverage stays partial", async () => {
    let fail = true;
    const streamer = createMapStreamer({ ...options(), maxTiles: 2,
      fetchArea: async (tile) => fail ? { source: "none", error: "Overpass unavailable" } : { ...response(tile), radiusM: 150 },
      loadBuilding: () => ({}) });
    streamer.update({ x: 0, z: 0 });
    await waitFor(() => streamer.getState().tiles.some((tile) => tile.status === "error"));
    expect(streamer.getState().buildingCount).toBe(0);
    fail = false; streamer.retry();
    await waitFor(() => streamer.getState().tiles.some((tile) => tile.status === "partial"));
    const partial = streamer.getState().tiles.find((tile) => tile.status === "partial");
    expect(partial.actualBounds.maxX - partial.actualBounds.minX).toBe(300);
    expect(partial.error).toContain("coverage is partial");
    streamer.update({ x: 0, z: 0, halfWidth: 5000, halfDepth: 5000 });
    expect(streamer.getState().viewLimited).toBe(true);
    streamer.dispose();
  });
  test("default fetch requests core data and original projector prevents per-tile coordinate resets", async () => {
    const urls = [];
    const streamer = createMapStreamer({ ...options(), maxTiles: 2, loadBuilding: () => ({}), fetchImpl: async (url) => {
      urls.push(url); const q = new URL(url, "http://localhost").searchParams;
      return { ok: true, json: async () => response({ lat: Number(q.get("lat")), lng: Number(q.get("lng")), radiusM: Number(q.get("radiusM")) }) };
    } });
    streamer.update({ x: 800, z: 0 });
    await waitFor(() => streamer.getState().tiles.some((tile) => tile.status === "ready"));
    expect(new URL(urls[0], "http://localhost").searchParams.get("core")).toBe("1");
    expect(streamer.getState().tiles.find((tile) => tile.status === "ready").bounds.minX).toBeGreaterThan(0);
    streamer.dispose();
  });
  test("minimap roads and buildings share world meters, and fitting excludes a distant resident tile", async () => {
    const streamer = createMapStreamer({ ...options(), maxTiles: 2, loadBuilding: () => ({}),
      fetchArea: async (tile) => ({ ...response(tile), roads: [{ pts: [[tile.lat, tile.lng], [tile.lat + 0.0001, tile.lng]] }] }) });
    streamer.update({ x: 5000, z: 0 });
    await waitFor(() => streamer.getState().tiles.some((tile) => tile.status === "ready"));
    const snapshot = streamer.getMinimapData();
    expect(snapshot.coordinates).toBe("world-meters");
    expect(snapshot.roads[0].pts[0][0]).toBeGreaterThan(4000);
    expect(snapshot.buildings[0].center[0]).toBeGreaterThan(4000);
    expect(streamer.getState().activeWindowBounds.minX).toBeGreaterThan(4000);
    streamer.dispose();
    expect(streamer.getMinimapData().roads).toEqual([]);
    expect(streamer.getMinimapData().buildings).toEqual([]);
  });
  test("look-at target wins over distant horizon/farclip bounds and its tile loads first", async () => {
    const order = [];
    const target = { x: 796, z: 0 };
    const streamer = createMapStreamer({ ...options(), maxTiles: 3, concurrency: 1,
      getTarget: () => target,
      fetchArea: async (tile) => { order.push(tile.key); return response(tile, [`${tile.key}-building`]); }, loadBuilding: () => ({}) });
    streamer.update({ x: 5000, z: 741, halfWidth: 10000, halfDepth: 20000 });
    await waitFor(() => streamer.getState().tiles.some((tile) => tile.status === "ready"));
    expect(order[0]).toBe("1:0");
    expect(streamer.getState().targetCoverage).toMatchObject({ x: 796, z: 0, covered: true, key: "1:0" });
    expect(streamer.getState().activeWindowBounds.maxX).toBeLessThan(2500);
    expect(streamer.getState().viewLimited).toBe(true);
    streamer.dispose();
  });
  test("shared building survives eviction of its first tile owner until final-owner cleanup", async () => {
    let cleanup = 0, attaches = 0;
    const tileDisposals = [];
    const streamer = createMapStreamer({ ...options(), maxTiles: 3,
      fetchArea: async (tile) => response(tile), loadBuilding: () => ({}),
      attachTile: (_, tile) => () => tileDisposals.push(tile.key),
      // Shared global building resource is independent of tile ground groups.
      attachBuilding: () => { attaches++; return () => cleanup++; } });
    streamer.update({ x: 0, z: 0 });
    await waitFor(() => streamer.getState().tiles.filter((tile) => tile.status === "ready").length === 2);
    expect(attaches).toBe(1);
    expect(streamer.getState().tiles.some((tile) => tile.key === "0:-1")).toBe(true);
    streamer.update({ x: 200, z: -700 });
    await waitFor(() => streamer.getState().tiles.filter((tile) => tile.status === "ready").length === 2);
    expect(tileDisposals).toContain("-1:0");
    expect(cleanup).toBe(0);
    expect(attaches).toBe(1);
    streamer.dispose();
    expect(cleanup).toBe(1);
  });
  test("explicit generated mode uses deterministic existing generator, no network, no neighbor residents", async () => {
    const rows = [], towns = [];
    const streamer = createMapStreamer({ ...options(), mode: "generated", tileRadiusM: 430, maxTiles: 2,
      fetchImpl: () => { throw new Error("Must not fetch in generated mode"); },
      buildGeneratedTile: (tile) => { const town = buildTown({ lat: tile.lat, lng: tile.lng }, { source: "none" }, { maxPeople: 0 }); towns.push(town); return town; },
      loadBuilding: (building) => building, attachBuilding: (_, building) => { rows.push(building); return () => {}; } });
    streamer.update({ x: 860, z: 0 });
    await waitFor(() => streamer.getState().tiles.some((tile) => tile.status === "ready"));
    expect(towns[0].people).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.id.startsWith("generated:") && row.generated && row.contextOnly)).toBe(true);
    expect(streamer.getState().mode).toBe("generated");
    expect(streamer.getState().tiles.find((tile) => tile.status === "ready").attribution).toContain("not real OSM");
    expect(streamer.getState().activeWindowBounds.maxX).toBeGreaterThan(800);
    streamer.dispose();
  });
});

test('stalled map releases its slot, retains resident baseline and ignores late response after retry', async () => {
  let late, first = true, aborted;
  const streamer = createMapStreamer({ ...options(), maxTiles: 2, requestTimeoutMs: 15,
    fetchArea: (tile, {signal}) => {
      if (!first) return Promise.resolve(response(tile));
      first = false; aborted = signal;
      return new Promise(resolve => { late = () => resolve(response(tile, ['obsolete'])); });
    }, loadBuilding: () => ({}) });
  streamer.update({x:0,z:0});
  await waitFor(() => streamer.getState().activeFetches === 0);
  expect(aborted.aborted).toBe(true);
  expect(streamer.getState().tiles.find(t => t.key === '0:0').status).toBe('resident');
  expect(streamer.getState().tiles.find(t => t.status === 'error').error).toContain('Continue');
  streamer.retry();
  await waitFor(() => streamer.getState().tiles.some(t => t.status === 'ready'));
  late(); await delay();
  expect(streamer.getMinimapData().buildings.map(b => b.id)).toEqual(['shared']);
  streamer.dispose();
});
