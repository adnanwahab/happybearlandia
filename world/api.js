import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Server side of /world: fetch real buildings + places around a lat/lng from
// OpenStreetMap (Overpass API), simplify them, and cache per ~200 m cell.
// The client falls back to a procedural town if this fails or returns nothing.

// Public Overpass servers are busy and sometimes refuse requests, so try a few.
export const OVERPASS_ENDPOINTS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      "https://overpass-api.de/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter",
      "https://z.overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.openstreetmap.ru/api/interpreter",
      "https://overpass.nchc.org.tw/api/interpreter",
    ];
export const OVERPASS_URL = OVERPASS_ENDPOINTS[0];
const USER_AGENT = "HappyBearLandia/0.1 (+https://happybearlandia.fly.dev)";

const DEFAULT_OVERPASS_TIMEOUT_MS = 8000;
const parsedOverpassTimeoutMs = Number(process.env.OVERPASS_TIMEOUT_MS);
export const OVERPASS_TIMEOUT_MS = Number.isFinite(parsedOverpassTimeoutMs) && parsedOverpassTimeoutMs >= 1000
  ? Math.floor(parsedOverpassTimeoutMs)
  : DEFAULT_OVERPASS_TIMEOUT_MS;

// Last-known-good OSM snapshots on disk. Commit the files for demo coordinates so a
// deploy still has real map data when every public Overpass server is down.
const SNAPSHOT_DIR = process.env.AREA_SNAPSHOT_DIR || join(import.meta.dir, "area-cache");
function snapshotPath(key) { return join(SNAPSHOT_DIR, key.replace(/[^0-9.,-]/g, "_") + ".json"); }
function readSnapshot(key) {
  try { const f = snapshotPath(key); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; } catch { return null; }
}
function writeSnapshot(key, body) {
  try { mkdirSync(SNAPSHOT_DIR, { recursive: true }); writeFileSync(snapshotPath(key), JSON.stringify(body)); } catch {}
}
const TTL_MS = 1000 * 60 * 60 * 24;
const MAX_BUILDINGS = 1200;

const NFHL_LAYER_URL = process.env.NFHL_LAYER_URL
  || "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query";
const NFHL_TIMEOUT_MS = Number.isFinite(Number(process.env.NFHL_TIMEOUT_MS))
  ? Math.max(1500, Math.min(12000, Number(process.env.NFHL_TIMEOUT_MS)))
  : 9000;

function errorText(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

function endpointLabel(endpoint) {
  try { return new URL(endpoint).host; } catch { return endpoint; }
}

function boundedTask(task, timeoutMs, parentSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", abort, { once: true });
  if (parentSignal?.aborted) abort();
  let timer;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = () => reject(controller.signal.reason || new Error("aborted")); controller.signal.addEventListener("abort", rejectAbort, { once: true }); if (controller.signal.aborted) rejectAbort(); });
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error("timed out"); controller.abort(error); reject(error); }, timeoutMs); });
  return Promise.race([Promise.resolve().then(() => task(controller.signal)), deadline, aborted])
    .finally(() => { clearTimeout(timer); parentSignal?.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", rejectAbort); });
}

async function overpass(endpoint, query, timeoutMs = OVERPASS_TIMEOUT_MS, fetchImpl = fetch, signal) {
  return boundedTask(async (requestSignal) => {
    const body = "data=" + encodeURIComponent(query);
    const common = { headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT, accept: "application/json" }, signal: requestSignal };
    let res = await fetchImpl(endpoint, { ...common, method: "POST", body });
    if ([406, 405, 415].includes(res.status)) res = await fetchImpl(endpoint + (endpoint.includes("?") ? "&" : "?") + body, { ...common, method: "GET" });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (!Array.isArray(json?.elements) || (json.remark && !json.elements.length)) throw new Error(json?.remark || "Invalid Overpass response");
    return json;
  }, timeoutMs, signal);
}

async function queryOverpass(query, timeoutMs = OVERPASS_TIMEOUT_MS, { fetchImpl = fetch, endpoints = OVERPASS_ENDPOINTS } = {}) {
  // Return the first valid mirror, rather than waiting for slow failed mirrors.
  // Abort losers to avoid wasting public service capacity. Every attempt has a
  // hard deadline even if an injected fetch ignores AbortSignal in a test.
  const controller = new AbortController();
  const attempts = endpoints.map((endpoint) => overpass(endpoint, query, timeoutMs, fetchImpl, controller.signal)
    .catch((error) => { throw new Error(`${endpointLabel(endpoint)} ${errorText(error)}`); }));
  try { return await Promise.any(attempts); }
  catch (error) {
    const errors = (error.errors || [error]).map(errorText);
    throw new Error(`Overpass failed: ${errors.join("; ")}`);
  } finally { controller.abort(); }
}

async function probeOverpass(endpoint) {
  const host = endpointLabel(endpoint);
  const t0 = Date.now();
  const timeout = Math.max(2000, Math.min(6000, OVERPASS_TIMEOUT_MS));
  const probeQuery = "[out:json][timeout:5];node(0,0,0,0);out 1;";
  const body = "data=" + encodeURIComponent(probeQuery);

  try {
    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(timeout),
    });

    if (res.status === 406 || res.status === 405 || res.status === 415) {
      const q = endpoint + (endpoint.includes("?") ? "&" : "?") + body;
      res = await fetch(q, {
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        signal: AbortSignal.timeout(timeout),
      });
    }

    return {
      endpoint,
      host,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t0,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    const reason = err?.name === "TimeoutError" ? "timed out" : errorText(err);
    return {
      endpoint,
      host,
      ok: false,
      status: null,
      ms: Date.now() - t0,
      error: reason,
    };
  }
}

function bbox(lat, lng, radiusM) {
  const dLat = radiusM / 110540;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng]; // s, w, n, e
}

function classify(tags = {}) {
  const b = tags.building;
  if (tags.amenity && /restaurant|cafe|fast_food|bar|pub|food_court/.test(tags.amenity)) return "food";
  if (tags.shop) return "shop";
  if (tags.amenity && /school|kindergarten|college|university/.test(tags.amenity)) return "school";
  if (b === "school") return "school";
  if (tags.leisure === "park" || tags.leisure === "playground") return "park";
  if (/^(house|residential|apartments|detached|semidetached_house|terrace|dormitory|bungalow)$/.test(b || "")) return "home";
  if (/^(commercial|office|industrial|retail|warehouse|hospital|civic|public)$/.test(b || "")) return "work";
  if (b === "supermarket") return "shop";
  return null; // unknown — the client decides from size
}

function isConnectivityFailure(text) {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("unable to connect")
    || t.includes("timed out")
    || t.includes("enotfound")
    || t.includes("econnreset")
    || t.includes("econnrefused")
    || t.includes("network")
  );
}

function mapFloodZone(zoneRaw) {
  const z = String(zoneRaw || "").trim().toUpperCase();
  if (z === "AE" || z === "A" || z === "VE") return z;
  if (z.includes("0.2") || z.includes("500") || z === "X500") return "X500";
  return "X";
}

async function queryNFHL(s, w, n, e, { fetchImpl = fetch, timeoutMs = NFHL_TIMEOUT_MS } = {}) {
  const url = new URL(NFHL_LAYER_URL);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("geometry", `${w},${s},${e},${n}`);
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "FLD_ZONE");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "json");

  const payload = await boundedTask(async (signal) => {
    const res = await fetchImpl(url, { method: "GET", headers: { accept: "application/json", "user-agent": USER_AGENT }, signal });
    if (!res.ok) throw new Error(`NFHL HTTP ${res.status}`);
    return res.json();
  }, timeoutMs);
  if (payload?.error) throw new Error(payload.error?.message || "NFHL query error");
  if (!Array.isArray(payload?.features) || payload.exceededTransferLimit) throw new Error("Incomplete NFHL response");

  const out = [];
  for (const f of payload?.features || []) {
    const fld = mapFloodZone(f?.attributes?.FLD_ZONE);
    const rings = Array.isArray(f?.geometry?.rings) ? f.geometry.rings : [];
    const polygons = rings
      .map((ring) => Array.isArray(ring)
        ? ring
          .map((p) => Array.isArray(p) && p.length >= 2 ? [Number(p[1]), Number(p[0])] : null)
          .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        : [])
      .filter((r) => r.length >= 3);
    if (!polygons.length) continue;
    out.push({ zone: fld, polygons });
  }
  return out;
}

/** Core/enrichment contract for the progressive map loader:
 * GET /api/area?lat=&lng=&radiusM=150|250|400&core=1 NEVER awaits FEMA.
 * Core retains source/origin/radiusM/buildings/roads/pois for tile bounds, and
 * exposes areaKey,bbox,enrichment:{url,key,status}, floodZonesStatus. Follow
 * enrichment.url AFTER first scene paint. GET /api/area/enrichment accepts the
 * same coordinate/radius parameters; response.areaKey must match the core.
 * Missing/stale flood polygons are explicit; no procedural data is fabricated.
 * Existing /api/area without core=1 and getArea() still await a merged response.
 */
export function createAreaService({ fetchImpl = fetch, now = Date.now, endpoints = OVERPASS_ENDPOINTS,
  overpassTimeoutMs = OVERPASS_TIMEOUT_MS, nfhlTimeoutMs = NFHL_TIMEOUT_MS,
  readSnapshot: read = readSnapshot, writeSnapshot: write = writeSnapshot,
  maxEntries = 48, maxInFlight = 6, coreTtlMs = TTL_MS, enrichmentTtlMs = TTL_MS,
  failureTtlMs = 30000, staleWhileRevalidate = true,
} = {}) {
  const coreCache = new Map(), enrichmentCache = new Map();
  const corePending = new Map(), enrichmentPending = new Map();
  const keyFor = (lat, lng, radiusM) => `${lat.toFixed(6)},${lng.toFixed(6)},${radiusM}`;
  const legacyKey = (lat, lng, radiusM) => `${lat.toFixed(3)},${lng.toFixed(3)},${radiusM}`;
  const bounds = (lat, lng, radiusM) => { const [s,w,n,e] = bbox(lat,lng,radiusM); return { s,w,n,e }; };
  function put(map, key, entry) { map.delete(key); map.set(key, entry); while (map.size > maxEntries) map.delete(map.keys().next().value); }
  const saved = (lat,lng,radiusM) => read(keyFor(lat,lng,radiusM)) || read(legacyKey(lat,lng,radiusM));
  const floodFields = (overlay) => ({ floodZones: overlay.floodZones || [], floodZonesSource: overlay.floodZonesSource, floodZonesStatus: overlay.floodZonesStatus, floodZonesError: overlay.floodZonesError || null, floodZonesFetchedAt: overlay.fetchedAt || null, floodZonesStale: overlay.floodZonesStatus === "stale" });
  function withEnrichment(core) {
    const { lat,lng } = core.origin;
    const key = keyFor(lat,lng,core.radiusM);
    const cached = enrichmentCache.get(key);
    const fresh = cached && now() - cached.at < cached.ttl;
    const overlay = fresh ? cached.body : { floodZones: [], floodZonesSource: "pending", floodZonesStatus: "pending", floodZonesError: null };
    const query = new URLSearchParams({ lat: String(lat), lng: String(lng), radiusM: String(core.radiusM) });
    return { ...core, ...floodFields(overlay), areaKey: key, bbox: bounds(lat,lng,core.radiusM), phase: "core", enrichment: { url: `/api/area/enrichment?${query}`, key, status: overlay.floodZonesStatus } };
  }
  function snapshotCore(snapshot, reason) {
    const origin = snapshot?.origin;
    if (snapshot?.source !== "osm" || !Number.isFinite(origin?.lat) || !Number.isFinite(origin?.lng) || ![150,250,400].includes(snapshot.radiusM) || !Array.isArray(snapshot.buildings)) return null;
    const { floodZones, floodZonesSource, floodZonesStatus, floodZonesError, enrichment, ...core } = snapshot;
    return { ...core, stale: true, staleReason: reason, cacheStatus: "snapshot", fetchedAt: snapshot.fetchedAt || null };
  }
  async function fetchCore(lat,lng,radiusM) {
    let json = null, usedRadius = radiusM;
    const tries = [], started = performance.now();
    const budget = Math.max(4500, Math.min(11000, overpassTimeoutMs + 1500));
    for (const radius of [...new Set([radiusM,250,150].filter((value) => value <= radiusM))]) {
      const remaining = budget - (performance.now() - started);
      if (remaining < 1) { tries.push(`${radius}m: request time budget exhausted`); break; }
      const {s,w,n,e} = bounds(lat,lng,radius);
      const region = `${s},${w},${n},${e}`;
      const query = `[out:json][timeout:25];(way["building"](${region});way["leisure"~"^(park|playground)$"](${region});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](${region});node["shop"](${region});node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|school)$"](${region}););out tags geom;`;
      try { json = await queryOverpass(query, Math.max(1,Math.min(overpassTimeoutMs,remaining)), { fetchImpl,endpoints }); usedRadius = radius; break; }
      catch (error) { const message = errorText(error); tries.push(`${radius}m: ${message}`); if (isConnectivityFailure(message)) break; }
    }
    const buildings = [], roads = [], pois = [];
    for (const element of json?.elements || []) {
      if (element.type === "way" && element.tags?.highway && element.geometry?.length >= 2) roads.push({kind:element.tags.highway,pts:element.geometry.map((point)=>[point.lat,point.lon])});
      else if (element.type === "way" && element.geometry?.length >= 4) buildings.push({ id:`w${element.id}`,kind:classify(element.tags),levels:Number(element.tags?.["building:levels"])||null,name:element.tags?.name||null,pts:element.geometry.map((point)=>[point.lat,point.lon]),park:["park","playground"].includes(element.tags?.leisure) });
      else if (element.type === "node") pois.push({kind:classify(element.tags),name:element.tags?.name||null,lat:element.lat,lng:element.lon});
    }
    const key = keyFor(lat,lng,radiusM);
    let body = { source:json?"osm":"none",origin:{lat,lng},radiusM:usedRadius,buildings:buildings.slice(0,MAX_BUILDINGS),roads:roads.slice(0,3000),pois:pois.slice(0,3000),attribution:json?"© OpenStreetMap contributors":null,error:json?null:`Overpass failed (${tries.join(" | ")})`,cacheStatus:"miss",stale:false,fetchedAt:json?new Date(now()).toISOString():null };
    if (json) { put(coreCache,key,{at:now(),ttl:coreTtlMs,body}); write(key,body); }
    else { body = snapshotCore(saved(lat,lng,radiusM),body.error) || body; put(coreCache,key,{at:now(),ttl:Math.min(failureTtlMs,2000),body}); }
    return body;
  }
  function refresh(lat,lng,radiusM) {
    const key = keyFor(lat,lng,radiusM);
    if (corePending.has(key)) return corePending.get(key);
    if (corePending.size >= maxInFlight) return Promise.resolve({source:"none",origin:{lat,lng},radiusM,buildings:[],roads:[],pois:[],error:"Core map request capacity reached; retry shortly.",cacheStatus:"busy",stale:false});
    const task = fetchCore(lat,lng,radiusM).finally(()=>corePending.delete(key)); corePending.set(key,task); return task;
  }
  async function getCore(lat,lng,radiusM=400) {
    const key = keyFor(lat,lng,radiusM), hit = coreCache.get(key);
    if (hit && now()-hit.at < hit.ttl) return withEnrichment({...hit.body,cacheStatus:hit.body.stale?"stale":"hit",cacheAgeMs:now()-hit.at});
    const snapshot = staleWhileRevalidate ? snapshotCore(saved(lat,lng,radiusM),"Saved OSM geometry; refreshing in the background.") : null;
    if (snapshot) { void refresh(lat,lng,radiusM).catch(()=>{}); return withEnrichment({...snapshot,refreshing:true}); }
    return withEnrichment(await refresh(lat,lng,radiusM));
  }
  async function getEnrichment(lat,lng,radiusM=400) {
    const key = keyFor(lat,lng,radiusM), hit = enrichmentCache.get(key);
    if (hit && now()-hit.at < hit.ttl) return {...hit.body,cacheStatus:"hit",cacheAgeMs:now()-hit.at};
    if (enrichmentPending.has(key)) return enrichmentPending.get(key);
    if (enrichmentPending.size >= maxInFlight) return {source:"area-enrichment",areaKey:key,origin:{lat,lng},radiusM,bbox:bounds(lat,lng,radiusM),floodZones:[],floodZonesSource:"unavailable",floodZonesStatus:"error",floodZonesError:"Enrichment request capacity reached; retry shortly.",retryAfterMs:1000};
    const task = (async()=>{
      const region = bounds(lat,lng,radiusM);
      let body;
      try {
        const floodZones = await queryNFHL(region.s,region.w,region.n,region.e,{fetchImpl,timeoutMs:nfhlTimeoutMs});
        body = {source:"area-enrichment",areaKey:key,origin:{lat,lng},radiusM,bbox:region,floodZones,floodZonesSource:"fema-nfhl",floodZonesStatus:"ready",floodZonesError:null,fetchedAt:new Date(now()).toISOString(),cacheStatus:"miss"};
        put(enrichmentCache,key,{at:now(),ttl:enrichmentTtlMs,body});
        for (const [coreKey,core] of coreCache) if (keyFor(core.body.origin.lat,core.body.origin.lng,core.body.radiusM)===key && core.body.source==="osm") write(coreKey,{...core.body,floodZones,floodZonesSource:"fema-nfhl",floodZonesFetchedAt:body.fetchedAt});
      } catch(error) {
        const snapshot = saved(lat,lng,radiusM);
        const prior = hit?.body?.floodZonesSource==="fema-nfhl" ? hit.body : snapshot?.floodZonesSource==="fema-nfhl" && snapshot.floodZones?.length ? snapshot : null;
        body = {source:"area-enrichment",areaKey:key,origin:{lat,lng},radiusM,bbox:region,floodZones:prior?.floodZones||[],floodZonesSource:prior?"fema-nfhl":"unavailable",floodZonesStatus:prior?"stale":"error",floodZonesError:errorText(error),stale:Boolean(prior),fetchedAt:prior?.floodZonesFetchedAt||prior?.fetchedAt||null,cacheStatus:"miss",retryAfterMs:failureTtlMs};
        put(enrichmentCache,key,{at:now(),ttl:failureTtlMs,body});
      }
      return body;
    })().finally(()=>enrichmentPending.delete(key)); enrichmentPending.set(key,task); return task;
  }
  async function getArea(lat,lng,radiusM=400,{core=false}={}) {
    const geometry = await getCore(lat,lng,radiusM);
    if (core) return geometry;
    const overlay = await getEnrichment(geometry.origin.lat,geometry.origin.lng,geometry.radiusM);
    return {...geometry,...floodFields(overlay),floodZonesSource:overlay.floodZonesSource==="unavailable"?"fallback-lowland":overlay.floodZonesSource,phase:"complete",enrichment:{...geometry.enrichment,status:overlay.floodZonesStatus}};
  }
  return {getArea,getCore,getEnrichment,stats:()=>({coreEntries:coreCache.size,enrichmentEntries:enrichmentCache.size,corePending:corePending.size,enrichmentPending:enrichmentPending.size})};
}
const defaultAreaService = createAreaService();
export const getArea = (...args) => defaultAreaService.getArea(...args);
export const getAreaEnrichment = (...args) => defaultAreaService.getEnrichment(...args);
function areaRequest(url) {
  const rawLat=url.searchParams.get("lat"),rawLng=url.searchParams.get("lng");
  const lat=Number(rawLat),lng=Number(rawLng);
  if(!rawLat||!rawLng||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180) return {error:"Pass ?lat=&lng="};
  const rawRadius=url.searchParams.get("radiusM"),radiusM=rawRadius===null?400:Number(rawRadius);
  if(rawRadius!==null&&(!rawRadius.trim()||![150,250,400].includes(radiusM))) return {error:"radiusM must be 150, 250, or 400 meters."};
  return {lat,lng,radiusM};
}
export async function handleArea(url) {
  const request=areaRequest(url); if(request.error) return Response.json({error:request.error},{status:400});
  try { return Response.json(await defaultAreaService.getArea(request.lat,request.lng,request.radiusM,{core:url.searchParams.get("core")==="1"}),{headers:{"cache-control":"no-store"}}); }
  catch(error) { return Response.json({source:"none",error:errorText(error),floodZones:[],floodZonesSource:"unavailable",floodZonesStatus:"error",floodZonesError:errorText(error)},{headers:{"cache-control":"no-store"}}); }
}
export async function handleAreaEnrichment(url) {
  const request=areaRequest(url); if(request.error) return Response.json({error:request.error},{status:400});
  return Response.json(await defaultAreaService.getEnrichment(request.lat,request.lng,request.radiusM),{headers:{"cache-control":"no-store"}});
}

export async function handleOverpassHealth() {
  const results = await Promise.all(OVERPASS_ENDPOINTS.map((endpoint) => probeOverpass(endpoint)));
  const ok = results.filter((r) => r.ok).length;
  return Response.json({
    source: "overpass-health",
    generatedAt: new Date().toISOString(),
    timeoutMs: Math.max(2000, Math.min(6000, OVERPASS_TIMEOUT_MS)),
    endpoints: OVERPASS_ENDPOINTS,
    summary: { reachable: ok, total: results.length },
    results,
  });
}
