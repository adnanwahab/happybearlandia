/** Frozen proposal validation dependency for housing1.1.0 replay.
 * BUILDING CONTRACT v1: x/z/height in meters, rotation in radians; footprintSqFt
 * is converted with 0.09290304 m²/sqft. v1 buildings have square footprints.
 * createBuildingProposal is a draft factory, never an approval action.
 * Placement accepts proposal buildings, {polygon:[{x,z}]} or town-style rectangles
 * {x,z,width,depth,rotation}. District polygons use the same world coordinates.
 */
export const SQFT_TO_SQM = 0.09290304;
export const BUILDING_STATUSES = ["proposed", "approved", "permitting", "site_prep", "excavation", "foundation", "structure", "floors", "envelope", "interior", "complete", "occupied", "cancelled"];
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const number = (value) => typeof value === "number" && Number.isFinite(value);
const safeId = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);

export function createBuildingProposal(overrides = {}) {
  const id = typeof globalThis.crypto?.randomUUID === "function" ? `building_${globalThis.crypto.randomUUID()}` : `building_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const base = { schemaVersion: "building-proposal.v1", id, name: "Main Street Housing Tower",
    location: { districtId: "downtown", x: 142, z: -88, rotation: 0 },
    program: { residentialUnits: 310, affordableUnits: 90, retailSqFt: 18000, officeSqFt: 0, parkingSpaces: 120 },
    geometry: { floors: 24, footprintSqFt: 16500, heightMeters: 86 },
    finance: { estimatedCost: 84000000, publicSubsidy: 12000000 },
    construction: { permitMonths: 8, buildMonths: 30 }, status: "proposed" };
  return { ...base, ...overrides, location: { ...base.location, ...overrides.location }, program: { ...base.program, ...overrides.program },
    geometry: { ...base.geometry, ...overrides.geometry }, finance: { ...base.finance, ...overrides.finance }, construction: { ...base.construction, ...overrides.construction } };
}

export function validateBuildingProposal(value) {
  const errors = [];
  if (!object(value)) return { valid: false, values: null, errors: ["Building proposal must be an object."] };
  const fields = { location: ["districtId", "x", "z", "rotation"], program: ["residentialUnits", "affordableUnits", "retailSqFt", "officeSqFt", "parkingSpaces"],
    geometry: ["floors", "footprintSqFt", "heightMeters"], finance: ["estimatedCost", "publicSubsidy"], construction: ["permitMonths", "buildMonths"] };
  const allowed = new Set(["schemaVersion", "id", "name", "status", ...Object.keys(fields)]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`Unknown building field: ${key}`);
  if (value.schemaVersion !== "building-proposal.v1") errors.push("Building schemaVersion must be building-proposal.v1.");
  if (!safeId(value.id)) errors.push("Building id must be a safe 1–96 character identifier.");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 160) errors.push("Building name must contain 1–160 characters.");
  if (!BUILDING_STATUSES.includes(value.status)) errors.push("Invalid building status.");
  for (const [section, keys] of Object.entries(fields)) {
    if (!object(value[section])) { errors.push(`Building ${section} is required.`); continue; }
    for (const key of Object.keys(value[section])) if (!keys.includes(key)) errors.push(`Unknown building field: ${section}.${key}`);
  }
  const check = (section, key, min, max, integer = false) => {
    const item = value[section]?.[key];
    if (!number(item) || item < min || item > max || (integer && !Number.isInteger(item))) errors.push(`${section}.${key} must be ${integer ? "an integer" : "a finite number"} between ${min} and ${max}.`);
  };
  if (value.location?.districtId !== null && !safeId(value.location?.districtId)) errors.push("location.districtId must be a safe identifier or null.");
  check("location", "x", -100000, 100000); check("location", "z", -100000, 100000); check("location", "rotation", -Math.PI * 100, Math.PI * 100);
  check("program", "residentialUnits", 0, 10000, true); check("program", "affordableUnits", 0, 10000, true);
  check("program", "retailSqFt", 0, 10000000); check("program", "officeSqFt", 0, 10000000); check("program", "parkingSpaces", 0, 10000, true);
  check("geometry", "floors", 1, 100, true); check("geometry", "footprintSqFt", 100, 1000000); check("geometry", "heightMeters", 3, 500);
  check("finance", "estimatedCost", 1, 10000000000); check("finance", "publicSubsidy", 0, 10000000000);
  check("construction", "permitMonths", 0, 120, true); check("construction", "buildMonths", 6, 120, true);
  if (value.program?.affordableUnits > value.program?.residentialUnits) errors.push("Affordable units cannot exceed residential units.");
  if (value.finance?.publicSubsidy > value.finance?.estimatedCost) errors.push("Public subsidy cannot exceed total estimated cost.");
  if (number(value.geometry?.heightMeters) && number(value.geometry?.floors) && value.geometry.heightMeters < value.geometry.floors * 2.4) errors.push("Height must allow at least 2.4 meters per floor.");
  const program = value.program || {}, geometry = value.geometry || {};
  if (number(geometry.footprintSqFt) && number(geometry.floors)) {
    const usableSqFt = geometry.footprintSqFt * geometry.floors * 0.85;
    const requiredSqFt = (program.residentialUnits || 0) * 250 + (program.retailSqFt || 0) + (program.officeSqFt || 0);
    if (requiredSqFt > usableSqFt) errors.push("Program exceeds gross floor capacity (minimum 250 sqft/home plus commercial space, 85% usable floor area).");
  }
  if (!(program.residentialUnits > 0 || program.retailSqFt > 0 || program.officeSqFt > 0)) errors.push("Building must contain homes, retail, or offices.");
  const values = errors.length ? null : structuredClone(value);
  if (values) values.name = values.name.trim();
  return { valid: errors.length === 0, values, errors };
}

function rectangle(x, z, width, depth, rotation = 0) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
    const dx = sx * width / 2, dz = sz * depth / 2;
    return { x: x + dx * Math.cos(rotation) - dz * Math.sin(rotation), z: z + dx * Math.sin(rotation) + dz * Math.cos(rotation) };
  });
}
export function buildingFootprint(building) {
  const polygon = building?.polygon || building?.poly || building?.footprint?.polygon;
  if (Array.isArray(polygon)) return polygon.map((point) => Array.isArray(point) ? { x: point[0], z: point[1] } : { x: point.x, z: point.z ?? point.y });
  const location = building?.location || building?.position || building || {};
  const square = Math.sqrt((building?.geometry?.footprintSqFt || 0) * SQFT_TO_SQM);
  const width = square || building?.width || building?.size?.x;
  const depth = square || building?.depth || building?.size?.z || width;
  if (![location.x, location.z, width, depth].every(number) || width <= 0 || depth <= 0) return null;
  return rectangle(location.x, location.z, width, depth, location.rotation ?? building?.rotation ?? 0);
}
const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const onSegment = (a, b, p) => Math.abs(cross(a, b, p)) < 1e-8 && p.x >= Math.min(a.x, b.x) - 1e-8 && p.x <= Math.max(a.x, b.x) + 1e-8 && p.z >= Math.min(a.z, b.z) - 1e-8 && p.z <= Math.max(a.z, b.z) + 1e-8;
function intersect(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return ((abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0)) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    if (onSegment(a, b, point)) return true;
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}
function edges(polygon) { return polygon.map((point, i) => [point, polygon[(i + 1) % polygon.length]]); }
function validPolygon(polygon) { return Array.isArray(polygon) && polygon.length >= 3 && polygon.every((point) => number(point.x) && number(point.z)); }
export function validateBuildingPlacement(proposal, { buildings = [], districts = [], bounds } = {}) {
  const result = validateBuildingProposal(proposal);
  const errors = [...result.errors];
  const warnings = ["Geometric placement check only; zoning law, roads, utilities, and land ownership are not validated."];
  if (!result.valid) return { valid: false, errors, warnings };
  const footprint = buildingFootprint(proposal);
  if (bounds) {
    const minX = bounds.minX ?? bounds.min?.x, maxX = bounds.maxX ?? bounds.max?.x;
    const minZ = bounds.minZ ?? bounds.min?.z, maxZ = bounds.maxZ ?? bounds.max?.z;
    if (![minX, maxX, minZ, maxZ].every(number) || minX >= maxX || minZ >= maxZ) errors.push("World bounds must contain finite ordered minX/maxX/minZ/maxZ.");
    else if (footprint.some((point) => point.x < minX || point.x > maxX || point.z < minZ || point.z > maxZ)) errors.push("Building footprint extends outside world bounds.");
  }
  for (const building of buildings) {
    if (building?.id === proposal.id || building?.status === "cancelled") continue;
    const other = buildingFootprint(building);
    if (!validPolygon(other)) { warnings.push(`Existing building ${building?.id || "unknown"} has no usable footprint; placement against it could not be checked.`); continue; }
    if (edges(footprint).some(([a, b]) => edges(other).some(([c, d]) => intersect(a, b, c, d))) || inside(footprint[0], other) || inside(other[0], footprint)) errors.push(`Building overlaps existing building ${building.id || building.name || "footprint"}.`);
  }
  if (districts.length && proposal.location.districtId) {
    const district = districts.find((row) => row.id === proposal.location.districtId);
    if (!district) errors.push(`Unknown district ${proposal.location.districtId}.`);
    else {
      const polygon = buildingFootprint(district);
      if (!validPolygon(polygon)) errors.push("Selected district has no valid boundary polygon.");
      else {
        const contained = footprint.every((point) => inside(point, polygon));
        // Corners alone are insufficient for a concave district: inspect edge
        // midpoints and proper crossings with every boundary edge as well.
        const crossing = edges(footprint).some(([a, b]) => !inside({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, polygon)
          || edges(polygon).some(([c, d]) => cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8));
        if (!contained || crossing) errors.push("Building footprint extends outside selected district boundary.");
      }
    }
  } else if (!districts.length) warnings.push("No district boundaries supplied; parcel/district containment is unverified.");
  return { valid: errors.length === 0, errors, warnings };
}
