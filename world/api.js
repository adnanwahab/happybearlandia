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

const cache = new Map(); // key -> { at, body }
const TTL_MS = 1000 * 60 * 60 * 24;
const MAX_BUILDINGS = 1200;

const NFHL_LAYER_URL = process.env.NFHL_LAYER_URL
  || "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query";
const NFHL_TIMEOUT_MS = Number.isFinite(Number(process.env.NFHL_TIMEOUT_MS))
  ? Math.max(1500, Number(process.env.NFHL_TIMEOUT_MS))
  : 9000;

function errorText(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

function endpointLabel(endpoint) {
  try { return new URL(endpoint).host; } catch { return endpoint; }
}

async function overpass(endpoint, query, timeoutMs = OVERPASS_TIMEOUT_MS) {
  const body = "data=" + encodeURIComponent(query);
  const common = {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  };

  // Try POST first (standard), then GET for networks that proxy/filter POST oddly.
  let res = await fetch(endpoint, { ...common, method: "POST", body });
  if (res.status === 406 || res.status === 405 || res.status === 415) {
    const q = endpoint + (endpoint.includes("?") ? "&" : "?") + body;
    res = await fetch(q, { ...common, method: "GET" });
  }
  if (!res.ok) throw new Error(String(res.status));
  return await res.json();
}

async function queryOverpass(query, timeoutMs = OVERPASS_TIMEOUT_MS) {
  const attempts = OVERPASS_ENDPOINTS.map((endpoint) => {
    const host = endpointLabel(endpoint);
    return overpass(endpoint, query, timeoutMs)
      .then((json) => ({ ok: true, json, host }))
      .catch((err) => {
        const reason = err?.name === "TimeoutError" ? "timed out" : errorText(err);
        return { ok: false, host, reason };
      });
  });

  const settled = await Promise.all(attempts);
  const winner = settled.find((s) => s.ok);
  if (winner) return winner.json;

  const errors = settled.map((s) => `${s.host} ${s.reason}`);
  const allTimeout = errors.length > 0 && errors.every((e) => /timed out/i.test(e));
  if (allTimeout) {
    throw new Error(`All Overpass endpoints timed out (possible network/proxy block). Tried: ${errors.join("; ")}`);
  }
  throw new Error(errors.join("; "));
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

async function queryNFHL(s, w, n, e) {
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

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(NFHL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`NFHL HTTP ${res.status}`);

  const payload = await res.json();
  if (payload?.error) throw new Error(payload.error?.message || "NFHL query error");

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

export async function getArea(lat, lng, radiusM = 400) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusM}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body;

  const radii = [...new Set([radiusM, 250, 150].filter((r) => Number.isFinite(r) && r > 40))];
  let json = null;
  let usedRadius = radiusM;
  let bboxUsed = null;
  const tries = [];
  const startedAt = Date.now();
  const AREA_REQUEST_BUDGET_MS = Math.max(4500, Math.min(11000, OVERPASS_TIMEOUT_MS + 1500));

  for (const r of radii) {
    const elapsed = Date.now() - startedAt;
    const remaining = AREA_REQUEST_BUDGET_MS - elapsed;
    if (remaining < 1000) {
      tries.push(`${r}m: skipped (request time budget exhausted)`);
      break;
    }

    const [s, w, n, e] = bbox(lat, lng, r);
    const b = `${s},${w},${n},${e}`;
    const query = `[out:json][timeout:25];
(
  way["building"](${b});
  way["leisure"~"^(park|playground)$"](${b});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](${b});
  node["shop"](${b});
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|school)$"](${b});
);
out tags geom;`;

    try {
      json = await queryOverpass(query, Math.max(1000, Math.min(OVERPASS_TIMEOUT_MS, remaining)));
      usedRadius = r;
      bboxUsed = { s, w, n, e };
      break;
    } catch (err) {
      const msg = errorText(err);
      tries.push(`${r}m: ${msg}`);
      if (isConnectivityFailure(msg)) break;
    }
  }

  const buildings = [];
  const pois = [];
  const roads = [];
  if (json) {
    for (const el of json.elements || []) {
    if (el.type === "way" && el.tags?.highway && el.geometry?.length >= 2) {
      roads.push({ kind: el.tags.highway, pts: el.geometry.map((g) => [g.lat, g.lon]) });
    } else if (el.type === "way" && el.geometry?.length >= 4) {
      buildings.push({
        id: `w${el.id}`,
        kind: classify(el.tags),
        levels: Number(el.tags?.["building:levels"]) || null,
        name: el.tags?.name || null,
        pts: el.geometry.map((g) => [g.lat, g.lon]),
        park: el.tags?.leisure === "park" || el.tags?.leisure === "playground",
      });
    } else if (el.type === "node") {
      pois.push({ kind: classify(el.tags), name: el.tags?.name || null, lat: el.lat, lng: el.lon });
    }
    }
  }

  let floodZones = [];
  let floodZonesSource = "fema-nfhl";
  let floodZonesError = null;
  if (bboxUsed) {
    try {
      floodZones = await queryNFHL(bboxUsed.s, bboxUsed.w, bboxUsed.n, bboxUsed.e);
    } catch (err) {
      floodZonesSource = "fallback-lowland";
      floodZonesError = errorText(err);
    }
  } else {
    floodZonesSource = "fallback-lowland";
    floodZonesError = `Overpass failed (${tries.join(" | ")})`;
  }

  const body = {
    source: json ? "osm" : "none",
    origin: { lat, lng },
    radiusM: usedRadius,
    buildings: buildings.slice(0, MAX_BUILDINGS),
    roads: roads.slice(0, 3000),
    pois,
    floodZones,
    floodZonesSource,
    floodZonesError,
    attribution: json ? "© OpenStreetMap contributors" : null,
    error: json ? null : `Overpass failed (${tries.join(" | ")})`,
  };
  cache.set(key, { at: Date.now(), body });
  return body;
}

export async function handleArea(url) {
  const rawLat = url.searchParams.get("lat"), rawLng = url.searchParams.get("lng");
  const lat = Number(rawLat), lng = Number(rawLng);
  if (!rawLat || !rawLng || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
    return Response.json({ error: "Pass ?lat=&lng=" }, { status: 400 });
  }
  try {
    return Response.json(await getArea(lat, lng));
  } catch (err) {
    console.warn(`[world] map data failed for ${lat},${lng}: ${errorText(err)}`);
    // Client will build a procedural town instead.
    return Response.json({ source: "none", error: errorText(err), floodZonesSource: "fallback-lowland", floodZonesError: errorText(err), floodZones: [] }, { status: 200 });
  }
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
