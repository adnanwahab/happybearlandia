/** mountMinimap(container,{town,camera,controls,THREE,bounds?,onPan?,onPanScreen?,loadedChunks?,throttleMs?})
 * -> {update({town?,bounds?}),requestDraw(),destroy()}.
 * One cached Canvas2D static layer; controls change events throttle only overlays.
 * North is -Z, matching the existing local tangent-plane world coordinates.
 * Panning translates camera+target together, preserving offset/zoom/orientation.
 */
import { clipGroundToFrustum, geographicTileBounds } from "./tile-navigation.js";

const finite = Number.isFinite;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const validBounds = bounds => bounds && [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(finite) && bounds.maxX > bounds.minX && bounds.maxZ > bounds.minZ;
export function loadedMinimapBounds(town = {}, bounds) {
  if (validBounds(bounds)) return { ...bounds };
  const roads = geographicTileBounds({}, town);
  if (validBounds(roads)) return roads;
  const points = (town.buildings || []).flatMap(building => building.poly || []).filter(point => Array.isArray(point) && point.length >= 2 && finite(point[0]) && finite(point[1]));
  if (!points.length) return null;
  const xs = points.map(point => point[0]), zs = points.map(point => point[1]);
  return { minX: Math.min(...xs) - 10, maxX: Math.max(...xs) + 10, minZ: Math.min(...zs) - 10, maxZ: Math.max(...zs) + 10, label: "Loaded footprint extent" };
}
/** Normalize streamer tiles: never count a requested/queued/failed tile as loaded.
 * Partial backend responses use actualBounds, not their larger requested square.
 */
export function minimapLoadedChunks(chunks = []) {
  return (Array.isArray(chunks) ? chunks : []).flatMap((chunk, index) => {
    if (!chunk || ["queued", "error", "disposed"].includes(chunk.status)) return [];
    let bounds;
    if (chunk.status === "resident") bounds = chunk.bounds;
    else if (chunk.status) { if (!["fetching", "building", "ready", "partial"].includes(chunk.status)) return []; bounds = chunk.actualBounds; }
    else bounds = chunk.actualBounds || chunk.bounds || chunk;
    return validBounds(bounds) ? [{ key: chunk.key || String(index), bounds: { ...bounds }, contextOnly: chunk.contextOnly === true, status: chunk.status || "loaded" }] : [];
  });
}
function chunkExtent(chunks, town, bounds) {
  if (!chunks.length) return loadedMinimapBounds(town, bounds);
  return { minX: Math.min(...chunks.map(chunk => chunk.bounds.minX)), maxX: Math.max(...chunks.map(chunk => chunk.bounds.maxX)), minZ: Math.min(...chunks.map(chunk => chunk.bounds.minZ)), maxZ: Math.max(...chunks.map(chunk => chunk.bounds.maxZ)), label: "Retained loaded map extent" };
}

export function minimapTransform(bounds, width = 232, height = 190, padding = 12) {
  if (!validBounds(bounds) || width <= padding * 2 || height <= padding * 2) return null;
  const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxZ - bounds.minZ));
  const left = (width - (bounds.maxX - bounds.minX) * scale) / 2, top = (height - (bounds.maxZ - bounds.minZ) * scale) / 2;
  return { scale, left, top, toMap(x, z) { return [left + (x - bounds.minX) * scale, top + (z - bounds.minZ) * scale]; }, toWorld(x, y) { return { x: clamp(bounds.minX + (x - left) / scale, bounds.minX, bounds.maxX), z: clamp(bounds.minZ + (y - top) / scale, bounds.minZ, bounds.maxZ) }; } };
}
export function panMinimapCamera(camera, controls, target) {
  if (!camera?.position || !controls?.target || !finite(target?.x) || !finite(target?.z)) return false;
  const dx = target.x - controls.target.x, dz = target.z - controls.target.z;
  camera.position.x += dx; camera.position.z += dz;
  controls.target.x = target.x; controls.target.z = target.z;
  controls.update?.(); return true;
}

export function mountMinimap(container, { town = {}, camera, controls, THREE, bounds: suppliedBounds, onPan, onPanScreen, loadedChunks = [], contextBuildings = [], contextRoads = [], viewLimited = false, throttleMs = 100 } = {}) {
  if (!container?.ownerDocument || !camera || !controls || !THREE) throw new TypeError("Minimap requires a DOM container, camera, controls and existing THREE namespace.");
  const doc = container.ownerDocument, win = doc.defaultView, root = doc.createElement("details"); root.className = "world-minimap"; root.dataset.testid = "world-minimap"; root.setAttribute("aria-label", "Neighborhood minimap");
  root.open = !win.matchMedia?.("(max-width: 600px)").matches;
  root.innerHTML = '<summary><span>Neighborhood map</span><span class="mm-north" aria-label="North is up">↑ N</span></summary><div class="mm-body"><canvas width="232" height="190" tabindex="0" role="application" aria-label="Loaded neighborhood map. Click or drag to pan. Arrow keys pan without changing zoom."></canvas><div class="mm-screen-pad" role="group" aria-label="Pan one current screen"><button type="button" data-mm-screen="north" aria-label="Pan north one current screen">↑</button><button type="button" data-mm-screen="west" aria-label="Pan west one current screen">←</button><span>One screen</span><button type="button" data-mm-screen="east" aria-label="Pan east one current screen">→</button><button type="button" data-mm-screen="south" aria-label="Pan south one current screen">↓</button></div><div class="mm-legend"><span class="mm-view-key"></span>Camera footprint <span class="mm-target-key"></span>View target</div><p data-mm-bounds></p><p data-mm-position aria-live="off"></p><div class="mm-actions"><button type="button" data-mm-center>Center loaded area</button></div><small data-mm-coverage>Click/drag to pan · arrows on map · north up</small></div>';
  const stylesheet = doc.createElement("link"); stylesheet.rel = "stylesheet"; stylesheet.href = new URL("./minimap.css", import.meta.url).href; root.append(stylesheet); container.append(root);
  const canvas = root.querySelector("canvas"), ctx = canvas.getContext("2d"), staticLayer = doc.createElement("canvas"), staticContext = staticLayer.getContext("2d");
  const width = 232, height = 190, matrix = new THREE.Matrix4(), frustum = new THREE.Frustum();
  let chunks = minimapLoadedChunks(loadedChunks), loaded = chunkExtent(chunks, town, suppliedBounds), transform = minimapTransform(loaded), staticDirty = true, timer = null, destroyed = false, lastDraw = -Infinity, pointer = null, pixelRatio = 1;
  const interval = clamp(Number(throttleMs) || 100, 32, 500);
  const format = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  function setupSize() {
    const ratio = Math.min(2, win.devicePixelRatio || 1);
    if (ratio === pixelRatio && canvas.width === width * ratio) return;
    pixelRatio = ratio; canvas.width = staticLayer.width = Math.round(width * ratio); canvas.height = staticLayer.height = Math.round(height * ratio); staticDirty = true;
  }
  const regions = () => chunks.length ? chunks : loaded ? [{ bounds: loaded, contextOnly: false }] : [];
  function clipRegions(context) {
    context.beginPath();
    for (const region of regions()) { const [x, y] = transform.toMap(region.bounds.minX, region.bounds.minZ), [right, bottom] = transform.toMap(region.bounds.maxX, region.bounds.maxZ); context.rect(x, y, right - x, bottom - y); }
    context.clip();
  }
  function staticPaint() {
    if (!staticContext) return;
    staticContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    staticContext.fillStyle = "#14262a"; staticContext.fillRect(0, 0, width, height);
    if (!transform || !loaded) return;
    staticContext.save();
    const [left, top] = transform.toMap(loaded.minX, loaded.minZ), [right, bottom] = transform.toMap(loaded.maxX, loaded.maxZ);
    clipRegions(staticContext);
    staticContext.fillStyle = "#1d3435"; staticContext.fillRect(left, top, right - left, bottom - top);
    staticContext.lineCap = "round"; staticContext.strokeStyle = "#77908d"; staticContext.lineWidth = Math.max(1, 7 * transform.scale);
    for (const road of [...(town.roads || []), ...contextRoads]) {
      const points = (road.pts || []).filter(point => point?.length >= 2 && finite(point[0]) && finite(point[1])); if (points.length < 2) continue;
      staticContext.beginPath(); points.forEach((point, index) => { const [x, y] = transform.toMap(point[0], point[1]); index ? staticContext.lineTo(x, y) : staticContext.moveTo(x, y); }); staticContext.stroke();
    }
    for (const building of [...(town.buildings || []), ...contextBuildings]) {
      const points = (building.poly || []).filter(point => point?.length >= 2 && finite(point[0]) && finite(point[1])); if (points.length < 3) continue;
      staticContext.fillStyle = building.kind === "park" ? "#477b57" : building.kind === "commercial" || building.kind === "shop" ? "#b99b68" : "#90aaa4";
      staticContext.beginPath(); points.forEach((point, index) => { const [x, y] = transform.toMap(point[0], point[1]); index ? staticContext.lineTo(x, y) : staticContext.moveTo(x, y); }); staticContext.closePath(); staticContext.fill();
    }
    staticContext.restore(); staticContext.strokeStyle = "#a5bab2"; staticContext.lineWidth = 1; staticContext.setLineDash([3, 3]); for (const region of regions()) { const [x, y] = transform.toMap(region.bounds.minX, region.bounds.minZ), [rx, by] = transform.toMap(region.bounds.maxX, region.bounds.maxZ); staticContext.strokeStyle = region.contextOnly ? "#7fadc9" : "#b4d9b8"; staticContext.strokeRect(x, y, rx - x, by - y); } staticContext.setLineDash([]);
    root.dataset.staticDraws = String(Number(root.dataset.staticDraws || 0) + 1); staticDirty = false;
  }
  function draw() {
    timer = null; if (destroyed || !root.open || !ctx) return;
    setupSize(); if (staticDirty || !staticLayer.width) { staticLayer.width = canvas.width; staticLayer.height = canvas.height; staticPaint(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(staticLayer, 0, 0); ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const position = root.querySelector("[data-mm-position]");
    if (loaded && transform) {
      camera.updateMatrixWorld?.(); matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem);
      const polygon = clipGroundToFrustum(loaded, frustum.planes.map(plane => ({ nx: plane.normal.x, nz: plane.normal.z, c: plane.constant })));
      if (polygon.length) {
        ctx.save(); clipRegions(ctx);
        ctx.beginPath(); polygon.forEach(([x, z], index) => { const point = transform.toMap(x, z); index ? ctx.lineTo(...point) : ctx.moveTo(...point); }); ctx.closePath(); ctx.fillStyle = "#7de3d737"; ctx.fill(); ctx.strokeStyle = "#89e7d9"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      }
      const target = controls.target, outside = !regions().some(region => target.x >= region.bounds.minX && target.x <= region.bounds.maxX && target.z >= region.bounds.minZ && target.z <= region.bounds.maxZ);
      const point = transform.toMap(clamp(target.x, loaded.minX, loaded.maxX), clamp(target.z, loaded.minZ, loaded.maxZ));
      const dx = camera.position.x - target.x, dz = camera.position.z - target.z, length = Math.hypot(dx, dz) || 1;
      ctx.beginPath(); ctx.moveTo(...point); ctx.lineTo(point[0] + dx / length * 12, point[1] + dz / length * 12); ctx.strokeStyle = "#ffd68b"; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(...point, 3.5, 0, Math.PI * 2); ctx.fillStyle = "#ffd68b"; ctx.fill(); ctx.strokeStyle = "#172c30"; ctx.lineWidth = 1; ctx.stroke();
      position.textContent = `Target E ${format(target.x)} m · N ${format(-target.z)} m${outside ? " · outside loaded area" : ""}`;
    } else position.textContent = "Loaded extent unavailable; navigation disabled.";
    root.querySelector("[data-mm-bounds]").textContent = loaded ? `Loaded ${format(loaded.maxX - loaded.minX)} × ${format(loaded.maxZ - loaded.minZ)} m` : "No loaded bounds";
    canvas.setAttribute("aria-disabled", String(!loaded)); root.querySelector("[data-mm-center]").disabled = !loaded;
    root.dataset.loadedChunks = String(regions().length);
    root.querySelector("[data-mm-coverage]").textContent = `${chunks.some(chunk => chunk.contextOnly) ? "Blue outlines: geometry-only map context. " : ""}${viewLimited ? "View exceeds retained map budget. " : ""}Click/drag to pan · north up`;
    lastDraw = win.performance.now(); root.dataset.draws = String(Number(root.dataset.draws || 0) + 1);
  }
  function requestDraw() { if (destroyed || timer !== null || !root.open) return; timer = win.setTimeout(draw, Math.max(0, interval - (win.performance.now() - lastDraw))); }
  function pan(x, z) { if (!loaded || !panMinimapCamera(camera, controls, { x, z })) return; onPan?.({ x, z, target: { x: controls.target.x, y: controls.target.y, z: controls.target.z } }); requestDraw(); }
  function panAt(event) { if (!transform) return; const rect = canvas.getBoundingClientRect(), point = transform.toWorld((event.clientX - rect.left) * width / rect.width, (event.clientY - rect.top) * height / rect.height); pan(point.x, point.z); }
  function down(event) { if (event.button !== 0 || !loaded) return; event.preventDefault(); event.stopPropagation(); pointer = event.pointerId; canvas.setPointerCapture?.(pointer); panAt(event); }
  function move(event) { if (pointer === event.pointerId) { event.preventDefault(); panAt(event); } }
  function up(event) { if (pointer !== event.pointerId) return; if (canvas.hasPointerCapture?.(pointer)) canvas.releasePointerCapture(pointer); pointer = null; }
  function key(event) {
    if (!loaded || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Home") { center(); return; }
    const step = Math.min(loaded.maxX - loaded.minX, loaded.maxZ - loaded.minZ) * (event.shiftKey ? 0.1 : 0.04);
    const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0, dz = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    pan(clamp(controls.target.x + dx, loaded.minX, loaded.maxX), clamp(controls.target.z + dz, loaded.minZ, loaded.maxZ));
  }
  function center() { if (loaded) pan((loaded.minX + loaded.maxX) / 2, (loaded.minZ + loaded.maxZ) / 2); }
  function screenPan(event) {
    const direction = event.target.closest("[data-mm-screen]")?.dataset.mmScreen;
    if (!direction || typeof onPanScreen !== "function") return;
    event.preventDefault(); event.stopPropagation();
    try { Promise.resolve(onPanScreen(direction)).then(requestDraw).catch(error => { root.querySelector("[data-mm-position]").textContent = `Pan unavailable: ${error.message}`; }); }
    catch (error) { root.querySelector("[data-mm-position]").textContent = `Pan unavailable: ${error.message}`; }
  }
  for (const button of root.querySelectorAll("[data-mm-screen]")) { button.disabled = typeof onPanScreen !== "function"; button.title = "Pan by the visible ground footprint at the current zoom"; }
  root.querySelector(".mm-screen-pad").addEventListener("click", screenPan);
  const resize = () => { staticDirty = true; requestDraw(); }, toggle = () => requestDraw();
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); canvas.addEventListener("keydown", key); root.addEventListener("toggle", toggle); root.querySelector("[data-mm-center]").addEventListener("click", center); controls.addEventListener("change", requestDraw); win.addEventListener("resize", resize); requestDraw();
  return { requestDraw, update(next = {}) { if (destroyed) return; if (next.town) { town = next.town; suppliedBounds = null; } if (Object.hasOwn(next, "bounds")) suppliedBounds = next.bounds; if (Array.isArray(next.contextBuildings)) contextBuildings = next.contextBuildings; if (Array.isArray(next.contextRoads)) contextRoads = next.contextRoads; if (Object.hasOwn(next, "loadedChunks")) chunks = minimapLoadedChunks(next.loadedChunks); if (Object.hasOwn(next, "viewLimited")) viewLimited = next.viewLimited; loaded = chunkExtent(chunks, town, suppliedBounds); transform = minimapTransform(loaded); staticDirty = true; requestDraw(); }, destroy() { if (destroyed) return; destroyed = true; if (timer !== null) win.clearTimeout(timer); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("keydown", key); root.removeEventListener("toggle", toggle); root.querySelector("[data-mm-center]").removeEventListener("click", center); root.querySelector(".mm-screen-pad").removeEventListener("click", screenPan); controls.removeEventListener("change", requestDraw); win.removeEventListener("resize", resize); root.remove(); } };
}
