// Turns a lat/lng (+ optional real OSM buildings) into a deterministic synthetic town:
// buildings with roles, and households of made-up people. Same lat/lng → same town.
// Pure module: runs in the browser and in Node/Bun for tests.

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.range = (lo, hi) => lo + next() * (hi - lo);
  return next;
}

/** Local tangent-plane projection in metres. x = east, z = south (three.js style). */
export function projector(origin) {
  const kx = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  const kz = 110540;
  return {
    toXZ: (lat, lng) => [(lng - origin.lng) * kx, -(lat - origin.lat) * kz],
    toLatLng: (x, z) => [origin.lat - z / kz, origin.lng + x / kx],
  };
}

function polyArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(a / 2);
}
function centroid(pts) {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  return [x / pts.length, z / pts.length];
}

const FIRST = ["Maria", "James", "Aisha", "Wei", "Carlos", "Priya", "Jamal", "Sofia", "Diego", "Mei", "Omar", "Grace",
  "Luis", "Fatima", "Noah", "Ana", "Kofi", "Hana", "Mateo", "Zara", "Ethan", "Lina", "Tunde", "Rosa", "Sam", "Yuki",
  "Ivan", "Leila", "Ben", "Nia", "Raj", "Elena", "Kwame", "Chloe", "Ali", "Ines", "Theo", "Amara", "Jin", "Lucia"];
const LAST = ["Garcia", "Nguyen", "Smith", "Okafor", "Patel", "Kim", "Hernandez", "Johnson", "Ali", "Chen", "Lopez",
  "Williams", "Haddad", "Mensah", "Rossi", "Tanaka", "Silva", "Brown", "Khan", "Martinez", "Novak", "Diaz", "Wu", "Adeyemi"];

const KIND_HEIGHT = { home: 6, work: 14, food: 5, shop: 7, school: 9, park: 0.3 };

/** Procedural fallback when there's no real map data (offline, ocean, Overpass down). */
function proceduralBuildings(r) {
  const out = [];
  const block = 70, street = 16, n = 5;
  let id = 0;
  for (let bx = -n; bx < n; bx++) {
    for (let bz = -n; bz < n; bz++) {
      const x0 = bx * (block + street), z0 = bz * (block + street);
      if (r() < 0.08) { // a park block
        out.push({ id: `p${id++}`, kind: "park", poly: [[x0, z0], [x0 + block, z0], [x0 + block, z0 + block], [x0, z0 + block]] });
        continue;
      }
      const lots = 2 + r.int(3);
      const w = block / lots;
      for (let i = 0; i < lots; i++) for (let j = 0; j < 2; j++) {
        const x = x0 + i * w + 3, z = z0 + j * (block / 2) + 3;
        const bw = w - 6, bd = block / 2 - 6;
        out.push({ id: `p${id++}`, kind: null, poly: [[x, z], [x + bw, z], [x + bw, z + bd], [x, z + bd]] });
      }
    }
  }
  return out;
}

function proceduralRoads() {
  const roads = [], block = 70, street = 16, n = 5, ext = n * (block + street);
  for (let i = -n; i <= n; i++) {
    const c = i * (block + street) - street / 2;
    roads.push({ kind: "residential", pts: [[c, -ext], [c, ext]] });
    roads.push({ kind: "residential", pts: [[-ext, c], [ext, c]] });
  }
  return roads;
}

/**
 * Build the town.
 * @param area response from /api/area (may be {source:"none"})
 */
export function buildTown(origin, area, opts = {}) {
  const maxPeople = opts.maxPeople ?? 500;
  const seedKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`;
  const r = rng(hashSeed(seedKey));
  const proj = projector(origin);

  let raw;
  let source = "procedural";
  if (area?.source === "osm" && area.buildings?.length >= 15) {
    source = "osm";
    raw = area.buildings.map((b) => ({
      id: b.id, kind: b.kind, levels: b.levels, name: b.name,
      poly: b.pts.slice(0, -1).map(([la, ln]) => proj.toXZ(la, ln)),
    }));
  } else {
    raw = proceduralBuildings(r);
  }

  const buildings = raw
    .map((b) => {
      const area = polyArea(b.poly);
      return { ...b, area, center: centroid(b.poly) };
    })
    .filter((b) => b.area > 12 && b.area < 60000);

  // Attach POIs (shops/cafés that OSM stores as points) to the nearest building.
  for (const p of area?.pois || []) {
    if (!p.kind) continue;
    const [px, pz] = proj.toXZ(p.lat, p.lng);
    let best = null, bd = 35 * 35;
    for (const b of buildings) {
      const d = (b.center[0] - px) ** 2 + (b.center[1] - pz) ** 2;
      if (d < bd && b.kind !== "park") { bd = d; best = b; }
    }
    if (best) { best.kind = p.kind; best.name = best.name || p.name; }
  }

  // Unknown buildings: guess from footprint size, with a deterministic dice roll.
  for (const b of buildings) {
    if (b.kind) continue;
    const roll = r();
    if (b.area < 250) b.kind = roll < 0.9 ? "home" : "food";
    else if (b.area < 1500) b.kind = roll < 0.6 ? "home" : roll < 0.8 ? "work" : roll < 0.9 ? "shop" : "food";
    else b.kind = roll < 0.35 ? "home" : roll < 0.85 ? "work" : "shop";
  }

  // Make sure a town has the basics, so the needs loop always has somewhere to go.
  const ensure = (kind, count) => {
    let have = buildings.filter((b) => b.kind === kind).length;
    const candidates = buildings.filter((b) => b.kind === "home" && b.area > 80);
    while (have < count && candidates.length) {
      const b = candidates.splice(r.int(candidates.length), 1)[0];
      b.kind = kind;
      have++;
    }
  };
  ensure("food", 3); ensure("shop", 2); ensure("work", 4); ensure("school", 1);
  if (!buildings.some((b) => b.kind === "park")) {
    const [cx, cz] = [r.range(-150, 150), r.range(-150, 150)];
    buildings.push({ id: "park0", kind: "park", poly: [[cx, cz], [cx + 60, cz], [cx + 60, cz + 45], [cx, cz + 45]], area: 2700, center: [cx + 30, cz + 22] });
  }

  buildings.forEach((b, i) => {
    b.index = i;
    b.height = b.kind === "park" ? 0.3 : (b.levels ? b.levels * 3.2 : KIND_HEIGHT[b.kind] * r.range(0.7, 1.4));
    b.name = b.name || defaultName(b.kind, r);
    // Mutable world state lives on buildings (see sim.js).
    b.state = {
      open: true,
      stock: b.kind === "food" ? 60 : b.kind === "shop" ? 120 : 0,
      maxStock: b.kind === "food" ? 60 : b.kind === "shop" ? 120 : 0,
      fridge: b.kind === "home" ? 4 + r.int(6) : 0,
      cash: 0,
      visitors: 0,
      litter: 0,
    };
  });

  const people = makePeople(buildings, r, maxPeople);
  const roads = source === "osm"
    ? (area.roads || []).map((rd) => ({ kind: rd.kind, pts: rd.pts.map(([la, ln]) => proj.toXZ(la, ln)) }))
    : proceduralRoads();
  return { origin, source, seedKey, buildings, people, roads, attribution: source === "osm" ? area.attribution : null };
}

function defaultName(kind, r) {
  const n = r.pick(LAST);
  return {
    home: `${n} residence`, work: r.pick([`${n} & Co. offices`, `${n} Logistics`, `${n} Clinic`, `${n} Works`]),
    food: r.pick([`${n}'s Tacos`, `Café ${n}`, `${n} Noodle Bar`, `${n} Diner`]),
    shop: r.pick([`${n} Grocery`, `${n} Market`, `Corner Store`]),
    school: `${n} Elementary`, park: `${n} Park`,
  }[kind];
}

function makePeople(buildings, r, maxPeople) {
  const homes = buildings.filter((b) => b.kind === "home");
  const jobs = buildings.filter((b) => b.kind === "work" || b.kind === "shop" || b.kind === "food" || b.kind === "school");
  const schools = buildings.filter((b) => b.kind === "school");
  const people = [];

  // Households: bigger footprints hold more units (apartments).
  const slots = [];
  for (const h of homes) {
    const units = Math.max(1, Math.min(12, Math.round(h.area / 140)));
    for (let u = 0; u < units; u++) slots.push(h);
  }
  // Shuffle deterministically and fill up to maxPeople.
  for (let i = slots.length - 1; i > 0; i--) { const j = r.int(i + 1); [slots[i], slots[j]] = [slots[j], slots[i]]; }

  let hh = 0;
  for (const home of slots) {
    if (people.length >= maxPeople) break;
    const last = r.pick(LAST);
    const size = 1 + Math.min(4, Math.floor(-Math.log(1 - r()) * 1.3));
    const householdId = `h${hh++}`;
    for (let k = 0; k < size && people.length < maxPeople; k++) {
      const age = k < 2 ? 20 + r.int(55) : 4 + r.int(14);
      const child = age < 18;
      const worker = !child && age < 67 && r() < 0.75;
      const p = {
        id: people.length,
        name: `${r.pick(FIRST)} ${last}`,
        age, householdId,
        home: home.index,
        job: worker && jobs.length ? r.pick(jobs).index : null,
        school: child && schools.length ? r.pick(schools).index : null,
        shiftStart: worker ? 7 * 60 + r.int(150) : 8 * 60,    // minutes after midnight
        shiftLen: worker ? 6 * 60 + r.int(180) : 7 * 60,
        money: worker ? 80 + r.int(200) : child ? 5 : 40 + r.int(80),
        needs: { hunger: r.range(40, 90), energy: r.range(50, 95), fun: r.range(30, 90), social: r.range(30, 90) },
        trait: r.pick(["foodie", "homebody", "social butterfly", "workaholic", "outdoorsy", "saver"]),
        // runtime
        x: home.center[0] + r.range(-3, 3), z: home.center[1] + r.range(-3, 3),
        mode: "idle", action: null, target: null, until: 0, doing: "waking up",
      };
      people.push(p);
    }
  }
  return people;
}
