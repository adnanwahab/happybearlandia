// Server side of /world: fetch real buildings + places around a lat/lng from
// OpenStreetMap (Overpass API), simplify them, and cache per ~200 m cell.
// The client falls back to a procedural town if this fails or returns nothing.

export const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const DEFAULT_OVERPASS_TIMEOUT_MS = 8000;
const parsedOverpassTimeoutMs = Number(process.env.OVERPASS_TIMEOUT_MS);
export const OVERPASS_TIMEOUT_MS = Number.isFinite(parsedOverpassTimeoutMs) && parsedOverpassTimeoutMs >= 1000
  ? Math.floor(parsedOverpassTimeoutMs)
  : DEFAULT_OVERPASS_TIMEOUT_MS;
const cache = new Map(); // key -> { at, body }
const TTL_MS = 1000 * 60 * 60 * 24;
const MAX_BUILDINGS = 1200;

function errorText(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return String(err); }
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

export async function getArea(lat, lng, radiusM = 400) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusM}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body;

  const [s, w, n, e] = bbox(lat, lng, radiusM);
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

  let res;
  try {
    res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`Overpass fetch failed: ${errorText(err)}`);
  }
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();

  const buildings = [];
  const pois = [];
  const roads = [];
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

  const body = {
    source: "osm",
    origin: { lat, lng },
    radiusM,
    buildings: buildings.slice(0, MAX_BUILDINGS),
    roads: roads.slice(0, 3000),
    pois,
    attribution: "© OpenStreetMap contributors",
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
    // Client will build a procedural town instead.
    return Response.json({ source: "none", error: errorText(err) }, { status: 200 });
  }
}
