import { createProgressiveLoader } from "./progressive-loader.js";

/** Geometry-only OSM context streaming. Never calls buildTown or touches residents.
 * update({x,z,target?:{x,z},halfWidth?,halfDepth?}) each frame (or supply getView).
 * Prefer getTarget:()=>controls.target or explicit view.target; target ALWAYS
 * wins over the frustum bbox center. Full-frustum extents only inform warnings.
 * Coordinates
 * are the ORIGINAL town projector's meters. Neighbor query centers follow the
 * actual initial area.origin/radiusM, with a small overlap to avoid projection seams.
 * attachBuilding(data,building,tile) / fallbackBuilding(error,building,tile) return
 * cleanup functions (or {dispose()}); attachTile(area,tile) optionally owns roads,
 * ground and context labels. All returned resources dispose on last-owner eviction.
 * IMPORTANT shared building meshes must live in a separate global context group,
 * NEVER under a tile's ground/road group. A building can outlive its first tile;
 * tile resource cleanup must not recursively dispose shared building resources.
 * attachBuilding/fallbackBuilding must be synchronous; use loadBuilding for work.
 * tile.projector is the original projector; building.poly/center are already world
 * coordinates. area.roads remain geographic, so project with tile.projector.
 * Initial resident tile/building IDs are protected and never recreated/disposed.
 * A maximum of nine tile slots INCLUDING original is retained; over-wide views
 * explicitly report viewLimited. Unknown/failed/partial tiles are never invented.
 */
export function createMapStreamer(options = {}) {
  const { origin, projector, initialArea = {}, geometryCache, attachBuilding, fallbackBuilding, attachTile,
    onProgress, camera, getView, signal } = options;
  const generated = options.mode === "generated";
  if (generated && typeof options.buildGeneratedTile !== "function") throw new Error("Explicit generated streaming requires buildGeneratedTile(tile). No real-map fallback is inferred.");
  if (!Number.isFinite(origin?.lat) || !Number.isFinite(origin?.lng) || typeof projector?.toXZ !== "function" || typeof projector?.toLatLng !== "function" || typeof attachBuilding !== "function") throw new TypeError("Map streamer requires origin, projector and attachBuilding.");
  const radius = options.tileRadiusM ?? initialArea.radiusM;
  if (generated ? !Number.isFinite(radius) || radius <= 0 || radius > 2000 : ![150, 250, 400].includes(radius)) throw new Error("Map streaming requires a supported real-map radius, or an explicit bounded generated radius.");
  const maxTiles = Math.max(2, Math.min(9, Math.floor(options.maxTiles || 9)));
  const fetchConcurrency = Math.max(1, Math.min(3, Math.floor(options.concurrency || 2)));
  const geometryConcurrency = Math.max(2, Math.min(4, Math.floor(options.geometryConcurrency || 3)));
  const anchor = projector.toXZ((initialArea.origin || origin).lat, (initialArea.origin || origin).lng);
  const stride = radius * 2 - (generated ? 0 : 4);
  const pinnedIds = new Set(options.initialBuildingIds || (initialArea.buildings || []).map((building) => building.id));
  const tiles = new Map();
  const buildings = new Map();
  const geometryQueue = [];
  let activeFetches = 0, activeGeometry = 0, disposed = false, clock = 0, currentView = null, signature = "", limited = false;
  let desired = new Set(["0:0"]);
  let activeWindowBounds = null;
  let focus = null;
  const safeCleanup = (resource) => { try { if (typeof resource === "function") resource(); else resource?.dispose?.(); } catch {} };
  const tileInfo = (ix, iz) => {
    const x = anchor[0] + ix * stride, z = anchor[1] + iz * stride;
    const [lat, lng] = projector.toLatLng(x, z);
    return { key: `${ix}:${iz}`, ix, iz, x, z, lat, lng, radiusM: radius, contextOnly: true, projector,
      bounds: { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius } };
  };
  const initial = { ...tileInfo(0, 0), contextOnly: false, status: "resident", owners: new Set(), used: ++clock };
  tiles.set(initial.key, initial);
  function getState() {
    const covered = focus && [...tiles.values()].find((tile) => {
      if (!["resident", "building", "ready", "partial"].includes(tile.status)) return false;
      const bounds = tile.actualBounds || (tile.key === "0:0" ? tile.bounds : null);
      return bounds && focus.x >= bounds.minX && focus.x <= bounds.maxX && focus.z >= bounds.minZ && focus.z <= bounds.maxZ;
    });
    return { status: disposed ? "disposed" : "active", mode: generated ? "generated" : "osm", contextOnly: true, residentTileKey: "0:0", activeFetches, activeGeometry,
      queuedGeometry: geometryQueue.length, tileCount: tiles.size, buildingCount: buildings.size, viewLimited: limited, activeWindowBounds,
      targetCoverage: focus ? { ...focus, covered: Boolean(covered), key: covered?.key || null, status: covered?.status || "unloaded" } : null,
      note: `${generated ? "Explicitly generated neighboring geometry" : "Neighboring real-map geometry"} is context only; original residents and simulation stock are unchanged.`,
      tiles: [...tiles.values()].map((tile) => ({ key: tile.key, status: tile.status, bounds: tile.bounds, actualBounds: tile.actualBounds,
        contextOnly: tile.contextOnly, error: tile.error || null, progress: tile.progress || null, attribution: tile.area?.attribution || initialArea.attribution || null })) };
  }
  const notify = () => { try { onProgress?.(getState()); } catch {} };
  function evict(tile) {
    if (!tile || tile.key === "0:0") return;
    tiles.delete(tile.key);
    tile.controller?.abort("Tile left the retained view");
    tile.loader?.dispose();
    safeCleanup(tile.resource);
    for (const id of tile.owners) {
      const record = buildings.get(id);
      record?.owners.delete(tile.key);
      if (record && !record.owners.size) { safeCleanup(record.resource); buildings.delete(id); }
    }
  }
  function pumpGeometry() {
    if (disposed) return;
    while (activeGeometry < geometryConcurrency && geometryQueue.length) {
      const record = geometryQueue.shift();
      if (!record.owners.size) { record.reject(new Error("Obsolete map geometry")); continue; }
      activeGeometry++;
      Promise.resolve().then(() => (options.loadBuilding || ((building) => geometryCache.building({ id: building.id, poly: building.poly, height: building.height, kind: building.kind })))(record.building))
        .then(record.resolve, record.reject).finally(() => { activeGeometry--; pumpGeometry(); notify(); });
    }
  }
  function loadRecord(record) {
    if (record.attached) return Promise.resolve(null);
    if (!record.promise) {
      record.promise = new Promise((resolve, reject) => { record.resolve = resolve; record.reject = reject; });
      geometryQueue.push(record); pumpGeometry();
    }
    return record.promise;
  }
  function projectBuilding(raw) {
    if (!raw?.id) return null;
    if (generated && Array.isArray(raw.poly) && raw.poly.length >= 3 && raw.poly.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) {
      const center = raw.poly.reduce((sum, [x, z]) => [sum[0] + x / raw.poly.length, sum[1] + z / raw.poly.length], [0, 0]);
      return { ...raw, center, kind: raw.kind || "home", height: raw.height || 9, contextOnly: true, generated: true };
    }
    if (!Array.isArray(raw.pts)) return null;
    const points = raw.pts.filter((point) => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite));
    if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
    if (points.length < 3) return null;
    const poly = points.map(([lat, lng]) => projector.toXZ(lat, lng));
    const center = poly.reduce((sum, [x, z]) => [sum[0] + x / poly.length, sum[1] + z / poly.length], [0, 0]);
    const kind = raw.kind || (raw.park ? "park" : "home");
    return { ...raw, poly, center, kind, contextOnly: true, height: kind === "park" ? 0.3 : Math.max(3, Math.min(500, Number(raw.height) || Number(raw.levels) * 3.2 || 9)) };
  }
  function actualBounds(area) {
    if (area.bbox && [area.bbox.s, area.bbox.w, area.bbox.n, area.bbox.e].every(Number.isFinite)) {
      const a = projector.toXZ(area.bbox.n, area.bbox.w), b = projector.toXZ(area.bbox.s, area.bbox.e);
      return { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]) };
    }
    const [x, z] = projector.toXZ(area.origin.lat, area.origin.lng), r = area.radiusM;
    return { minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r };
  }
  async function buildTile(tile, area) {
    tile.area = area; tile.actualBounds = actualBounds(area);
    tile.projectedRoads = (area.roads || []).map((road) => ({ ...road, contextOnly: true,
      pts: (road.pts || []).filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
        .map(([a, b]) => area.coordinates === "world" ? [a, b] : projector.toXZ(a, b)) }));
    const partial = area.radiusM < radius;
    if (partial) tile.error = `Only ${area.radiusM}m of requested ${radius}m map radius available; coverage is partial. Retry to fill it.`;
    tile.status = "building";
    // No synthetic fallback settlement: an empty real OSM tile stays empty.
    tile.resource = await attachTile?.(area, tile);
    if (disposed || tiles.get(tile.key) !== tile) { safeCleanup(tile.resource); tile.resource = null; return; }
    const records = [];
    for (const raw of area.buildings || []) {
      if (pinnedIds.has(raw.id)) continue;
      const building = projectBuilding(raw);
      if (!building) continue;
      let record = buildings.get(building.id);
      if (!record) { record = { id: building.id, building, owners: new Set(), attached: false, resource: null }; buildings.set(building.id, record); }
      if (!tile.owners.has(building.id)) records.push(record);
      record.owners.add(tile.key); tile.owners.add(building.id);
    }
    tile.loader = createProgressiveLoader({ ...options.schedulerOptions, items: records, concurrency: 2,
      priority: (record) => (record.building.center[0] - (focus?.x ?? tile.x)) ** 2 + (record.building.center[1] - (focus?.z ?? tile.z)) ** 2,
      load: (record) => loadRecord(record),
      attach: (data, record) => {
        if (disposed || !record.owners.has(tile.key) || record.attached) return;
        record.resource = attachBuilding(data, record.building, tile);
        if (typeof record.resource?.then === "function") throw new Error("attachBuilding must return synchronous cleanup; put async work in loadBuilding.");
        record.attached = true;
        record.promise = null; // Cache owns shared data; don't pin a second copy per attached record.
      },
      fallback: typeof fallbackBuilding === "function" ? (error, record) => {
        if (disposed || !record.owners.has(tile.key) || record.attached) return;
        record.resource = fallbackBuilding(error, record.building, tile);
        if (typeof record.resource?.then === "function") throw new Error("fallbackBuilding must return synchronous cleanup.");
        record.attached = true;
        record.promise = null;
      } : undefined,
      onProgress: (progress) => { tile.progress = progress; notify(); },
    });
    const progress = await tile.loader.start();
    if (disposed || tiles.get(tile.key) !== tile) return;
    tile.status = partial ? "partial" : progress.failed > progress.fallbacks ? "partial" : "ready";
    if (progress.failed > progress.fallbacks) tile.error = "Some map geometry could not be built; retry this tile.";
    notify();
  }
  const fetchArea = options.fetchArea || (async (tile, { signal }) => {
    const query = new URLSearchParams({ lat: String(tile.lat), lng: String(tile.lng), radiusM: String(tile.radiusM), core: "1" });
    const response = await (options.fetchImpl || fetch)(`/api/area?${query}`, { signal });
    if (!response.ok) throw new Error(`Map tile HTTP ${response.status}`);
    return response.json();
  });
  function generatedArea(tile) {
    // Callback uses existing buildTown(...,{maxPeople:0}) or equivalent explicit
    // deterministic generator. Its polygons/roads are tile-local unless it marks
    // coordinates:'world'. No resident arrays are retained or injected.
    return Promise.resolve(options.buildGeneratedTile(tile)).then((area) => {
      const world = area.coordinates === "world";
      const shift = ([x, z]) => world ? [x, z] : [x + tile.x, z + tile.z];
      return { source: "generated", generated: true, coordinates: "world", origin: { lat: tile.lat, lng: tile.lng }, radiusM: radius,
        attribution: "Deterministic generated map context · not real OSM", buildings: (area.buildings || []).map((building) => ({ ...building, id: `generated:${tile.key}:${building.id}`, poly: building.poly?.map(shift) })),
        roads: (area.roads || []).map((road) => ({ ...road, pts: road.pts?.map(shift) })) };
    });
  }
  function pumpFetches() {
    if (disposed) return;
    const queued = [...tiles.values()].filter((tile) => tile.status === "queued").sort((a, b) => a.distance - b.distance);
    while (activeFetches < fetchConcurrency && queued.length) {
      const tile = queued.shift();
      tile.status = "fetching"; tile.controller = new AbortController(); activeFetches++;
      Promise.resolve().then(() => generated ? generatedArea(tile) : fetchArea(tile, { signal: tile.controller.signal })).then(async (area) => {
        if (disposed || tiles.get(tile.key) !== tile || tile.controller.signal.aborted) return;
        if ((!generated && area?.source !== "osm") || (generated && area?.source !== "generated") || !Array.isArray(area.buildings) || !Number.isFinite(area.origin?.lat) || !Number.isFinite(area.origin?.lng) || !(area.radiusM > 0)) throw new Error(area?.error || "Real map unavailable; no procedural neighbor was generated.");
        // Release network slots before worker/mesh completion; geometry has its
        // own global bounded window shared across all retained tile loaders.
        void buildTile(tile, area).catch((error) => {
          if (disposed || tiles.get(tile.key) !== tile) return;
          tile.status = "error"; tile.error = error?.message || String(error); notify();
        });
      }).catch((error) => {
        if (disposed || tiles.get(tile.key) !== tile || tile.controller.signal.aborted) return;
        tile.status = "error"; tile.error = error?.message || String(error); notify();
      }).finally(() => { activeFetches--; pumpFetches(); notify(); });
    }
    notify();
  }
  function update(view = getView?.() || { x: camera?.position?.x ?? 0, z: camera?.position?.z ?? 0 }) {
    if (disposed) return;
    const target = options.getTarget?.() || view?.target;
    if (Number.isFinite(target?.x) && Number.isFinite(target?.z)) view = { ...view, x: target.x, z: target.z };
    if (!Number.isFinite(view?.x) || !Number.isFinite(view?.z)) return;
    focus = { x: view.x, z: view.z };
    currentView = { ...view };
    const ix = Math.round((view.x - anchor[0]) / stride), iz = Math.round((view.z - anchor[1]) / stride);
    const halfWidth = Math.max(0, view.halfWidth || 0), halfDepth = Math.max(0, view.halfDepth || 0);
    const candidates = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const tile = tileInfo(ix + dx, iz + dz);
      if (tile.key === "0:0") continue;
      const visible = tile.bounds.maxX >= view.x - halfWidth && tile.bounds.minX <= view.x + halfWidth && tile.bounds.maxZ >= view.z - halfDepth && tile.bounds.minZ <= view.z + halfDepth;
      tile.distance = (tile.x - view.x) ** 2 + (tile.z - view.z) ** 2;
      tile.visible = visible;
      candidates.push(tile);
    }
    candidates.sort((a, b) => Number(b.visible) - Number(a.visible) || a.distance - b.distance || a.key.localeCompare(b.key));
    limited = halfWidth > stride || halfDepth > stride || candidates.filter((tile) => tile.visible).length > maxTiles - 1;
    const wanted = candidates.slice(0, maxTiles - 1);
    const windowTiles = wanted.map((tile) => tile.bounds);
    if (Math.abs(ix) <= 1 && Math.abs(iz) <= 1) windowTiles.push(initial.bounds);
    activeWindowBounds = { minX: Math.min(...windowTiles.map((bounds) => bounds.minX)), maxX: Math.max(...windowTiles.map((bounds) => bounds.maxX)),
      minZ: Math.min(...windowTiles.map((bounds) => bounds.minZ)), maxZ: Math.max(...windowTiles.map((bounds) => bounds.maxZ)) };
    const next = ["0:0", ...wanted.map((tile) => tile.key)].sort().join("|");
    if (next === signature) return;
    signature = next; desired = new Set(["0:0", ...wanted.map((tile) => tile.key)]);
    for (const tile of tiles.values()) if (tile.key !== "0:0" && !desired.has(tile.key)) evict(tile);
    for (const info of wanted) {
      const existing = tiles.get(info.key);
      if (existing) { existing.used = ++clock; existing.distance = info.distance; existing.loader?.reprioritize(); }
      else if (Math.abs(info.lat) <= 85 && Math.abs(info.lng) <= 180) tiles.set(info.key, { ...info, status: "queued", owners: new Set(), used: ++clock });
    }
    pumpFetches();
  }
  function retry(key) {
    if (disposed) return;
    for (const tile of [...tiles.values()]) if (tile.key !== "0:0" && (!key || tile.key === key) && ["error", "partial"].includes(tile.status)) evict(tile);
    signature = ""; if (currentView) update(currentView);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener("abort", dispose);
    for (const tile of [...tiles.values()]) evict(tile);
    for (const record of geometryQueue.splice(0)) record.reject(new Error("Map streamer disposed"));
    try { options.disposeSource?.(); } catch {}
    notify();
  }
  /** Display-only world-meter context for minimap; no resident/buildTown mutation.
   * Snapshot arrays contain references to immutable geometry descriptors; callers
   * must not edit these. Roads were projected once when their tile arrived.
   */
  function getMinimapData() {
    const roads = [], roadIds = new Set();
    for (const tile of tiles.values()) for (const road of tile.projectedRoads || []) {
      const id = road.id || JSON.stringify(road.pts);
      if (roadIds.has(id)) continue;
      roadIds.add(id); roads.push(road);
    }
    return { coordinates: "world-meters", contextOnly: true,
      buildings: [...buildings.values()].filter((record) => record.attached && record.owners.size).map((record) => record.building), roads };
  }
  if (signal?.aborted) dispose(); else signal?.addEventListener("abort", dispose, { once: true });
  return { update, retry, dispose, getState, getMinimapData };
}
