import { projector } from '../world/gen.js';

export const defaultWorldPath = '/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline';

export function flowerWorldLocation(value, origin) {
  const url = new URL(value, origin);
  if (!['http:', 'https:'].includes(url.protocol) ||
      (url.origin !== origin && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) ||
      !/^\/world\/?$/.test(url.pathname) || url.username || url.password) {
    throw new Error('Enter a HappyBearLandia World URL from this site or localhost.');
  }
  const coordinate = (key, fallback, limit) => {
    const raw = url.searchParams.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || Math.abs(value) > limit) {
      throw new Error('The World URL contains invalid coordinates.');
    }
    return value;
  };
  const lat = coordinate('lat', 29.7286, 90);
  const lng = coordinate('lng', -95.4746, 180);
  const radius = Number(url.searchParams.get('tileRadiusM'));
  if (url.searchParams.has('experiment')) throw new Error('Open the saved city in World and use a location URL with latitude and longitude.');
  return {
    lat, lng,
    radius: [150, 250, 400].includes(radius) ? radius : 400,
    path: '/world' + url.search,
  };
}

export function flowerCityLayout(area, location) {
  if (area?.source !== 'osm' || !Array.isArray(area.buildings)) return null;
  const project = projector(location);
  const points = rows => Array.isArray(rows) ? rows.slice(0, 300)
    .filter(pair => Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([lat, lng]) => project.toXZ(lat, lng)) : [];
  const buildings = [];
  const parks = [];
  for (const row of area.buildings.slice(0, 1000)) {
    const ring = points(row?.pts);
    if (ring.length < 3 || ring.some(([x, z]) => Math.hypot(x, z) > 650)) continue;
    const center = ring.reduce(([x, z], point) => [x + point[0] / ring.length, z + point[1] / ring.length], [0, 0]);
    if (row.park || row.kind === 'park') parks.push(ring);
    else buildings.push({ ring, center, height: Math.min(18, Math.max(5, (Number(row.levels) || 2) * 3.4)) });
  }
  buildings.sort((a, b) => Math.hypot(...a.center) - Math.hypot(...b.center));
  const visible = buildings.slice(0, 220);
  if (!visible.length) return null;
  const roofs = [];
  for (const building of visible) {
    if (Math.hypot(...building.center) > 135 ||
        roofs.some(roof => Math.hypot(roof.center[0] - building.center[0], roof.center[1] - building.center[1]) < 13)) continue;
    building.height = 18;
    roofs.push(building);
    if (roofs.length === 10) break;
  }
  const roads = Array.isArray(area.roads) ? area.roads.slice(0, 220)
    .map(row => points(row?.pts)).filter(line => line.length > 1) : [];
  return { buildings: visible, parks: parks.slice(0, 35), roofs, roads };
}
