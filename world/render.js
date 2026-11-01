import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildTown, projector } from "./gen.js";
import { createWorld, clock } from "./sim.js";
import { journalFor, WALK_COMPLAINT_MINUTES } from "./journal.js";
import { computeEffectsForYear, derivePolicyProfile } from "./policy.js";
import { wellbeing, wellbeingHex } from "./wellbeing.js";
import { replayStormStrengthLabel } from "./replay-label.js";

/* ---------------------------------------------------------------- */
/* Where are we?  /world?lat=29.7286&lng=-95.4746&people=500         */
/* ---------------------------------------------------------------- */
const params = new URLSearchParams(location.search);

function parseCoord(raw, fallback) {
  if (raw == null || String(raw).trim() === "") return fallback; // Number(null) is 0, which would land at 0,0
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const s = String(raw ?? "").trim();
  const m = s.match(/^-?\d+(?:\.\d+)?/);
  const p = m ? Number(m[0]) : NaN;
  return Number.isFinite(p) ? p : fallback;
}

const origin = {
  lat: parseCoord(params.get("lat"), 29.7286),
  lng: parseCoord(params.get("lng"), -95.4746),
};
const maxPeople = Math.min(3000, Number(params.get("people") ?? 500));
const $ = (id) => document.getElementById(id);
$("latlng").value = `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`;

function go(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const q = new URLSearchParams({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
  if (params.get("people")) q.set("people", params.get("people"));
  if (params.get("year")) q.set("year", params.get("year"));
  location.search = q.toString();
}
$("goto").onsubmit = (e) => {
  e.preventDefault();
  const [a, b] = $("latlng").value.split(/[ ,]+/).map(Number);
  go(a, b);
};
$("preset").onchange = (e) => { if (e.target.value) { const [a, b] = e.target.value.split(",").map(Number); go(a, b); } };
$("here").onclick = () => navigator.geolocation?.getCurrentPosition((p) => go(p.coords.latitude, p.coords.longitude));

/* ---------------------------------------------------------------- */
/* Load map data → synthetic town → world                            */
/* ---------------------------------------------------------------- */
// ?demo=1 pins the town: skip OpenStreetMap so the procedural town (and the story
// the demo tells) is identical on every machine, regardless of what Overpass returns.
const demoMode = params.get("demo") === "1";
let area = { source: "none" };
if (!demoMode) try {
  const res = await fetch(`/api/area?lat=${origin.lat}&lng=${origin.lng}`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    area = { source: "none", error: `area HTTP ${res.status}` };
  } else {
    area = await res.json();
  }
} catch (err) {
  area = { source: "none", error: `area request failed: ${String(err?.message || err)}` };
}

const town = buildTown(origin, area, { maxPeople });
const world = createWorld(town);
const isHarrisCountyTile = origin.lat >= 29.3 && origin.lat <= 30.25 && origin.lng >= -95.95 && origin.lng <= -94.9;
let measuredOutcomesLatest = {};
const geoProj = projector(origin);
const buildingsById = {};
for (const b of town.buildings) {
  buildingsById[b.index] = b;
  buildingsById[b.id] = b;
}
const floodSourceTxt = area.floodZonesSource === "fema-nfhl"
  ? `FEMA NFHL flood zones loaded (${(area.floodZones || []).length} polygons)`
  : `FEMA flood zones unavailable (${area.floodZonesError || "request failed"}); using local lowland fallback.`;

$("source").textContent = town.source === "osm"
  ? `${town.buildings.length} real buildings (${town.attribution}) · ${town.people.length} synthetic residents · ${floodSourceTxt}`
  : area.error
    ? `Couldn't load map data (${area.error}), so this is a procedural town · ${town.people.length} synthetic residents · ${floodSourceTxt}`
    : demoMode
      ? `Demo town (pinned procedural layout) · ${town.people.length} synthetic residents`
      : `No map data here, so this is a procedural town · ${town.people.length} synthetic residents · ${floodSourceTxt}`;
$("loading").remove();

async function loadMeasuredOutcomes() {
  if (!isHarrisCountyTile) return;
  try {
    const res = await fetch("/api/outcomes", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return;
    const payload = await res.json();
    const rows = Array.isArray(payload?.outcomes?.series) ? payload.outcomes.series : [];
    const latest = {};
    for (const r of rows) {
      const k = String(r?.needId || "");
      if (!k) continue;
      if (!latest[k] || Number(r.year) > Number(latest[k].year)) latest[k] = r;
    }
    measuredOutcomesLatest = latest;
  } catch {
    measuredOutcomesLatest = {};
  }
}

async function loadNetworkDiagnostics() {
  const el = $("netdiag");
  const warnEl = $("netwarn");
  const detailsEl = $("netdiagDetails");
  const errorsEl = $("netdiagErrors");
  if (!el) return;

  const setErrorList = (rows) => {
    if (!detailsEl || !errorsEl) return;
    if (!rows?.length) {
      detailsEl.hidden = true;
      errorsEl.textContent = "";
      return;
    }
    detailsEl.hidden = false;
    errorsEl.textContent = rows
      .map((r) => `• ${r.host || "(unknown host)"}: ${r.error || (r.status ? `HTTP ${r.status}` : "unknown error")} (${r.ms ?? "?"}ms)`)
      .join("\n");
  };

  try {
    const res = await fetch("/api/overpass-health", { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const health = await res.json();
    const reachable = health?.summary?.reachable ?? 0;
    const total = health?.summary?.total ?? 0;
    const results = Array.isArray(health?.results) ? health.results : [];
    const failures = results.filter((r) => !r.ok);
    const best = results.find((r) => r.ok);
    const bestTxt = best ? ` · best ${best.host} ${best.ms}ms` : "";

    el.innerHTML = `Network: Overpass ${reachable}/${total} reachable${bestTxt} · <a href="/api/overpass-health" target="_blank" rel="noopener">details</a>`;

    setErrorList(failures);

    if (warnEl) {
      const blocked = total > 0 && reachable === 0;
      warnEl.hidden = !blocked;
      if (blocked) {
        warnEl.textContent = "Network blocks Overpass; procedural fallback in use. Connect through a network/VPN that can reach Overpass or set OVERPASS_URL to a reachable interpreter.";
      }
    }
  } catch (err) {
    if (warnEl) {
      warnEl.hidden = false;
      warnEl.textContent = "Overpass health check unavailable; map data may be blocked and procedural fallback is in use.";
    }
    setErrorList([]);
    el.textContent = `Network: Overpass health unavailable (${String(err?.message || err)})`;
  }
}

loadNetworkDiagnostics();
loadMeasuredOutcomes();

/* ---------------------------------------------------------------- */
/* Scene                                                             */
/* ---------------------------------------------------------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
$("view").appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 5000);
camera.position.set(260, 320, 360);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.47;
controls.enableDamping = true;

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -500, right: 500, top: 500, bottom: -500, far: 1500 });
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ color: 0xe6e1d4 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Streets
{
  const pos = [];
  for (const rd of town.roads) for (let i = 1; i < rd.pts.length; i++) {
    const [a, b] = [rd.pts[i - 1], rd.pts[i]];
    pos.push(a[0], 0.15, a[1], b[0], 0.15, b[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9c968a })));
}

// Buildings
const KIND_COLOR = { home: 0xd9cbb4, work: 0x8fa6c4, food: 0xe0875a, shop: 0xc9a23a, school: 0x9b7fd1, park: 0x7fb26a };
const meshes = [];
for (const b of town.buildings) {
  const shape = new THREE.Shape(b.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: KIND_COLOR[b.kind], emissive: 0xffc46b, emissiveIntensity: 0 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = b.kind !== "park";
  m.receiveShadow = true;
  m.userData.b = b;
  b.mesh = m;
  meshes.push(m);
  scene.add(m);
}

// People: one instanced capsule mesh, hidden while indoors
const ACTION_COLOR = {
  walking: 0x2f6fd6, play_park: 0x3f9e4f, clean_park: 0x0f8f7a, eat_out: 0xd2552d, groceries: 0xb7871b,
  work: 0x4a5a78, study: 0x7a5ec2, sleep: 0x555555, eat_home: 0xb36b3b, relax_home: 0x8d6e63, idle: 0x999999,
};
const OUTDOOR = new Set(["play_park", "clean_park"]);
const capsule = new THREE.CapsuleGeometry(2.2, 4.2, 4, 8);
capsule.translate(0, 4.3, 0);
const people = new THREE.InstancedMesh(capsule, new THREE.MeshLambertMaterial(), town.people.length);
people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
people.castShadow = true;
scene.add(people);
const smooth = town.people.map((p) => ({ x: p.x, z: p.z }));
const tmp = new THREE.Object3D();
const color = new THREE.Color();

// Selection ring
const ring = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 32), new THREE.MeshBasicMaterial({ color: 0x2f6fd6, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
scene.add(ring);

/* ---------------------------------------------------------------- */
/* Interaction                                                       */
/* ---------------------------------------------------------------- */
let speed = 10; // game minutes per real second
let selected = null; // { type: "person"|"building"|"journal", id }
let follow = false;
let overlayMode = "none";
let cycleResult = null;     // last Run cycle result from cycle.worker.js
let cycleView = "withPlan"; // which scores the "cycle" overlay shows: before | noPlan | withPlan
let todayJournalPosts = [];
let journalPins = [];
const overlayEl = $("overlayMode");
const overlayLegendEl = $("overlayLegend");
if (overlayEl) overlayEl.onchange = (e) => { overlayMode = e.target.value || "none"; };
for (const btn of $("speeds").children) btn.onclick = () => {
  speed = Number(btn.dataset.s);
  for (const b of $("speeds").children) b.classList.toggle("on", b === btn);
};


const BASE_POLICY_PACKAGES = {
  none: {
    id: "none",
    label: "No package",
    source: "local",
    proposalIds: [],
    effects: { speedMult: 1, floodMitigation: 0, housingGrowth: 0, voucherMonthly: 0, parkCleanupBoost: 0, restockBoost: 0, hiringBoost: 0, groceryDelivery: 0 },
    unsupported: [],
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    source: "local",
    proposalIds: ["t_brt", "h_lots", "f_drainage", "s_311"],
    unsupported: [],
  },
  "minimal-change": {
    id: "minimal-change",
    label: "Minimal change",
    source: "local",
    proposalIds: ["t_bus", "s_311", "sb_filing"],
    unsupported: [],
  },
  "most-popular": {
    id: "most-popular",
    label: "Most popular",
    source: "local",
    proposalIds: ["t_brt", "h_vouchers", "f_drainage", "sb_payroll"],
    unsupported: [],
  },
};

let PLAN_PACKAGES = { ...BASE_POLICY_PACKAGES };
let PLAN_COMPARE_DIFF = {};
let BALANCED_SIM_NOTE = "";
let activePolicyId = "none";
let policyYear = Math.max(0, Math.min(10, Number(params.get("year") ?? 0) || 0));
const planYearEl = $("planYear");
const planYearNEl = $("planYearN");
if (planYearEl) planYearEl.value = String(policyYear);
if (planYearNEl) planYearNEl.textContent = `Year ${policyYear}`;

world.policy = {
  id: "none",
  label: "No package",
  source: "local",
  proposalIds: [],
  unsupported: [],
  floodedNow: 0,
  displaced: 0,
  speedMult: 1,
  floodMitigation: 0,
  housingGrowth: 0,
  voucherMonthly: 0,
  parkCleanupBoost: 0,
  restockBoost: 0,
  hiringBoost: 0,
};

function slug(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pkg";
}

function proposalIdFrom(item) {
  return item?.proposal?.id || item?.proposalId || item?.id || item?.proposal_id || null;
}

function packageRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.packages || payload?.results || payload?.items || payload?.data?.packages || payload?.data?.results || [];
}



function refreshPolicySelect(selected = "none") {
  const sel = $("policy");
  const options = Object.entries(PLAN_PACKAGES)
    .map(([id, p]) => `<option value="${id}">${p.label}</option>`)
    .join("");
  sel.innerHTML = options;
  sel.value = PLAN_PACKAGES[selected] ? selected : "none";
}

function applyPolicy(id, year = policyYear) {
  const k = PLAN_PACKAGES[id] ? id : "none";
  const p = PLAN_PACKAGES[k];
  const staged = computeEffectsForYear(p.proposalIds || [], year);

  world.policy = {
    ...world.policy,
    id: k,
    label: p.label,
    source: p.source,
    proposalIds: p.proposalIds || [],
    unsupported: staged.unsupported,
    speedMult: staged.effects.speedMult,
    floodMitigation: staged.effects.floodMitigation,
    housingGrowth: staged.effects.housingGrowth,
    voucherMonthly: staged.effects.voucherMonthly,
    parkCleanupBoost: staged.effects.parkCleanupBoost,
    restockBoost: staged.effects.restockBoost,
    hiringBoost: staged.effects.hiringBoost,
  };

  world.speedMult = staged.effects.speedMult;
  world.parkCleanupBoost = staged.effects.parkCleanupBoost;
  world.restockBoost = staged.effects.restockBoost;
  world.hiringBoost = staged.effects.hiringBoost;
  world.voucherMonthly = staged.effects.voucherMonthly;
  world.groceryDelivery = staged.effects.groceryDelivery;

  const src = p.source === "dear-congress" ? "dear-congress" : "local";
  const pendingTxt = staged.unsupported.length
    ? ` · not simulated yet: ${staged.unsupported.slice(0, 4).join(", ")}${staged.unsupported.length > 4 ? "…" : ""}`
    : "";

  const simNote = BALANCED_SIM_NOTE ? ` · ${BALANCED_SIM_NOTE}` : "";
  $("policyNote").textContent = `${p.label} · year ${year} · transit ×${staged.effects.speedMult.toFixed(2)} · flood mitigation ${Math.round(staged.effects.floodMitigation * 100)}% · housing growth ${Math.round(staged.effects.housingGrowth * 100)}% · vouchers $${staged.effects.voucherMonthly.toFixed(0)}/mo${staged.effects.groceryDelivery > 0 ? ` · grocery delivery ${Math.round(staged.effects.groceryDelivery * 100)}%` : ""} · source: ${src}${pendingTxt}${simNote}`;
}

async function loadPolicyPackages() {
  const explicit = params.get("plans");
  const q = new URLSearchParams({ lat: String(origin.lat), lng: String(origin.lng) }).toString();
  const syntheticOn = params.get("synthetic") !== "0";
  const attempts = [
    // Ask for compare view and then pick real or blended based on ?synthetic=0.
    { kind: "post", url: "/api/plan", body: JSON.stringify({ compare: true }) },
    ...(explicit ? [{ kind: "get", url: explicit }] : []),
    { kind: "get", url: `/api/dear-congress/packages?${q}` },
    { kind: "get", url: `/api/dear-congress/package-results?${q}` },
  ];

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, attempt.kind === "post"
        ? { method: "POST", headers: { "content-type": "application/json" }, body: attempt.body, signal: AbortSignal.timeout(8000) }
        : { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const payload = await res.json();

      const compared = payload && typeof payload === "object" && Array.isArray(payload.real) && Array.isArray(payload.blended);
      const rows = compared ? (syntheticOn ? payload.blended : payload.real) : packageRows(payload);
      if (!Array.isArray(rows) || !rows.length) continue;

      const next = { none: BASE_POLICY_PACKAGES.none };
      const compareDiffById = {};
      let n = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row?.name || row?.title || row?.label || row?.packageName || `Package ${i + 1}`;
        const id = slug(row?.id || row?.slug || name);
        const items = row?.items || row?.proposals || row?.package?.items || [];
        const proposalIds = Array.from(new Set(items.map(proposalIdFrom).filter(Boolean)));
        if (!proposalIds.length) continue;
        next[id] = { ...derivePolicyProfile(name, id, proposalIds, "dear-congress"), remoteId: String(row?.id ?? name) };
        if (compared) {
          const rawDiff = payload.diff?.[row?.id] || payload.diff?.[id] || payload.diff?.[name] || { addedBySimulated: [], removedBySimulated: [], moneyMovedB: 0 };
          compareDiffById[id] = rawDiff;
        }
        n++;
      }
      if (!n) continue;

      PLAN_PACKAGES = next;
      PLAN_COMPARE_DIFF = compareDiffById;
      const balancedId = Object.keys(next).find((k) => /balanced/i.test(next[k]?.label || ""));
      const d = balancedId ? PLAN_COMPARE_DIFF[balancedId] : null;
      if (d) {
        const add = (d.addedBySimulated || []).length;
        const rem = (d.removedBySimulated || []).length;
        const pending = Array.isArray(d.pending) ? d.pending : [];
        if (add || rem) {
          BALANCED_SIM_NOTE = `Simulated residents changed Balanced: +${add} −${rem}`;
        } else if (pending.length) {
          const p = pending[0];
          BALANCED_SIM_NOTE = `Simulated residents are pushing: +${p.id} (${p.streak} of ${p.needed} years)`;
        } else {
          BALANCED_SIM_NOTE = "Simulated residents changed Balanced: no change";
        }
      } else {
        BALANCED_SIM_NOTE = "";
      }
      refreshPolicySelect(activePolicyId);
      world.log(`Loaded ${n} plan packages from dear-congress`, "civic");
      return true;
    } catch {
      // try next endpoint
    }
  }

  world.log("Could not load synthesized plan packages; using local presets", "info");
  refreshPolicySelect(activePolicyId);
  return false;
}

function lowlandScore(b) {
  const [x, z] = b.center;
  const n = Math.sin(x * 0.0041 + z * 0.0057 + b.index * 0.77 + town.seedKey.length * 0.13) * 43758.5453;
  return n - Math.floor(n); // 0..1
}

function floodZoneBucket(zoneRaw) {
  const z = String(zoneRaw || "X").toUpperCase();
  if (z === "AE" || z === "A" || z === "VE") return 0;
  if (z === "X500") return 1;
  return 2;
}

function floodFractionNow() {
  return Math.max(0, Math.min(1, 0.24 - (world.policy?.floodMitigation || 0)));
}

function floodPriorityScore(b) {
  return floodZoneBucket(b.floodZone) + lowlandScore(b) / 10;
}

function selectFloodedIds(fraction) {
  const active = town.buildings.filter((b) => b.kind !== "park");
  const n = Math.max(0, Math.min(active.length, Math.round(active.length * Math.max(0, Math.min(1, fraction)))));
  const ranked = [...active].sort((a, b) => {
    const da = floodPriorityScore(a);
    const db = floodPriorityScore(b);
    if (da !== db) return da - db;
    return a.index - b.index;
  });
  return new Set(ranked.slice(0, n).map((b) => b.index));
}

function floodImpactNotes() {
  const pids = world.policy?.proposalIds || [];
  const out = [];
  if (pids.includes("f_drainage")) out.push(`f_drainage≈${Math.round((0.16 / 0.28) * 100)}%`);
  if (pids.includes("f_buyouts")) out.push(`f_buyouts≈${Math.round((0.12 / 0.28) * 100)}%`);
  return out.join(" · ");
}

function updateOverlayLegend() {
  if (!overlayLegendEl) return;
  if (overlayMode === "flood") {
    const fm = Math.round((world.policy?.floodMitigation || 0) * 100);
    const impacts = floodImpactNotes();
    const src = area.floodZonesSource === "fema-nfhl" ? "FEMA flood zones" : "lowland fallback";
    overlayLegendEl.textContent = `${src} · flood mitigation ${fm}%${impacts ? ` · impact shares ${impacts}` : ""}`;
  } else if (overlayMode === "commute") {
    overlayLegendEl.textContent = `home color = avg walk minutes (threshold ${WALK_COMPLAINT_MINUTES}m)`;
  } else if (overlayMode === "journals") {
    overlayLegendEl.textContent = `${todayJournalPosts.length} journal pin${todayJournalPosts.length === 1 ? "" : "s"} today`;
  } else if (overlayMode === "wellbeing") {
    overlayLegendEl.textContent = "residents: red = struggling → green = doing well (live)";
  } else if (overlayMode === "cycle") {
    const label = { before: "before the plan", noPlan: "a week later, no plan", withPlan: "a week later, with plan" }[cycleView];
    overlayLegendEl.textContent = cycleResult ? `residents colored by well-being ${label}` : "run a cycle first";
  } else {
    overlayLegendEl.textContent = "";
  }
}

function clearJournalPins() {
  for (const p of journalPins) scene.remove(p.mesh);
  journalPins = [];
}

function rebuildJournalPins() {
  clearJournalPins();
  for (let i = 0; i < todayJournalPosts.length; i++) {
    const j = todayJournalPosts[i];
    const b = town.buildings[j.home];
    if (!b) continue;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), new THREE.MeshBasicMaterial({ color: 0xb5523b }));
    mesh.position.set(b.center[0], b.height + 2, b.center[1]);
    mesh.userData = { journalIndex: i };
    scene.add(mesh);
    journalPins.push({ mesh, journal: j });
  }
  updateOverlayLegend();
}

function nearestSafeHome(fromHome) {
  const src = town.buildings[fromHome];
  const homes = town.buildings.filter((b) => b.kind === "home" && !b.state.flooded);
  let best = null, bestD = Infinity;
  for (const h of homes) {
    const d = (h.center[0] - src.center[0]) ** 2 + (h.center[1] - src.center[1]) ** 2;
    if (d < bestD) { bestD = d; best = h; }
  }
  return best;
}

function triggerStorm() {
  const floodedIds = selectFloodedIds(floodFractionNow());
  let floodedNow = 0;
  for (const b of town.buildings) {
    if (b.kind === "park") { b.state.flooded = false; continue; }
    b.state.flooded = floodedIds.has(b.index);
    if (b.state.flooded) floodedNow++;
  }

  let displaced = 0;
  for (const p of town.people) {
    const home = town.buildings[p.home];
    if (!home?.state?.flooded) continue;
    p.today.homeFlooded = true;
    p.today.displaced = true;
    const safe = nearestSafeHome(p.home);
    if (!safe) continue;
    displaced++;
    p.home = safe.index;
    p.mode = "idle";
    p.action = null;
    p.target = null;
    p.path = null;
    p.pathI = 0;
    p.x = safe.center[0] + (world.rand() - 0.5) * 4;
    p.z = safe.center[1] + (world.rand() - 0.5) * 4;
    p.doing = "displaced after storm";
    p.needs.energy = Math.max(0, p.needs.energy - 12);
    p.needs.fun = Math.max(0, p.needs.fun - 15);
    p.needs.social = Math.max(0, p.needs.social - 10);
  }

  world.policy.floodedNow = floodedNow;
  world.policy.displaced = displaced;
  world.log(`Storm hit: ${floodedNow} parcels flooded, ${displaced} residents displaced`, "storm");
}

$("policy").onchange = (e) => {
  activePolicyId = e.target.value;
  applyPolicy(activePolicyId, policyYear);
};

if (planYearEl) {
  planYearEl.oninput = (e) => {
    policyYear = Math.max(0, Math.min(10, Number(e.target.value) || 0));
    if (planYearNEl) planYearNEl.textContent = `Year ${policyYear}`;
    params.set("year", String(policyYear));
    applyPolicy(activePolicyId, policyYear);
  };
}

$("stormBtn").onclick = () => triggerStorm();
await loadPolicyPackages();
activePolicyId = $("policy").value || "none";
applyPolicy(activePolicyId, policyYear);

const EXP_PACKAGES = ["Balanced", "Minimal change", "Most popular"];
let experimentWorker = null;
let lastExperimentSeed = null;
let lastCompletedRunSeed = null;
let lastCompletedRunFingerprint = null;

function lineChartSvg(title, byPkg, key, colorByPkg, opts = {}) {
  const w = 470, h = 120, pad = 24;
  const ptsAll = [];
  for (const name of EXP_PACKAGES) {
    for (const row of (byPkg[name] || [])) {
      ptsAll.push(Number(row?.outcomes?.[key] ?? 0));
    }
  }
  const min = ptsAll.length ? Math.min(...ptsAll) : 0;
  const max = ptsAll.length ? Math.max(...ptsAll) : 1;
  const lo = min === max ? min - 1 : min;
  const hi = min === max ? max + 1 : max;

  const pathFor = (rows) => {
    const series = rows || [];
    if (!series.length) return "";
    const n = Math.max(1, series.length - 1);
    const parts = [];
    for (let i = 0; i < series.length; i++) {
      const x = pad + (i / n) * (w - pad * 2);
      const v = Number(series[i]?.outcomes?.[key] ?? 0);
      const y = h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);
      parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return parts.join(" ");
  };

  const labels = Array.isArray(opts.xLabels) && opts.xLabels.length ? opts.xLabels : ["0", "5", "10"];
  const nTick = Math.max(1, labels.length - 1);
  const xTicks = labels.map((label, i) => {
    const xx = pad + (i / nTick) * (w - pad * 2);
    return `<text x="${xx}" y="${h - 6}" text-anchor="middle" fill="currentColor" opacity="0.65" font-size="10">${label}</text>`;
  }).join("");

  const marks = (opts.markYears || []).map((i) => {
    const xx = pad + (i / nTick) * (w - pad * 2);
    return `<line x1="${xx}" y1="${pad}" x2="${xx}" y2="${h - pad}" stroke="#d2552d" opacity="0.35" stroke-dasharray="3 3" />`;
  }).join("");

  const yTop = `<text x="4" y="12" fill="currentColor" opacity="0.65" font-size="10">${hi.toFixed(1)}</text>`;
  const yBot = `<text x="4" y="${h - pad + 12}" fill="currentColor" opacity="0.65" font-size="10">${lo.toFixed(1)}</text>`;

  const lines = EXP_PACKAGES.map((name) => {
    const d = pathFor(byPkg[name]);
    if (!d) return "";
    return `<path d="${d}" fill="none" stroke="${colorByPkg[name]}" stroke-width="2" />`;
  }).join("");

  return `<div class="exp-chart"><h2>${title}</h2><svg viewBox="0 0 ${w} ${h}" width="100%" height="120" aria-label="${title}">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="currentColor" opacity="0.22" />
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="currentColor" opacity="0.22" />
    ${xTicks}
    ${yTop}
    ${yBot}
    ${marks}
    ${lines}
  </svg></div>`;
}

function defaultExperimentSeed() {
  return `${town.seedKey}|exp-v1`;
}

function getRequestedExperimentSeed() {
  const input = $("experimentSeedInput");
  const candidate = String(input?.value || "").trim();
  if (candidate) return candidate;
  if (lastExperimentSeed) return String(lastExperimentSeed);
  return defaultExperimentSeed();
}

function setExperimentControlsDisabled(disabled) {
  const copyBtn = $("copyExperimentSeed");
  const input = $("experimentSeedInput");
  const resetBtn = $("resetExperimentSeed");
  const rerunBtn = $("rerunExperimentSeed");
  if (copyBtn) copyBtn.disabled = !!disabled;
  if (input) input.disabled = !!disabled;
  if (resetBtn) resetBtn.disabled = !!disabled;
  if (rerunBtn) rerunBtn.disabled = !!disabled;
}

function setExperimentSeedUI(seed) {
  const code = $("experimentSeed");
  const copyBtn = $("copyExperimentSeed");
  const input = $("experimentSeedInput");
  if (!code || !copyBtn) return;

  const value = String(seed || "").trim();
  code.textContent = value;
  code.title = value;
  if (input) input.value = value;
  copyBtn.textContent = "Copy";
}

async function copyExperimentSeed() {
  const seed = String(lastExperimentSeed || "").trim();
  const btn = $("copyExperimentSeed");
  if (!seed || !btn) return;

  let ok = false;
  try {
    await navigator.clipboard.writeText(seed);
    ok = true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = seed;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }

  btn.textContent = ok ? "Copied" : "Copy failed";
  setTimeout(() => {
    if (btn.textContent !== "Copy") btn.textContent = "Copy";
  }, 1200);
}

$("copyExperimentSeed")?.addEventListener("click", copyExperimentSeed);
$("resetExperimentSeed")?.addEventListener("click", () => {
  const input = $("experimentSeedInput");
  const def = defaultExperimentSeed();
  if (input) input.value = def;
  setExperimentSeedUI(def);
});
$("rerunExperimentSeed")?.addEventListener("click", () => {
  if (experimentWorker) return;
  runExperiment10Years();
});
lastExperimentSeed = defaultExperimentSeed();
setExperimentSeedUI(lastExperimentSeed);

function formatPlanChanges(changes) {
  const added = Array.isArray(changes?.added) ? changes.added : [];
  const removed = Array.isArray(changes?.removed) ? changes.removed : [];
  const parts = [
    ...added.map((id) => `+${id}`),
    ...removed.map((id) => `−${id}`),
  ];
  return parts.length ? parts.join(" ") : "—";
}

function renderExperimentResults(results) {
  const panel = $("experimentPanel");
  const charts = $("experimentCharts");
  const tableWrap = $("experimentTableWrap");
  if (!panel || !charts || !tableWrap) return;

  const colors = {
    "Balanced": "#2f6fd6",
    "Minimal change": "#2aa162",
    "Most popular": "#d27b2d",
  };

  const byPkg = {};
  for (const name of EXP_PACKAGES) byPkg[name] = results?.[name]?.history || [];

  const anyNotSimulatedChanged = EXP_PACKAGES.some((name) => {
    const plans = results?.[name]?.plansByYear || [];
    return plans.some((p) => Array.isArray(p?.notSimulatedChanges) && p.notSimulatedChanges.length > 0);
  });

  const replay = EXP_PACKAGES.some((name) => (byPkg[name] || []).some((r) => r?.replay));
  const balancedHist = byPkg["Balanced"] || [];
  const labels = replay
    ? balancedHist.map((r) => String(r?.yearLabel || r?.year || "")).filter(Boolean)
    : ["0", "5", "10"];
  const markYears = replay
    ? (balancedHist.map((r, i) => Number(r?.stormSeverity) >= 0.8 ? i : -1).filter((i) => i >= 0))
    : [];

  charts.innerHTML = [
    anyNotSimulatedChanged
      ? `<div class="warn" style="margin:0 0 8px 0">This plan changes things the simulator doesn't model — outcomes shown don't include them.</div>`
      : "",
    replay ? `<div class="muted" style="margin:0 0 8px 0">${replayStormStrengthLabel(!EXP_PACKAGES.some((name) => (byPkg[name] || []).some((r) => r?.replayDataSource === "simulated")))}</div>` : "",
    lineChartSvg("Flooded parcels", byPkg, "floodedParcels", colors, { xLabels: labels, markYears }),
    lineChartSvg("Displaced residents", byPkg, "displacedResidents", colors, { xLabels: labels, markYears }),
    lineChartSvg("Commute / walk minutes", byPkg, "avgWalkMinutes", colors, { xLabels: labels, markYears }),
    lineChartSvg("Mood", byPkg, "avgMood", colors, { xLabels: labels, markYears }),
  ].join("");

  const rows = EXP_PACKAGES.map((name) => {
    const hist = byPkg[name] || [];
    const y10Outcomes = hist.find((r) => r.year === 10) || hist[hist.length - 1] || { outcomes: {} };
    const plans = results?.[name]?.plansByYear || [];
    const y2Plan = plans.find((p) => p.year === 2) || {};
    const y5Plan = plans.find((p) => p.year === 5) || {};
    const y10Plan = plans.find((p) => p.year === 10) || plans[plans.length - 1] || {};
    const p2 = (y2Plan.proposalIds || []).join(", ") || "—";
    const p5 = (y5Plan.proposalIds || []).join(", ") || "—";
    const p10 = (y10Plan.proposalIds || []).join(", ") || "—";
    const c2 = formatPlanChanges(y2Plan.changesFromPrevious);
    const c5 = formatPlanChanges(y5Plan.changesFromPrevious);
    const c10 = formatPlanChanges(y10Plan.changesFromPrevious);
    const ns2 = (Array.isArray(y2Plan.notSimulatedChanges) && y2Plan.notSimulatedChanges.length) ? y2Plan.notSimulatedChanges.join(", ") : "—";
    const ns5 = (Array.isArray(y5Plan.notSimulatedChanges) && y5Plan.notSimulatedChanges.length) ? y5Plan.notSimulatedChanges.join(", ") : "—";
    const ns10 = (Array.isArray(y10Plan.notSimulatedChanges) && y10Plan.notSimulatedChanges.length) ? y10Plan.notSimulatedChanges.join(", ") : "—";
    return `<tr>
      <th>${name}</th>
      <td>${Number(y10Outcomes.outcomes.floodedParcels ?? 0).toFixed(0)}</td>
      <td>${Number(y10Outcomes.outcomes.displacedResidents ?? 0).toFixed(0)}</td>
      <td>${Number(y10Outcomes.outcomes.avgWalkMinutes ?? 0).toFixed(1)}</td>
      <td>${Number(y10Outcomes.outcomes.avgMood ?? 0).toFixed(1)}</td>
      <td>${p2}</td>
      <td>${c2}</td>
      <td>${p5}</td>
      <td>${c5}</td>
      <td>${p10}</td>
      <td>${c10}</td>
      <td>${ns2}</td>
      <td>${ns5}</td>
      <td>${ns10}</td>
    </tr>`;
  }).join("");

  tableWrap.innerHTML = `<table class="exp-table">
    <thead><tr><th>Package</th><th>Flooded (Y10)</th><th>Displaced (Y10)</th><th>Walk min (Y10)</th><th>Mood (Y10)</th><th>Items Y2</th><th>Plan changes Y2</th><th>Items Y5</th><th>Plan changes Y5</th><th>Items Y10</th><th>Plan changes Y10</th><th>Not simulated Y2</th><th>Not simulated Y5</th><th>Not simulated Y10</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="muted" style="margin-top:6px">Most popular ranks only by votes, so journals don't change it. Minimal change rarely adopts new programs.</div>`;

  panel.style.display = "block";
  const cyclePanel = $("cyclePanel");
  if (cyclePanel) cyclePanel.style.display = "none";
}

function setExperimentStatus(text) {
  const el = $("experimentStatus");
  if (el) el.textContent = text;
}

function resultsFingerprint(results) {
  const compact = {};
  for (const name of EXP_PACKAGES) {
    const hist = results?.[name]?.history || [];
    const y10 = hist.find((r) => r.year === 10) || hist[hist.length - 1] || { outcomes: {} };
    compact[name] = {
      floodedParcels: Number(y10.outcomes?.floodedParcels ?? 0),
      displacedResidents: Number(y10.outcomes?.displacedResidents ?? 0),
      avgWalkMinutes: Number(y10.outcomes?.avgWalkMinutes ?? 0),
      avgMood: Number(y10.outcomes?.avgMood ?? 0),
    };
  }
  return JSON.stringify(compact);
}

function renderExperimentComparison(seed, results) {
  const el = $("experimentCompare");
  if (!el) return;
  const nextSeed = String(seed || "").trim();
  const nextFp = resultsFingerprint(results);

  if (!lastCompletedRunFingerprint) {
    el.textContent = `Last run seed: ${nextSeed} · baseline (first completed run)`;
  } else {
    const changed = nextFp !== lastCompletedRunFingerprint;
    const delta = changed ? "changed vs previous run" : "same as previous run";
    el.textContent = `Last run seed: ${nextSeed} · ${delta}`;
  }

  lastCompletedRunSeed = nextSeed;
  lastCompletedRunFingerprint = nextFp;
}

async function readStateEntryCount() {
  try {
    const res = await fetch("/api/dear-congress/state", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const payload = await res.json();
    const entries = payload?.entries;
    return Array.isArray(entries) ? entries.length : null;
  } catch {
    return null;
  }
}

function runExperiment10Years() {
  if (experimentWorker) return;
  const btn = $("runExperimentBtn");
  if (btn) btn.disabled = true;
  setExperimentControlsDisabled(true);
  setExperimentStatus("Starting…");

  const experimentSeed = getRequestedExperimentSeed();
  lastExperimentSeed = experimentSeed;
  setExperimentSeedUI(experimentSeed);

  const beforeStatePromise = readStateEntryCount();

  experimentWorker = new Worker(new URL("./experiment.worker.js", import.meta.url), { type: "module" });
  experimentWorker.onmessage = async (ev) => {
    const msg = ev?.data || {};
    if (msg.type === "progress") {
      const pkg = msg.packageName;
      const replayTxt = msg.replay
        ? ` · ${String(msg.yearLabel || "?")} severity ${(Number(msg.stormSeverity) || 0).toFixed(2)}`
        : "";
      setExperimentStatus(`Running ${pkg}: year ${msg.year}/10 (${msg.donePackages + 1}/3 packages)${replayTxt}`);
      return;
    }
    if (msg.type === "error") {
      setExperimentStatus(`Experiment failed: ${msg.error}`);
      if (btn) btn.disabled = false;
      setExperimentControlsDisabled(false);
      experimentWorker?.terminate();
      experimentWorker = null;
      return;
    }
    if (msg.type === "done") {
      const results = msg.results || {};
      renderExperimentResults(results);
      renderExperimentComparison(experimentSeed, results);
      const before = await beforeStatePromise;
      const after = await readStateEntryCount();
      const stateMsg = before != null && after != null
        ? `done · dear-congress entries ${before} → ${after}`
        : "done";
      setExperimentStatus(`Run 10 years: ${stateMsg}`);
      if (btn) btn.disabled = false;
      setExperimentControlsDisabled(false);
      experimentWorker?.terminate();
      experimentWorker = null;
    }
  };

  experimentWorker.postMessage({
    type: "run",
    payload: {
      origin,
      area,
      maxPeople,
      years: 10,
      mode: "replay",
      seed: experimentSeed,
    },
  });
}

$("runExperimentBtn")?.addEventListener("click", runExperiment10Years);

/* ---------------------------------------------------------------- */
/* Run cycle: one week of the selected plan vs. no plan, same seed.  */
/* ---------------------------------------------------------------- */
let cycleWorker = null;     // stays alive between cycles so cycle 2 continues cycle 1's worlds
let cycleBusy = false;
let cycleResults = [];      // one entry per completed cycle
let cycleIdx = 0;           // which cycle the panel and overlay show
let cycleWho = "best";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (x) => Number(x || 0).toFixed(1);
const signed = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`;

// The Balanced package, whichever id it has: presets use "balanced", but when
// dear-congress loads it replaces them with its own ids ("a", "b", "c").
function balancedPackageId() {
  const ids = Object.keys(PLAN_PACKAGES).filter((id) => id !== "none" && !id.startsWith("cycle-"));
  return ids.find((id) => /balanced/i.test(PLAN_PACKAGES[id].label)) || ids[0] || "none";
}

function cyclePackageId() {
  if (PLAN_PACKAGES[activePolicyId] && activePolicyId !== "none" && !activePolicyId.startsWith("cycle-")) return activePolicyId;
  return balancedPackageId();
}

// A bare "+0.0" hides why nothing happened, so later cycles say what changed.
function cycleStatusText(r, n) {
  const d = r.avg.withPlan - r.avg.noPlan;
  if (n === 1) return `Cycle 1: ${signed(d)} well-being vs no plan`;
  const vs = `vs keeping plan ${n - 1}`;
  if (!r.added?.length && !r.removed?.length) return `Cycle ${n}: no fixable complaints left, so plan ${n} = plan ${n - 1}`;
  const what = r.added?.length ? `+ ${r.added.map((a) => a.label).join(", ")}` : `− ${r.removed.map((a) => a.label).join(", ")}`;
  if (Math.abs(d) < 0.05) return `Cycle ${n}: ${what}, but no measurable effect within a week`;
  return `Cycle ${n}: ${what} → ${signed(d)} well-being ${vs}`;
}

function setCycleBusy(busy) {
  cycleBusy = busy;
  $("runCycleBtn").disabled = busy;
  const next = $("cycleNext");
  if (next) next.disabled = busy;
}

function startCycleWorker() {
  cycleWorker?.terminate();
  cycleWorker = new Worker(new URL("./cycle.worker.js", import.meta.url), { type: "module" });
  cycleWorker.onmessage = (ev) => {
    const msg = ev?.data || {};
    const status = $("cycleStatus");
    if (msg.type === "progress") { status.textContent = `${msg.stage}…`; return; }
    if (msg.type === "error") {
      status.textContent = `Cycle failed: ${msg.error}`;
      setCycleBusy(false);
      cycleWaiter?.reject(new Error(msg.error));
      cycleWaiter = null;
      return;
    }
    if (msg.type === "done") onCycleDone(msg.result);
  };
}

function runCycle() {
  if (cycleBusy) return;
  const pkgId = cyclePackageId();
  const pkg = PLAN_PACKAGES[pkgId];
  const year = policyYear || 3; // effects ramp in over years; year 0 would show nothing
  setCycleBusy(true);
  $("cycleStatus").textContent = "Starting…";
  cycleResults = [];

  // The visible world adopts the plan too, so what you watch matches what was measured.
  $("policy").value = pkgId;
  activePolicyId = pkgId;
  policyYear = year;
  if (planYearEl) planYearEl.value = String(year);
  if (planYearNEl) planYearNEl.textContent = `Year ${year}`;
  applyPolicy(pkgId, year);

  startCycleWorker(); // a fresh cycle 1 starts from fresh worlds
  pendingCycleLabel = pkg.label;
  pendingCycleSource = pkg.source;
  cycleWorker.postMessage({
    type: "run",
    payload: { origin, area, maxPeople, proposalIds: pkg.proposalIds || [], label: pkg.label, remoteId: pkg.remoteId || null, year, days: 7 },
  });
}

function runNextCycle() {
  if (cycleBusy || !cycleWorker || !cycleResults.length) return;
  setCycleBusy(true);
  $("cycleStatus").textContent = "Reading residents' journals…";
  pendingCycleLabel = null;
  pendingCycleSource = null;
  cycleWorker.postMessage({ type: "next" });
}

let pendingCycleLabel = null;
let pendingCycleSource = null;

function onCycleDone(result) {
  const n = cycleResults.length + 1;
  const label = pendingCycleLabel || `Plan ${n}`;
  const r = { ...result, label, source: result.source || pendingCycleSource || "local" };
  cycleResults.push(r);
  cycleIdx = cycleResults.length - 1;
  cycleResult = r;
  cycleView = "withPlan";
  cycleWho = "best";

  // Later cycles: the visible world switches to the new plan too.
  if (n > 1) {
    const id = `cycle-${n}`;
    PLAN_PACKAGES[id] = { id, label: `Plan ${n} (from journals)`, source: r.source, proposalIds: r.proposalIds, unsupported: [] };
    refreshPolicySelect(id);
    activePolicyId = id;
    applyPolicy(id, policyYear);
  }

  const opt = overlayEl?.querySelector('option[value="cycle"]');
  if (opt) opt.disabled = false;
  overlayMode = "cycle";
  if (overlayEl) overlayEl.value = "cycle";
  const d = r.avg.withPlan - r.avg.noPlan;
  $("cycleStatus").textContent = cycleStatusText(r, n);
  $("cycleShowBtn").hidden = false;
  const vs = n === 1 ? "vs no plan" : `vs keeping plan ${n - 1}`;
  world.log(`Cycle ${n}${n > 1 && r.added?.length ? ` (+ ${r.added.map((a) => a.label).join(", ")})` : `: ${label}`} → ${signed(d)} avg well-being ${vs}`, "civic");
  setCycleBusy(false);
  renderCyclePanel();
  $("cyclePanel").scrollTop = 0;
  followResident(n > 1 && r.followUp ? r.followUp.index : r.best.index);
  cycleWaiter?.resolve(r);
  cycleWaiter = null;
}

// Lets the demo await a cycle: call before posting the run/next message.
let cycleWaiter = null;
function nextCycleResult() {
  return new Promise((resolve, reject) => { cycleWaiter = { resolve, reject }; });
}

function followResident(i) {
  if (i == null || !town.people[i]) return;
  select({ type: "person", id: i });
  follow = true; // select() resets follow
  renderInspector();
}

function showCycle(i) {
  cycleIdx = i;
  cycleResult = cycleResults[i];
  cycleWho = "best";
  overlayMode = "cycle";
  if (overlayEl) overlayEl.value = "cycle";
  renderCyclePanel();
  $("cyclePanel").scrollTop = 0;
}

function renderCyclePanel() {
  const r = cycleResult;
  const el = $("cyclePanel");
  if (!r) { el.style.display = "none"; return; }
  $("experimentPanel").style.display = "none";
  el.style.display = "block";

  const n = cycleIdx + 1;
  const prev = n - 1;
  const names = n === 1
    ? { before: "Before", noPlan: "No plan", withPlan: "With plan" }
    : { before: `After plan ${prev}`, noPlan: `Keep plan ${prev}`, withPlan: `Plan ${n}` };
  const d = r.avg.withPlan - r.avg.noPlan;
  const tab = (id) => `<button data-cyview="${id}" class="${cycleView === id ? "on" : ""}">${names[id]}</button>`;
  const rows = [["commute", "Commute"], ["home", "Flooded home"], ["groceries", "Groceries"], ["parks", "Dirty parks"]]
    .filter(([k]) => r.frictions.noPlan[k] > 0.05 || r.frictions.withPlan[k] > 0.05)
    .map(([k, label]) => {
      const a = r.frictions.noPlan[k], b = r.frictions.withPlan[k];
      return `<span>${label}</span><span>−${fmt(a)}</span><span${b < a - 0.3 ? ' style="color:var(--accent)"' : ""}>−${fmt(b)}</span>`;
    }).join("");
  const who = cycleWho === "worst" && r.worst ? r.worst : r.best;
  const whoDelta = who.withPlan - who.noPlan;
  const cycleTabs = cycleResults.length > 1
    ? `<div class="cy-tabs">${cycleResults.map((_, i) => `<button data-cycle="${i}" class="${i === cycleIdx ? "on" : ""}">Cycle ${i + 1}</button>`).join("")}</div>`
    : "";

  // Cycle 2+: what the journals changed, and what nothing in the catalog can fix yet.
  const changes = n > 1 ? `
    <div class="cy-who" style="margin-top:8px">
      <div class="lbl">What residents' journals changed</div>
      ${r.added?.length ? r.added.map((a) => `<div><b style="color:var(--accent)">+ ${esc(a.label)}</b></div>`).join("") : `<div class="muted">No new simulated proposal.</div>`}
      ${r.removed?.length ? r.removed.map((a) => `<div class="muted">− ${esc(a.label)}</div>`).join("") : ""}
      ${r.target ? `<div class="muted">Top fixable complaint: ${esc(r.target.label)} (${r.target.count} residents)</div>` : ""}
      <div class="muted" style="margin-top:2px">${esc(r.note)}</div>
      ${r.unreachable?.length ? `<div class="warn">Can't fix yet: ${r.unreachable.map((u) => `${esc(u.label)} (${u.count} residents)`).join(", ")}. No proposal in the plan catalog reaches this in the simulation.</div>` : ""}
    </div>` : "";

  // Cycle 2+: follow up on whoever the previous plan hurt most.
  const f = r.followUp;
  const followUp = n > 1 && f ? `
    <div class="cy-who">
      <div class="row" style="justify-content:space-between;margin:0"><b>${esc(f.name)}</b><button id="cycleFollowUp">Follow</button></div>
      <div class="lbl">Hurt most by plan ${prev}. Did plan ${n} help?</div>
      <div class="cy-fric" style="grid-template-columns:1fr auto;margin-top:4px">
        ${prev === 1 ? `<span>No plan</span><span>${fmt(f.noPlan1)}</span>` : `<span>Before plan ${prev}</span><span>${fmt(f.noPlan1)}</span>`}
        <span>Plan ${prev}</span><span>${fmt(f.plan1)}</span>
        <span>A week later, keeping plan ${prev}</span><span>${fmt(f.keepPlan1)}</span>
        <span><b>A week later, with plan ${n}</b></span><span><b style="color:${f.plan2 > f.keepPlan1 ? "var(--accent)" : "inherit"}">${fmt(f.plan2)}</b></span>
      </div>
    </div>` : "";

  el.innerHTML = `
    <div class="row" style="justify-content:space-between;margin:0">
      <h1 style="margin:0">${n === 1 ? `Civic cycle · ${esc(r.label)}` : `Cycle ${n} · plan ${n} from residents' journals`}</h1>
      <button id="cycleClose" aria-label="Close">✕</button>
    </div>
    ${cycleTabs}
    <div class="muted">${r.days} simulated days · plan year ${r.year} · same seed, ${n === 1 ? "with and without the plan" : `plan ${n} vs keeping plan ${prev}`}${r.source === "dear-congress" ? " · plan from dear-congress" : ""}</div>
    <div class="cy-big">
      <div><span class="muted">${names.before}</span><b>${fmt(r.avg.before)}</b></div>
      <div><span class="muted">${names.noPlan}</span><b>${fmt(r.avg.noPlan)}</b></div>
      <div class="${d > 0 ? "win" : ""}"><span class="muted">${names.withPlan}</span><b>${fmt(r.avg.withPlan)}</b></div>
    </div>
    <div><b>${signed(d)}</b> average well-being ${n === 1 ? "from the plan" : `from plan ${n}`} · <b>${r.improved}</b> residents better off, <b>${r.worse}</b> worse off</div>
    ${changes}
    <div class="cy-tabs">${tab("before")}${tab("noPlan")}${tab("withPlan")}</div>
    <div class="cy-scale"></div>
    <div class="row muted" style="justify-content:space-between;margin:0;font-size:11px"><span>struggling</span><span>doing well</span></div>
    ${rows ? `<div class="cy-fric" style="margin-top:8px"><span class="h">Points lost to</span><span class="h">${names.noPlan}</span><span class="h">${names.withPlan}</span>${rows}</div>` : ""}
    ${r.unsupported?.length ? `<div class="muted" style="margin-top:6px">Not simulated: ${esc(r.unsupported.slice(0, 4).join(", "))}</div>` : ""}
    ${followUp}
    <div class="cy-who">
      <div class="row" style="justify-content:space-between;margin:0">
        <b>${esc(who.name)}</b>
        <span class="muted">${fmt(who.noPlan)} → ${fmt(who.withPlan)} (${signed(whoDelta)})</span>
      </div>
      <div class="lbl">${cycleWho === "worst" ? `Hurt most by ${n === 1 ? "the plan" : `plan ${n}`}` : `Helped most by ${n === 1 ? "the plan" : `plan ${n}`}`}</div>
      <div class="lbl" style="margin-top:6px">Journal, ${n === 1 ? "day 1" : `end of cycle ${prev}`}</div>
      <blockquote>${esc(who.journalBefore) || "<span class=\"muted\">No complaints.</span>"}</blockquote>
      <div class="lbl">Journal, day ${r.days}, with ${n === 1 ? "the plan" : `plan ${n}`}</div>
      <blockquote>${esc(who.journalAfter) || "<span class=\"muted\">No complaints.</span>"}</blockquote>
      <div class="row">
        <button id="cycleFollow">Follow ${esc(who.name.split(" ")[0])}</button>
        ${r.worst ? `<button id="cycleWhoToggle">${cycleWho === "worst" ? "Who it helped" : "Who got worse?"}</button>` : ""}
      </div>
    </div>
    ${cycleIdx === cycleResults.length - 1 ? `
    <div class="row" style="margin-top:10px">
      <button id="cycleNext" ${cycleBusy ? "disabled" : ""} title="Residents journal about this week; their journals pick the next change">Run cycle ${cycleResults.length + 1} →</button>
      <span class="muted">let residents' journals pick the next fix</span>
    </div>` : ""}
    <div class="exp-footnote">Synthetic residents. Well-being = day-averaged mood minus commute, housing, grocery and park frictions. Illustrative, not a forecast.</div>`;

  el.querySelectorAll("[data-cyview]").forEach((b) => (b.onclick = () => {
    cycleView = b.dataset.cyview;
    overlayMode = "cycle";
    if (overlayEl) overlayEl.value = "cycle";
    renderCyclePanel();
  }));
  el.querySelectorAll("[data-cycle]").forEach((b) => (b.onclick = () => showCycle(Number(b.dataset.cycle))));
  $("cycleClose").onclick = () => { el.style.display = "none"; };
  $("cycleFollow").onclick = () => followResident(who.index);
  const fu = $("cycleFollowUp");
  if (fu) fu.onclick = () => followResident(f.index);
  const next = $("cycleNext");
  if (next) next.onclick = runNextCycle;
  const toggle = $("cycleWhoToggle");
  if (toggle) toggle.onclick = () => {
    cycleWho = cycleWho === "worst" ? "best" : "worst";
    renderCyclePanel();
    followResident((cycleWho === "worst" ? r.worst : r.best).index);
  };
}

$("runCycleBtn")?.addEventListener("click", runCycle);
/* ---------------------------------------------------------------- */
/* Demo mode: three cycles hands-free, with captions and follow-cam.  */
/* ---------------------------------------------------------------- */
const DEMO_URL = "/world/?lat=29.7286&lng=-95.4746&people=500&demo=1";
const DEMO_HOLD_MS = 8000; // how long each caption stays up
const demo = { running: false, paused: false, skip: false, stopped: false };

class DemoStopped extends Error {}

function demoCaption(step, text) {
  $("demoBar").hidden = false;
  $("demoStep").textContent = step;
  $("demoCaption").textContent = text;
}

// Waits `ms` of unpaused time; Next ends it early; Stop aborts the demo.
function demoHold(ms = DEMO_HOLD_MS) {
  return new Promise((resolve, reject) => {
    let left = ms, last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (!demo.paused) left -= now - last;
      last = now;
      if (demo.stopped) { clearInterval(t); reject(new DemoStopped()); }
      else if (left <= 0 || demo.skip) { demo.skip = false; clearInterval(t); resolve(); }
    }, 100);
  });
}

function demoShow(view, who = "best") {
  cycleView = view;
  cycleWho = who;
  overlayMode = "cycle";
  if (overlayEl) overlayEl.value = "cycle";
  renderCyclePanel();
}

async function demoCycle(start) {
  const pending = nextCycleResult();
  start();
  const r = await pending;
  if (demo.stopped) throw new DemoStopped();
  demo.skip = false; // a Next pressed while computing shouldn't skip the result caption
  return r;
}

async function playDemo() {
  if (demo.running) return;
  if (!demoMode) { location.href = `${DEMO_URL}&autoplay=1`; return; } // demo needs the pinned town
  Object.assign(demo, { running: true, paused: false, skip: false, stopped: false });
  $("demoBtn").disabled = true;
  $("demoPause").textContent = "❚❚ Pause";
  $("demoPause").hidden = $("demoSkip").hidden = false;
  $("demoStop").textContent = "Stop";
  const deltas = [];
  try {
    overlayMode = "wellbeing";
    if (overlayEl) overlayEl.value = "wellbeing";
    demoCaption("The town", `${town.people.length} simulated residents. Each one journals about their day. Red means struggling, green means doing well.`);
    await demoHold(7000);

    // Cycle 1: the Balanced plan vs. an identical town with no plan.
    activePolicyId = balancedPackageId();
    $("policy").value = activePolicyId;
    policyYear = 3;
    const plan1Label = PLAN_PACKAGES[activePolicyId]?.label || "Balanced";
    demoCaption("Cycle 1", `Trying the ${plan1Label} plan for a week, next to an identical copy of the town with no plan…`);
    const r1 = await demoCycle(runCycle);
    deltas.push(r1.avg.withPlan - r1.avg.noPlan);
    demoShow("noPlan");
    demoCaption("Cycle 1", `A week with no plan: average well-being ${fmt(r1.avg.noPlan)}.`);
    await demoHold(5000);
    demoShow("withPlan");
    followResident(r1.best.index);
    demoCaption("Cycle 1", `With the ${plan1Label} plan: ${fmt(r1.avg.withPlan)} (${signed(deltas[0])}). ${r1.improved} residents are better off, mostly from shorter commutes.`);
    await demoHold();
    if (r1.worst) {
      demoShow("withPlan", "worst");
      followResident(r1.worst.index);
      demoCaption("Cycle 1", `But ${r1.worse} residents are worse off, like ${r1.worst.name}: ${fmt(r1.worst.noPlan)} without the plan, ${fmt(r1.worst.withPlan)} with it. They write about it in their journals.`);
      await demoHold();
    }

    // Cycles 2–3: residents' journals pick the next change.
    for (const n of [2, 3]) {
      demoCaption(`Cycle ${n}`, `Reading this week's journals to pick the next change…`);
      const r = await demoCycle(runNextCycle);
      const d = r.avg.withPlan - r.avg.noPlan;
      if (!r.added?.length && !r.removed?.length) {
        demoCaption(`Cycle ${n}`, "The journals don't point at anything the plan catalog can still fix, so the plan stays as it is.");
        await demoHold();
        break;
      }
      deltas.push(d);
      const why = r.target ? `${r.target.count} residents wrote about ${r.target.label}` : "Residents' journals changed the plan";
      const what = r.added.map((a) => a.label).join(" and ");
      demoShow("withPlan");
      demoCaption(`Cycle ${n}`, `${why} → ${what} added. ${signed(d)} well-being compared with keeping plan ${n - 1}; ${r.improved} residents better off, ${r.worse} worse off.`);
      await demoHold();
      const f = r.followUp;
      if (f && f.plan2 - f.keepPlan1 >= 3) { // only a recovery worth pointing at
        followResident(f.index);
        demoCaption(`Cycle ${n}`, `${f.name} was hurt most by plan ${n - 1}. Keeping it: ${fmt(f.keepPlan1)}. With plan ${n}: ${fmt(f.plan2)}.`);
        await demoHold();
      }
    }

    demoCaption("Recap", `${deltas.map((d, i) => `Cycle ${i + 1}: ${signed(d)}`).join(" · ")}. Each number compares against an identical town on the same seed, so it's the plan's effect, not luck.`);
  } catch (err) {
    if (!(err instanceof DemoStopped)) demoCaption("Demo stopped", `Something went wrong: ${err?.message || err}`);
  } finally {
    demo.running = false;
    $("demoBtn").disabled = false;
    // Finished: leave the recap up with just a Close button.
    $("demoPause").hidden = $("demoSkip").hidden = true;
    $("demoStop").textContent = "Close";
  }
}

$("demoBtn")?.addEventListener("click", playDemo);
$("demoPause")?.addEventListener("click", () => {
  demo.paused = !demo.paused;
  $("demoPause").textContent = demo.paused ? "▶ Resume" : "❚❚ Pause";
});
$("demoSkip")?.addEventListener("click", () => { demo.skip = true; });
$("demoStop")?.addEventListener("click", () => {
  demo.stopped = true;
  $("demoBar").hidden = true;
  cycleWaiter?.reject(new DemoStopped());
  cycleWaiter = null;
});
if (demoMode && params.get("autoplay") === "1") setTimeout(playDemo, 1500);

// Reopen results after closing the panel or after the 10-year experiment took its corner.
$("cycleShowBtn")?.addEventListener("click", () => {
  if (!cycleResults.length) return;
  renderCyclePanel();
  $("cyclePanel").scrollTop = 0;
});

const tileKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;
const JOURNAL_COOLDOWN_MS = 5 * 60 * 1000;
const journalPostedAtKey = `hbl:world:journal-posted-at:${tileKey}`;
let lastJournalDay = -1;
let journalInFlight = false;
const journalDiag = { day: lastJournalDay, attempted: 0, posted: 0, status: "idle", lastError: null };

function renderJournalDiagnostics() {
  const el = $("journaldiag");
  if (!el) return;
  const dayTxt = Number.isFinite(journalDiag.day) && journalDiag.day >= 0 ? `day ${journalDiag.day}` : "day —";
  const countTxt = `${journalDiag.posted}/${journalDiag.attempted}`;
  const warn = journalDiag.lastError ? " ⚠" : "";
  el.textContent = `Journals${warn}: ${dayTxt} · posted ${countTxt} · ${journalDiag.status}`;
  el.title = journalDiag.lastError ? `Last publish error: ${journalDiag.lastError}` : "";
}

renderJournalDiagnostics();

function residentMood(p) {
  const n = p?.needs || {};
  return (Number(n.hunger || 0) + Number(n.energy || 0) + Number(n.fun || 0) + Number(n.social || 0)) / 4;
}

function pickJournalsByProblem(candidates, maxTotal = 12, perProblemCap = 4) {
  const types = ["flood", "transit", "streets", "groceries"];
  const byType = {};

  for (const t of types) {
    byType[t] = candidates
      .filter((c) => Number(c?.severity?.[t] || 0) > 0)
      .sort((a, b) => (Number(b.severity[t] || 0) - Number(a.severity[t] || 0)) || (a.mood - b.mood));
  }

  const selected = [];
  const selectedPerType = Object.fromEntries(types.map((t) => [t, 0]));
  const used = new Set();

  for (let round = 0; round < perProblemCap && selected.length < maxTotal; round++) {
    for (const t of types) {
      if (selected.length >= maxTotal) break;
      if (selectedPerType[t] >= perProblemCap) continue;

      const pool = byType[t] || [];
      const next = pool.find((c) => !used.has(c.key));
      if (!next) continue;

      used.add(next.key);
      selected.push(next);
      selectedPerType[t]++;
    }
  }

  return selected.slice(0, maxTotal);
}

function worstNeedLabel(p) {
  const entries = Object.entries(p?.needs || {});
  if (!entries.length) return "general stress";
  entries.sort((a, b) => a[1] - b[1]);
  const [k] = entries[0];
  return ({ hunger: "food insecurity", energy: "exhaustion", fun: "burnout", social: "isolation" })[k] || "general stress";
}

function recentFrustration() {
  const e = (world.events || []).find((x) => ["soldout", "litter", "fridge", "storm"].includes(x.kind));
  return e?.text || null;
}

async function publishSyntheticJournalsForDay(day) {
  if (journalInFlight) return;
  journalInFlight = true;
  journalDiag.day = day;
  journalDiag.status = "publishing";
  todayJournalPosts = [];
  rebuildJournalPins();
  renderJournalDiagnostics();

  try {
    const candidates = [];
    for (let i = 0; i < town.people.length; i++) {
      const p = town.people[i];
      const sourceDay = world.day() === 0 ? (p.today || null) : (p.yesterday || null);
      if (!sourceDay) continue;
      const probe = { ...p, today: sourceDay, walkMinutesAvg3d: Number(p.walkMinutesAvg3d || 0) };
      const text = journalFor(probe, {
        tileKey,
        buildingsById,
        policyLabel: world.policy?.label || "No package",
        year: policyYear,
      });
      if (text) {
        const floodSeverity = sourceDay.displaced ? 2 : (sourceDay.homeFlooded ? 1 : 0);
        const transitSeverity = Number(probe.walkMinutesAvg3d || sourceDay.walkMinutes || 0);
        const streetsSeverity = Number(sourceDay.dirtyParkVisits || 0);
        const soldOutCount = Array.isArray(sourceDay.soldOutAt) ? sourceDay.soldOutAt.length : 0;
        const groceriesSeverity = soldOutCount + (sourceDay.emptyFridge ? 1 : 0);

        candidates.push({
          p: probe,
          i,
          key: `${String(probe.id ?? i)}:${String(sourceDay.day ?? day)}`,
          mood: residentMood(p),
          text,
          severity: {
            flood: floodSeverity,
            transit: transitSeverity,
            streets: streetsSeverity,
            groceries: groceriesSeverity,
          },
        });
      }
    }

    const picked = pickJournalsByProblem(candidates, 3, 1);

    if (!picked.length) {
      journalDiag.attempted = 0;
      journalDiag.posted = 0;
      journalDiag.status = "no candidates";
      journalDiag.lastError = null;
      lastJournalDay = day;
      rebuildJournalPins();
      renderJournalDiagnostics();
      return;
    }

    let postedAt = 0;
    try {
      postedAt = Number(localStorage.getItem(journalPostedAtKey) || 0);
      if (!Number.isFinite(postedAt)) postedAt = 0;
    } catch {
      postedAt = 0;
    }

    if (Date.now() - postedAt < JOURNAL_COOLDOWN_MS) {
      journalDiag.status = "skipped: this tile posted recently";
      lastJournalDay = day;
      rebuildJournalPins();
      renderJournalDiagnostics();
      return;
    }

    journalDiag.attempted = picked.length;
    journalDiag.posted = 0;
    journalDiag.lastError = null;

    let ok = 0;
    todayJournalPosts = [];
    for (const { p, i, mood, text } of picked) {
      const home = town.buildings[p.home];
      const [lat, lng] = geoProj.toLatLng(home.center[0], home.center[1]);
      const payload = {
        kind: "journal",
        synthetic: true,
        source: "happybearlandia-world",
        tileId: tileKey,
        location: { lat, lng },
        day,
        residentId: String(p.id ?? i),
        title: `Journal · ${p.name}`,
        text,
        body: text,
        content: text,
        metadata: {
          lat,
          lng,
          tileId: tileKey,
          policyId: world.policy?.id || "none",
          policyYear,
          mood: Number(mood.toFixed(1)),
          needs: p.needs,
          today: p.today,
          walkMinutesAvg3d: Number(p.walkMinutesAvg3d || 0),
          walkComplaintMinutes: WALK_COMPLAINT_MINUTES,
          recentFrustration: recentFrustration(),
        },
      };

      try {
        const res = await fetch("/api/publish_draft", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-voter-id": `synthetic-${tileKey}-${String(p.id ?? i)}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          ok++;
          const out = await res.json().catch(() => null);
          const mappedNeed = out?.entry?.extraction?.needs?.[0]?.id || "unknown";
          todayJournalPosts.push({
            residentId: String(p.id ?? i),
            name: p.name,
            home: p.home,
            text,
            needId: mappedNeed,
          });
        }
      } catch (err) {
        journalDiag.lastError = String(err?.message || err || "request failed");
        // continue posting next resident
      }
      journalDiag.posted = ok;
      renderJournalDiagnostics();
    }

    lastJournalDay = day;
    if (ok > 0) {
      try { localStorage.setItem(journalPostedAtKey, String(Date.now())); } catch {}
    }
    journalDiag.status = ok > 0 ? "published" : "upstream unavailable";
    if (ok > 0) journalDiag.lastError = null;
    rebuildJournalPins();
    world.log(`Published ${ok}/${picked.length} synthetic journals for day ${day}`, "civic");
    renderJournalDiagnostics();
  } finally {
    journalInFlight = false;
  }
}

const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; // was a drag
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hp = ray.intersectObject(people)[0];
  const hb = ray.intersectObjects(meshes)[0];
  const hj = journalPins.length ? ray.intersectObjects(journalPins.map((x) => x.mesh))[0] : null;
  if (hj) {
    const ji = hj.object.userData.journalIndex;
    select({ type: "journal", id: ji });
  } else if (hp && (!hb || hp.distance < hb.distance)) select({ type: "person", id: hp.instanceId });
  else if (hb) select({ type: "building", id: hb.object.userData.b.index });
  else select(null);
});
addEventListener("keydown", (e) => { if (e.key === "Escape") select(null); });

function select(s) {
  selected = s;
  follow = false;
  $("inspect").style.display = s ? "block" : "none";
  renderInspector();
}

function needBars(p) {
  return Object.entries(p.needs).map(([k, v]) =>
    `<div class="need"><span>${k}</span><div class="bar"><i style="width:${v.toFixed(0)}%;background:${v < 25 ? "#d2552d" : ""}"></i></div></div>`).join("");
}

function renderInspector() {
  const el = $("inspect");
  if (!selected) return;
  if (selected.type === "journal") {
    const j = todayJournalPosts[selected.id];
    if (!j) { el.innerHTML = "<div class=\"muted\">Journal pin expired.</div>"; return; }
    el.innerHTML = `<h1>Journal pin</h1>
      <div class="muted">${j.name} · need: ${j.needId}</div>
      <blockquote style="margin:8px 0 0">${j.text}</blockquote>
      <div class="row"><button data-b="${j.home}">Show home</button></div>`;
  } else if (selected.type === "person") {
    const p = town.people[selected.id];
    const home = town.buildings[p.home];
    const job = p.job != null ? town.buildings[p.job].name : p.school != null ? town.buildings[p.school].name : "—";
    el.innerHTML = `<h1>${p.name}</h1>
      <div class="muted">${p.age} · ${p.trait} · $${p.money.toFixed(0)}</div>
      <div style="margin:8px 0"><b>${p.doing}</b></div>
      ${needBars(p)}
      <div class="muted" style="margin-top:8px">Lives at ${home.name}<br/>${p.age < 18 ? "School" : "Works at"}: ${job}</div>
      <div class="row"><button id="followBtn" class="${follow ? "on" : ""}">${follow ? "Following" : "Follow"}</button><button data-b="${p.home}">Show home</button></div>`;
    $("followBtn").onclick = () => { follow = !follow; renderInspector(); };
  } else {
    const b = town.buildings[selected.id];
    const s = b.state;
    const here = town.people.filter((p) => p.target === b.index && p.mode === "doing").length;
    const residents = b.kind === "home" ? town.people.filter((p) => p.home === b.index).length : null;
    el.innerHTML = `<h1>${b.name}</h1>
      <div class="muted">${b.kind}${b.area ? ` · ${Math.round(b.area)} m²` : ""}${town.source === "osm" && !b.id.startsWith("p") ? " · real footprint" : ""}</div>
      <div style="margin:8px 0">${here} people here now${residents != null ? ` · ${residents} residents` : ""}</div>
      ${s.maxStock ? `<div class="need"><span>stock</span><div class="bar"><i style="width:${(100 * s.stock) / s.maxStock}%"></i></div></div><div class="muted">Takings today-ish: $${s.cash}</div>` : ""}
      ${b.kind === "home" ? `<div class="muted">Fridge: ${s.fridge} meals</div>` : ""}
      ${b.kind === "park" ? `<div class="need"><span>litter</span><div class="bar"><i style="width:${s.litter}%;background:#b7871b"></i></div></div>` : ""}
      <div class="row">
        ${["food", "shop", "work", "school"].includes(b.kind) ? `<button id="toggleOpen">${s.open ? "Close it" : "Reopen"}</button>` : ""}
        ${s.maxStock ? `<button id="restock">Deliver stock</button>` : ""}
        ${b.kind === "park" ? `<button id="litterBtn">Dump litter</button>` : ""}
      </div>`;
    $("toggleOpen")?.addEventListener("click", () => { s.open = !s.open; world.log(`${b.name} ${s.open ? "reopened" : "closed"} (by you)`, "civic", b); renderInspector(); });
    $("restock")?.addEventListener("click", () => { s.stock = s.maxStock; world.log(`${b.name} got a delivery (by you)`, "restock", b); renderInspector(); });
    $("litterBtn")?.addEventListener("click", () => { s.litter = Math.min(100, s.litter + 40); renderInspector(); });
  }
  el.querySelectorAll("[data-b]").forEach((btn) => (btn.onclick = () => select({ type: "building", id: Number(btn.dataset.b) })));
}

$("feed").addEventListener("click", (e) => {
  const id = e.target.closest("[data-b]")?.dataset.b;
  if (id != null && id !== "") select({ type: "building", id: Number(id) });
});

/* ---------------------------------------------------------------- */
/* Loop                                                              */
/* ---------------------------------------------------------------- */
const night = new THREE.Color(0x1a1d2b), day = new THREE.Color(0xdfe7ee), sky = new THREE.Color();
let acc = 0, slowTimer = 0, lastEvents = -1;
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // Advance the simulation in whole game minutes.
  acc += dt * speed;
  const steps = Math.floor(acc);
  if (steps > 0) { world.step(Math.min(steps, 240)); acc -= steps; }

  // Once per simulated day per tile: publish a few synthetic resident journals.
  // Trigger after 8:00 local sim time so demos show the loop quickly.
  if (world.day() > lastJournalDay && world.minuteOfDay() >= 8 * 60) {
    publishSyntheticJournalsForDay(world.day());
  }

  // Day / night
  const m = world.minuteOfDay();
  const daylight = Math.max(0, Math.sin(((m - 6 * 60) / (14 * 60)) * Math.PI)); // 6am–8pm arc
  sky.copy(night).lerp(day, daylight);
  scene.background = sky;
  hemi.intensity = 0.25 + 0.9 * daylight;
  sun.intensity = 1.8 * daylight;
  const ang = ((m - 6 * 60) / (14 * 60)) * Math.PI;
  sun.position.set(Math.cos(ang) * 400, Math.max(40, Math.sin(ang) * 500), 200);

  // People
  // In the well-being and cycle overlays everyone is shown (indoors too), colored red→green.
  const wbOverlay = overlayMode === "wellbeing" || (overlayMode === "cycle" && cycleResult);
  const cycleScores = overlayMode === "cycle" && cycleResult ? cycleResult.scores[cycleView] : null;
  for (let i = 0; i < town.people.length; i++) {
    const p = town.people[i];
    const s = smooth[i];
    const k = 1 - Math.exp(-dt * 10);
    s.x += (p.x - s.x) * k;
    s.z += (p.z - s.z) * k;
    const visible = wbOverlay || p.mode === "moving" || OUTDOOR.has(p.action) || (selected?.type === "person" && selected.id === i);
    const scale = visible ? (p.age < 13 ? 0.7 : 1) * (wbOverlay ? 1.8 : 1) : 0;
    tmp.position.set(s.x, 0, s.z);
    tmp.scale.setScalar(scale);
    tmp.updateMatrix();
    people.setMatrixAt(i, tmp.matrix);
    const hex = cycleScores ? wellbeingHex(cycleScores[i] ?? 0)
      : wbOverlay ? wellbeingHex(wellbeing(p))
      : ACTION_COLOR[p.mode === "moving" ? "walking" : p.action || "idle"];
    people.setColorAt(i, color.setHex(hex));
  }
  people.instanceMatrix.needsUpdate = true;
  if (people.instanceColor) people.instanceColor.needsUpdate = true;

  // Selection + follow + name tag
  const tag = $("tag");
  if (selected?.type === "person") {
    const s = smooth[selected.id];
    ring.visible = true;
    ring.position.set(s.x, 0.3, s.z);
    if (follow) controls.target.lerp(new THREE.Vector3(s.x, 0, s.z), 0.1);
    const v = new THREE.Vector3(s.x, 12, s.z).project(camera);
    tag.style.display = "block";
    tag.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    tag.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    tag.textContent = `${town.people[selected.id].name} · ${town.people[selected.id].doing}`;
  } else if (selected?.type === "building") {
    const b = town.buildings[selected.id];
    ring.visible = true;
    ring.position.set(b.center[0], b.height + 0.5, b.center[1]);
    tag.style.display = "none";
  } else { ring.visible = false; tag.style.display = "none"; }

  for (const p of journalPins) p.mesh.visible = overlayMode === "journals";

  // Slower UI work ~4×/s
  slowTimer += dt;
  if (slowTimer > 0.25) {
    slowTimer = 0;
    updateBuildings(daylight);
    updateHud();
    updateOverlayLegend();
    if (selected) renderInspector();
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function updateBuildings(daylight) {
  const occupied = new Map();
  for (const p of town.people) if (p.mode === "doing" && p.target != null) occupied.set(p.target, (occupied.get(p.target) || 0) + 1);
  const floodSourceReal = area.floodZonesSource === "fema-nfhl";
  const walkByHome = new Map();
  for (const p of town.people) {
    const rec = walkByHome.get(p.home) || { sum: 0, n: 0 };
    rec.sum += Number(p.walkMinutesAvg3d || 0);
    rec.n += 1;
    walkByHome.set(p.home, rec);
  }
  for (const b of town.buildings) {
    const mat = b.mesh.material;
    const n = occupied.get(b.index) || 0;
    // Windows glow at night where people are inside; busy shops glow a little by day.
    mat.emissiveIntensity = b.kind === "park" ? 0 : Math.min(0.55, n * 0.08) * (1 - daylight * 0.7);
    const base = KIND_COLOR[b.kind];
    let c = base;
    if (b.state.flooded) c = 0x3d6fa6;
    else if (!b.state.open) c = 0x6f6f6f;
    else if (b.state.maxStock && b.state.stock < 5) c = 0x9a8f86;      // sold out: greyed

    if (overlayMode === "flood") {
      const z = String(b.floodZone || "X");
      if (floodSourceReal) {
        if (z === "AE" || z === "A" || z === "VE") c = b.state.flooded ? 0x2f5f90 : 0x5f88b4;
        else if (z === "X500") c = b.state.flooded ? 0x5f88b4 : 0x9fc0de;
      } else if (b.kind === "home" && !b.state.flooded && lowlandScore(b) < floodFractionNow()) c = 0x8fb6da;
    }
    if (overlayMode === "commute" && b.kind === "home") {
      const rec = walkByHome.get(b.index);
      const avg = rec?.n ? rec.sum / rec.n : 0;
      const t = Math.max(0, Math.min(1, avg / (WALK_COMPLAINT_MINUTES * 1.8)));
      const r = Math.round(60 + 180 * t);
      const g = Math.round(150 - 80 * t);
      const bl = Math.round(80 - 50 * t);
      c = (r << 16) | (g << 8) | bl;
    }
    else if (b.kind === "park") c = new THREE.Color(base).lerp(new THREE.Color(0x8a7a52), b.state.litter / 120).getHex();
    mat.color.setHex(c);
  }
}

function updateHud() {
  $("clock").textContent = clock(world.t);
  if (!journalInFlight) {
    if (world.day() <= lastJournalDay) journalDiag.status = "done for today";
    else if (world.minuteOfDay() < 8 * 60) journalDiag.status = "waiting for 08:00";
    else journalDiag.status = "pending";
    renderJournalDiagnostics();
  }
  const s = world.summary();
  $("mood").style.width = `${s.mood}%`;
  $("moodN").textContent = s.mood.toFixed(0);
  const top = Object.entries(s.doing).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const status = world.policy.floodedNow ? ` · ${world.policy.floodedNow} flooded parcels · ${world.policy.displaced} displaced` : "";
  $("counts").textContent = top.map(([k, v]) => `${v} ${k}`).join(" · ") + status;
  const rc = $("realConditions");
  if (rc) {
    if (!isHarrisCountyTile) {
      rc.textContent = "Real conditions panel is shown for Harris County tiles.";
    } else {
      const flood = measuredOutcomesLatest.flooding;
      const transit = measuredOutcomesLatest.transit;
      if (!flood) {
        rc.textContent = "Real data unavailable";
      } else {
        const pop = Math.max(1, town.people.length);
        const commuteShare = town.people.filter((p) => Number(p.walkMinutesAvg3d || p.today?.walkMinutes || 0) > WALK_COMPLAINT_MINUTES).length / pop;
        const floodSeveritySim = Math.max(0, Math.min(1, Number(world.policy?.displaced || 0) / (0.1 * pop)));
        const floodTxt = `${floodSeveritySim.toFixed(2)} sim vs ${Number(flood.severity).toFixed(2)} measured (${flood.year}, ${flood.source?.name || "source"})`;
        const transitTxt = transit
          ? `${commuteShare.toFixed(2)} sim vs ${Number(transit.value).toFixed(3)} measured (${transit.year}, ${transit.source?.name || "source"})`
          : `${commuteShare.toFixed(2)} sim vs n/a measured`;
        rc.textContent = `Flooding severity: ${floodTxt} · Commute share over ${WALK_COMPLAINT_MINUTES}m: ${transitTxt}`;
      }
    }
  }

  if (world.events.length && world.events[0] !== lastEvents) {
    lastEvents = world.events[0];
    $("feed").innerHTML = world.events.slice(0, 25)
      .map((e) => `<div data-b="${e.building ?? ""}"><b>${clock(e.t).replace(/^\w+ /, "")}</b>${e.text}</div>`).join("");
  }
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

world.log(`Welcome to ${origin.lat.toFixed(3)}, ${origin.lng.toFixed(3)}. Click a person or building.`, "info");
requestAnimationFrame(frame);
