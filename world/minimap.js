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

export function resolveMinimapVisit(town, entry) {
  const records = entry?.kind === "building" ? town?.buildings : entry?.kind === "person" ? town?.people : null;
  const record = records?.find(item => String(item.id) === entry.id);
  if (!record) return null;
  const point = entry.kind === "building" ? {x:record.center?.[0],z:record.center?.[1]} : {x:record.x,z:record.z};
  return finite(point.x) && finite(point.z) ? point : null;
}
export function minimapContains(regions, point) {
  return Boolean(point && finite(point.x) && finite(point.z) && regions.some(({bounds:b}) => validBounds(b) && point.x >= b.minX && point.x <= b.maxX && point.z >= b.minZ && point.z <= b.maxZ));
}

export function mountMinimap(container, { town = {}, camera, controls, THREE, bounds: suppliedBounds, onPan, onPanScreen, loadedChunks = [], contextBuildings = [], contextRoads = [], viewLimited = false, throttleMs = 100, resolveVisit, onSelectParcel } = {}) {
  if (!container?.ownerDocument || !camera || !controls || !THREE) throw new TypeError("Minimap requires a DOM container, camera, controls and existing THREE namespace.");
  const doc = container.ownerDocument, win = doc.defaultView, root = doc.createElement("details"); root.className = "world-minimap"; root.dataset.testid = "world-minimap"; root.setAttribute("aria-label", "Neighborhood minimap");
  root.open = false;
  root.innerHTML = '<summary><span>Neighborhood map</span><span class="mm-north" aria-label="North is up">↑ N</span></summary><div class="mm-body"><canvas width="232" height="190" tabindex="0" role="application" aria-label="Loaded neighborhood map. Tap a parcel to inspect; drag or arrow keys to pan. Pinch or plus and minus to zoom."></canvas><div class="mm-screen-pad" role="group" aria-label="Pan one current screen"><button type="button" data-mm-screen="north" aria-label="Pan north one current screen">↑</button><button type="button" data-mm-screen="west" aria-label="Pan west one current screen">←</button><span>One screen</span><button type="button" data-mm-screen="east" aria-label="Pan east one current screen">→</button><button type="button" data-mm-screen="south" aria-label="Pan south one current screen">↓</button></div><div class="mm-legend"><span class="mm-view-key"></span>Camera footprint <span class="mm-target-key"></span>View target</div><p data-mm-bounds></p><p data-mm-position aria-live="off"></p><div class="mm-actions"><button type="button" data-mm-center>Center loaded area</button></div><small data-mm-coverage>Click/drag to pan · arrows on map · north up</small></div>';
  const stylesheet = doc.createElement("link"); stylesheet.rel = "stylesheet"; stylesheet.href = new URL("./minimap.css", import.meta.url).href; root.append(stylesheet); container.append(root);
  const canvas = root.querySelector("canvas"), ctx = canvas.getContext("2d"), staticLayer = doc.createElement("canvas"), staticContext = staticLayer.getContext("2d");
  const width = 232, height = 190, matrix = new THREE.Matrix4(), frustum = new THREE.Frustum();
  let chunks = minimapLoadedChunks(loadedChunks), loaded = chunkExtent(chunks, town, suppliedBounds), transform = minimapTransform(loaded), staticDirty = true, timer = null, destroyed = false, lastDraw = -Infinity, pointer = null, pixelRatio = 1;
  const trail = createMinimapTrail();
  const extras = doc.createElement("section");
  extras.innerHTML = '<button type="button" data-mm-hide>Hide map</button> <button type="button" data-mm-save>Bookmark view</button><p>Local to this scene · camera navigation only</p><strong>Bookmarks</strong><div data-mm-bookmarks></div><strong>Recently inspected</strong><div data-mm-recent></div><p data-mm-status role="status"></p>';
  root.querySelector(".mm-body").append(extras);
  function available(point) { return minimapContains(regions(), point); }
  function destination(entry) { return entry.kind === "camera" ? entry : resolveVisit?.(entry); }
  function renderTrail() {
    for (const [selector, entries] of [["[data-mm-bookmarks]",trail.bookmarks],["[data-mm-recent]",trail.recent]]) {
      const list = root.querySelector(selector);
      const signature = JSON.stringify(entries.map(entry => [entry, available(destination(entry))]));
      if (list.dataset.signature === signature) continue;
      const focused = list.contains(doc.activeElement) ? doc.activeElement?.dataset.trailKey : null;
      list.dataset.signature = signature; list.replaceChildren();
      if (!entries.length) { list.textContent = "None yet"; continue; }
      for (const entry of entries) {
        const button = doc.createElement("button"); button.type = "button"; button.textContent = entry.label;
        button.dataset.trailKey = `${entry.kind}:${entry.id ?? `${entry.x},${entry.z}`}`;
        button.disabled = !available(destination(entry));
        button.title = button.disabled ? "Destination unavailable in loaded scene" : "Move camera here; keep current selection";
        button.onclick = () => { const point = destination(entry); if (!available(point)) { renderTrail(); return; } pan(point.x, point.z); root.querySelector("[data-mm-status]").textContent = `Viewing ${entry.label}`; };
        list.append(button);
      }
      if (focused) {
        const button = [...list.querySelectorAll("button")].find(button => button.dataset.trailKey === focused && !button.disabled);
        (button || root.querySelector("summary")).focus();
      }
    }
  }
  const expand = doc.createElement("button"); expand.type = "button"; expand.textContent = "Expand map"; expand.setAttribute("aria-expanded", "false");
  root.querySelector(".mm-actions").append(expand);
  const parcels = doc.createElement("select"); parcels.setAttribute("aria-label", "Select loaded parcel");
  function parcelOptions() {
    const id = parcels.value;
    parcels.replaceChildren(new win.Option("Select a parcel…", ""), ...(town.buildings || []).filter(b=>b.id != null).map(b=>new win.Option(String(b.name || `Parcel ${b.id}`), String(b.id))));
    parcels.value = id;
    parcels.disabled = !ctx || !loaded || !onSelectParcel;
  }
  parcels.onchange = () => { if (parcels.value) { onSelectParcel?.(parcels.value); requestDraw(); } };
  root.querySelector(".mm-actions").append(parcels); parcelOptions();
  let expanded = false, animation = null;
  function overview(value) {
    animation?.cancel(); animation = null;
    const before = root.getBoundingClientRect();
    expanded = value; root.classList.toggle("mm-expanded", value);
    expand.textContent = value ? "Collapse map" : "Expand map";
    expand.setAttribute("aria-expanded", String(value));
    const after = root.getBoundingClientRect();
    // Animate only presentation; world coordinates and the shared camera never change.
    if (ctx && loaded && typeof root.animate === "function" && !win.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      animation = root.animate([{transformOrigin:"top left",transform:`translate(${before.left-after.left}px, ${before.top-after.top}px) scale(${before.width/after.width}, ${before.height/after.height})`},{transformOrigin:"top left",transform:"none"}], {duration:240,easing:"ease-out"});
    }
    requestDraw(); expand.focus();
  }
  expand.onclick = () => overview(!expanded);
  function hideMap() { if (expanded) overview(false); root.open = false; root.querySelector("summary").focus(); }
  function escape(event) { if (event.key === "Escape" && root.open) { event.preventDefault(); event.stopPropagation(); if (expanded) overview(false); else hideMap(); } }
  root.addEventListener("keydown", escape);
  root.querySelector("[data-mm-hide]").onclick = hideMap;
  root.querySelector("[data-mm-save]").onclick = () => { if (!available(controls.target)) return; trail.save(controls.target); renderTrail(); requestDraw(); root.querySelector("[data-mm-status]").textContent = "View bookmarked for this scene"; };
  const interval = clamp(Number(throttleMs) || 100, 32, 500);
  const format = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  function setupSize() {
    const ratio = Math.min(2, win.devicePixelRatio || 1) * Math.max(1, canvas.clientWidth / width);
    if (ratio === pixelRatio && canvas.width === Math.round(width * ratio)) return;
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
      for (const entry of [...trail.recent, ...trail.bookmarks]) {
        const point = destination(entry); if (!available(point)) continue;
        const mapped = transform.toMap(point.x, point.z);
        ctx.beginPath(); ctx.arc(...mapped, 3, 0, Math.PI * 2); ctx.fillStyle = entry.kind === "camera" ? "#edb2ff" : "#9be5ff"; ctx.fill();
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
    root.querySelector("[data-mm-coverage]").textContent = `${chunks.some(chunk => chunk.contextOnly) ? "Blue outlines: geometry-only map context. " : ""}${viewLimited ? "View exceeds retained map budget. " : ""}Tap parcel · drag/arrows to pan · pinch/+/- to zoom · north up`;
    root.querySelector("[data-mm-save]").disabled = !available(controls.target);
    lastDraw = win.performance.now(); root.dataset.draws = String(Number(root.dataset.draws || 0) + 1);
  }
  function requestDraw() { if (destroyed || timer !== null || !root.open) return; timer = win.setTimeout(draw, Math.max(0, interval - (win.performance.now() - lastDraw))); }
  function pan(x, z) { if (!loaded || !panMinimapCamera(camera, controls, { x, z })) return; onPan?.({ x, z, target: { x: controls.target.x, y: controls.target.y, z: controls.target.z } }); requestDraw(); }
  function panAt(event) { if (!transform) return; const rect = canvas.getBoundingClientRect(), point = transform.toWorld((event.clientX - rect.left) * width / rect.width, (event.clientY - rect.top) * height / rect.height); pan(point.x, point.z); }
  const pointers = new Map(); let gesture = null, tapped = null;
  function zoom(factor) {
    const distance = camera.position.distanceTo(controls.target);
    const next = clamp(distance * factor, Math.max(1, controls.minDistance || 1), controls.maxDistance || 100000);
    if (!finite(next) || !distance) return;
    camera.position.sub(controls.target).multiplyScalar(next / distance).add(controls.target);
    controls.update?.(); onPan?.({x:controls.target.x,z:controls.target.z}); requestDraw();
  }
  function down(event) {
    if (event.button !== 0 || !loaded || !ctx) return;
    event.preventDefault(); event.stopPropagation(); canvas.focus();
    pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
    canvas.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) { pointer = event.pointerId; tapped = {x:event.clientX,y:event.clientY}; }
    else { tapped = null; gesture = null; }
  }
  function move(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault(); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pointers.size >= 2) {
      const [a,b] = [...pointers.values()], distance = Math.hypot(a.x-b.x,a.y-b.y);
      if (gesture && distance > 0) zoom(gesture / distance);
      gesture = distance; return;
    }
    if (tapped && Math.hypot(event.clientX-tapped.x,event.clientY-tapped.y)>5) tapped = null;
    if (!tapped && pointer === event.pointerId) panAt(event);
  }
  function up(event) {
    if (!pointers.has(event.pointerId)) return;
    if (event.type !== "pointercancel" && tapped && pointers.size === 1) {
      const rect = canvas.getBoundingClientRect(), point = transform?.toWorld((event.clientX-rect.left)*width/rect.width,(event.clientY-rect.top)*height/rect.height);
      const parcel = point && available(point) && minimapParcelAt(town.buildings, point);
      if (parcel && onSelectParcel) { parcels.value = String(parcel.id); onSelectParcel(parcel.id); requestDraw(); } else panAt(event);
    }
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointers.delete(event.pointerId); tapped = null; gesture = null; pointer = null;
  }
  function key(event) {
    if (loaded && ctx && ["+", "=", "-"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); zoom(event.key === "-" ? 1.2 : 1/1.2); return; }
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
  const resize = () => { animation?.cancel(); staticDirty = true; requestDraw(); }, toggle = () => { if (root.open) renderTrail(); else if (expanded) overview(false); else if (root.contains(doc.activeElement) && doc.activeElement !== root.querySelector("summary")) root.querySelector("summary").focus(); requestDraw(); };
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); canvas.addEventListener("keydown", key); root.addEventListener("toggle", toggle); root.querySelector("[data-mm-center]").addEventListener("click", center); controls.addEventListener("change", requestDraw); win.addEventListener("resize", resize); requestDraw();
  return { requestDraw, visit(entry) { trail.visit(entry); renderTrail(); requestDraw(); }, update(next = {}) { if (destroyed) return; if (next.town) { town = next.town; suppliedBounds = null; } if (Object.hasOwn(next, "bounds")) suppliedBounds = next.bounds; if (Array.isArray(next.contextBuildings)) contextBuildings = next.contextBuildings; if (Array.isArray(next.contextRoads)) contextRoads = next.contextRoads; if (Object.hasOwn(next, "loadedChunks")) chunks = minimapLoadedChunks(next.loadedChunks); if (Object.hasOwn(next, "viewLimited")) viewLimited = next.viewLimited; loaded = chunkExtent(chunks, town, suppliedBounds); transform = minimapTransform(loaded); staticDirty = true; parcelOptions(); renderTrail(); requestDraw(); }, destroy() { if (destroyed) return; destroyed = true; animation?.cancel(); pointers.clear(); root.removeEventListener("keydown", escape); if (timer !== null) win.clearTimeout(timer); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("keydown", key); root.removeEventListener("toggle", toggle); root.querySelector("[data-mm-center]").removeEventListener("click", center); root.querySelector(".mm-screen-pad").removeEventListener("click", screenPan); controls.removeEventListener("change", requestDraw); win.removeEventListener("resize", resize); root.remove(); } };
}

/** Presentation-only, bounded page-session history. IDs retain their entity namespace. */
export function createMinimapTrail(limit = 6) {
  const recent = [], bookmarks = [];
  return { recent, bookmarks,
    visit(entry) {
      if (!entry || !["building", "person"].includes(entry.kind) || entry.id == null) return false;
      const id = String(entry.id), index = recent.findIndex(item => item.kind === entry.kind && item.id === id);
      if (index >= 0) recent.splice(index, 1);
      recent.unshift({kind:entry.kind,id,label:String(entry.label || `${entry.kind} ${id}`).slice(0,100)});
      recent.splice(limit); return true;
    },
    save(point) {
      if (!finite(point?.x) || !finite(point?.z)) return false;
      const index = bookmarks.findIndex(item => item.x === point.x && item.z === point.z);
      if (index >= 0) bookmarks.splice(index, 1);
      bookmarks.unshift({kind:"camera",x:point.x,z:point.z,label:`E ${Math.round(point.x)} · N ${Math.round(-point.z)}`});
      bookmarks.splice(limit); return true;
    }
  };
}

/** Hit-test only authoritative loaded parcels; context geometry has no entity adapter. */
export function minimapParcelAt(buildings = [], point) {
  if (!finite(point?.x) || !finite(point?.z)) return null;
  return [...buildings].reverse().find(building => {
    const poly = building.poly; if (building.id == null || !Array.isArray(poly) || poly.length < 3) return false;
    let inside = false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const [x,z]=poly[i], [px,pz]=poly[j];
      if ((z>point.z)!==(pz>point.z) && point.x<(px-x)*(point.z-z)/(pz-z)+x) inside=!inside;
    }
    return inside;
  }) || null;
}
