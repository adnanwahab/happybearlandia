import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildTown } from "./gen.js";
import { createWorld, clock } from "./sim.js";

/* ---------------------------------------------------------------- */
/* Where are we?  /world?lat=29.7286&lng=-95.4746&people=500         */
/* ---------------------------------------------------------------- */
const params = new URLSearchParams(location.search);

function parseCoord(raw, fallback) {
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
let area = { source: "none" };
try {
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
$("source").textContent = town.source === "osm"
  ? `${town.buildings.length} real buildings (${town.attribution}) · ${town.people.length} synthetic residents`
  : area.error
    ? `Couldn't load map data (${area.error}), so this is a procedural town · ${town.people.length} synthetic residents`
    : `No map data here, so this is a procedural town · ${town.people.length} synthetic residents`;
$("loading").remove();

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
let selected = null; // { type: "person"|"building", id }
let follow = false;
for (const btn of $("speeds").children) btn.onclick = () => {
  speed = Number(btn.dataset.s);
  for (const b of $("speeds").children) b.classList.toggle("on", b === btn);
};

const POLICY_RULES = {
  t_bus: { label: "Bus frequency", lagYears: 0, rampYears: 2, speedAdd: 0.45 },
  t_brt: { label: "BRT corridor", lagYears: 2, rampYears: 2, speedAdd: 0.8 },
  h_lots: { label: "Lot reform", lagYears: 1, rampYears: 5, housingGrowthAdd: 0.35 },
  h_vouchers: { label: "Housing vouchers", lagYears: 0, rampYears: 1, voucherMonthlyAdd: 35 },
  s_311: { label: "311 service", lagYears: 0, rampYears: 1, parkCleanupAdd: 0.65 },
  f_drainage: { label: "Drainage investment", lagYears: 2, rampYears: 4, floodMitigationAdd: 0.16 },
  f_buyouts: { label: "Floodplain buyouts", lagYears: 1, rampYears: 3, floodMitigationAdd: 0.12 },
  sb_filing: { label: "Small-biz filing", lagYears: 0, rampYears: 2, restockBoostAdd: 0.2, hiringBoostAdd: 0.1 },
  sb_payroll: { label: "Small-biz payroll", lagYears: 1, rampYears: 2, restockBoostAdd: 0.2, hiringBoostAdd: 0.2 },
};

const BASE_POLICY_PACKAGES = {
  none: {
    id: "none",
    label: "No package",
    source: "local",
    proposalIds: [],
    effects: { speedMult: 1, floodMitigation: 0, housingGrowth: 0, voucherMonthly: 0, parkCleanupBoost: 0, restockBoost: 0, hiringBoost: 0 },
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

function effectProgress(lagYears, rampYears, year) {
  if (year < lagYears) return 0;
  if (!Number.isFinite(rampYears) || rampYears <= 0) return 1;
  return Math.max(0, Math.min(1, (year - lagYears) / rampYears));
}

const NOT_SIMULATED = new Set([
  "cc_credit", "cc_subsidy", "cc_licensing", "cc_public",
  "h_transit", "h_residency",
  "hc_chc", "hc_public", "mh_workforce", "mh_988",
  "i_roofs", "i_reinsurance", "fx_taxcut", "fx_review",
]);

function resolveRuleForProposal(pid0) {
  const pid = String(pid0 || "").toLowerCase();
  if (POLICY_RULES[pid]) return { id: pid, rule: POLICY_RULES[pid] };
  // Known dear-congress catalog items the world doesn't model yet. Listed so the fuzzy
  // matching below can't misfire on them (e.g. h_transit is housing, not buses).
  if (NOT_SIMULATED.has(pid)) return null;
  if (pid.includes("brt")) return { id: "t_brt", rule: POLICY_RULES.t_brt };
  if (pid.includes("bus") || pid.includes("transit")) return { id: "t_bus", rule: POLICY_RULES.t_bus };
  if (pid.includes("lot") || pid.includes("zoning") || pid.includes("housing")) return { id: "h_lots", rule: POLICY_RULES.h_lots };
  if (pid.includes("voucher")) return { id: "h_vouchers", rule: POLICY_RULES.h_vouchers };
  if (pid.includes("311") || pid.includes("clean")) return { id: "s_311", rule: POLICY_RULES.s_311 };
  if (pid.includes("drain") || pid.includes("flood")) return { id: "f_drainage", rule: POLICY_RULES.f_drainage };
  if (pid.includes("buyout")) return { id: "f_buyouts", rule: POLICY_RULES.f_buyouts };
  if (pid.includes("payroll")) return { id: "sb_payroll", rule: POLICY_RULES.sb_payroll };
  if (pid.includes("filing") || pid.includes("permit") || pid.includes("small") || pid.startsWith("sb_")) return { id: "sb_filing", rule: POLICY_RULES.sb_filing };
  return null;
}

function computeEffectsForYear(proposalIds, year) {
  const effects = {
    speedMult: 1,
    floodMitigation: 0,
    housingGrowth: 0,
    voucherMonthly: 0,
    parkCleanupBoost: 0,
    restockBoost: 0,
    hiringBoost: 0,
  };
  const unsupported = [];

  for (const pid of proposalIds) {
    const mapped = resolveRuleForProposal(pid);
    if (!mapped) {
      unsupported.push(pid);
      continue;
    }
    const p = effectProgress(mapped.rule.lagYears, mapped.rule.rampYears, year);
    effects.speedMult += (mapped.rule.speedAdd || 0) * p;
    effects.floodMitigation += (mapped.rule.floodMitigationAdd || 0) * p;
    effects.housingGrowth += (mapped.rule.housingGrowthAdd || 0) * p;
    effects.voucherMonthly += (mapped.rule.voucherMonthlyAdd || 0) * p;
    effects.parkCleanupBoost += (mapped.rule.parkCleanupAdd || 0) * p;
    effects.restockBoost += (mapped.rule.restockBoostAdd || 0) * p;
    effects.hiringBoost += (mapped.rule.hiringBoostAdd || 0) * p;
  }

  effects.speedMult = Math.min(2.6, Math.max(1, effects.speedMult));
  effects.floodMitigation = Math.min(0.45, Math.max(0, effects.floodMitigation));
  effects.housingGrowth = Math.min(1.8, Math.max(0, effects.housingGrowth));
  effects.voucherMonthly = Math.min(120, Math.max(0, effects.voucherMonthly));
  effects.parkCleanupBoost = Math.min(1.2, Math.max(0, effects.parkCleanupBoost));
  effects.restockBoost = Math.min(1.1, Math.max(0, effects.restockBoost));
  effects.hiringBoost = Math.min(0.8, Math.max(0, effects.hiringBoost));

  return { effects, unsupported: Array.from(new Set(unsupported)) };
}

function derivePolicyProfile(name, id, proposalIds, source = "dear-congress") {
  const full = computeEffectsForYear(proposalIds, 10);
  return {
    id,
    label: name,
    source,
    proposalIds,
    effects: full.effects,
    unsupported: full.unsupported,
  };
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

  const src = p.source === "dear-congress" ? "dear-congress" : "local";
  const pendingTxt = staged.unsupported.length
    ? ` · not simulated yet: ${staged.unsupported.slice(0, 4).join(", ")}${staged.unsupported.length > 4 ? "…" : ""}`
    : "";

  $("policyNote").textContent = `${p.label} · year ${year} · transit ×${staged.effects.speedMult.toFixed(2)} · flood mitigation ${Math.round(staged.effects.floodMitigation * 100)}% · housing growth ${Math.round(staged.effects.housingGrowth * 100)}% · vouchers $${staged.effects.voucherMonthly.toFixed(0)}/mo · source: ${src}${pendingTxt}`;
}

async function loadPolicyPackages() {
  const explicit = params.get("plans");
  const q = new URLSearchParams({ lat: String(origin.lat), lng: String(origin.lng) }).toString();
  const attempts = [
    // Count this world's simulated residents' journals when synthesizing (dear-congress
    // leaves them out by default). Add ?synthetic=0 to see the plan from real journals only.
    { kind: "post", url: "/api/plan", body: JSON.stringify({ includeSynthetic: params.get("synthetic") !== "0" }) },
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
      const rows = packageRows(payload);
      if (!Array.isArray(rows) || !rows.length) continue;

      const next = { none: BASE_POLICY_PACKAGES.none };
      let n = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row?.name || row?.title || row?.label || row?.packageName || `Package ${i + 1}`;
        const id = slug(row?.id || row?.slug || name);
        const items = row?.items || row?.proposals || row?.package?.items || [];
        const proposalIds = Array.from(new Set(items.map(proposalIdFrom).filter(Boolean)));
        if (!proposalIds.length) continue;
        next[id] = derivePolicyProfile(name, id, proposalIds, "dear-congress");
        n++;
      }
      if (!n) continue;

      PLAN_PACKAGES = next;
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
  const baseFlood = 0.24;
  const cut = Math.max(0.04, baseFlood - world.policy.floodMitigation);
  let floodedNow = 0;
  for (const b of town.buildings) {
    if (b.kind === "park") { b.state.flooded = false; continue; }
    b.state.flooded = lowlandScore(b) < cut;
    if (b.state.flooded) floodedNow++;
  }

  let displaced = 0;
  for (const p of town.people) {
    const home = town.buildings[p.home];
    if (!home?.state?.flooded) continue;
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
  world.log(`Storm hit: ${floodedNow} parcels flooded, ${displaced} residents displaced`, "civic");
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

const tileKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;
const journalDayStorageKey = `hbl:world:journal-day:${tileKey}`;
let lastJournalDay = Number(localStorage.getItem(journalDayStorageKey) ?? -1);
if (!Number.isFinite(lastJournalDay)) lastJournalDay = -1;
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

function worstNeedLabel(p) {
  const entries = Object.entries(p?.needs || {});
  if (!entries.length) return "general stress";
  entries.sort((a, b) => a[1] - b[1]);
  const [k] = entries[0];
  return ({ hunger: "food insecurity", energy: "exhaustion", fun: "burnout", social: "isolation" })[k] || "general stress";
}

function recentFrustration() {
  const e = (world.events || []).find((x) => ["soldout", "litter", "fridge", "civic"].includes(x.kind));
  return e?.text || null;
}

function makeJournalText(p, frustration) {
  const low = worstNeedLabel(p);
  const weather = world.policy?.floodedNow ? ` After the storm, ${world.policy.floodedNow} parcels flooded.` : "";
  const local = frustration ? ` Today I noticed: ${frustration}.` : "";
  return `${p.name} from tile ${tileKey}: I'm worried about ${low}.${local}${weather} I want policies that improve daily life in this neighborhood.`;
}

async function publishSyntheticJournalsForDay(day) {
  if (journalInFlight) return;
  journalInFlight = true;
  journalDiag.day = day;
  journalDiag.status = "publishing";
  renderJournalDiagnostics();

  try {
    const byMood = [...town.people]
      .map((p, i) => ({ p, i, mood: residentMood(p) }))
      .sort((a, b) => a.mood - b.mood);
    const unhappy = byMood.filter((x) => x.mood < 50).slice(0, 3);
    const picked = unhappy.length ? unhappy : byMood.slice(0, 2);

    if (!picked.length) {
      journalDiag.attempted = 0;
      journalDiag.posted = 0;
      journalDiag.status = "no candidates";
      journalDiag.lastError = null;
      lastJournalDay = day;
      localStorage.setItem(journalDayStorageKey, String(day));
      renderJournalDiagnostics();
      return;
    }

    const frustration = recentFrustration();
    journalDiag.attempted = picked.length;
    journalDiag.posted = 0;
    journalDiag.lastError = null;

    let ok = 0;
    for (const { p, i, mood } of picked) {
      const text = makeJournalText(p, frustration);
      const payload = {
        kind: "journal",
        synthetic: true,
        source: "happybearlandia-world",
        tileId: tileKey,
        day,
        residentId: String(p.id ?? i),
        title: `Journal · ${p.name}`,
        text,
        body: text,
        content: text,
        metadata: {
          lat: origin.lat,
          lng: origin.lng,
          policyId: world.policy?.id || "none",
          policyYear,
          mood: Number(mood.toFixed(1)),
          needs: p.needs,
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
        if (res.ok) ok++;
      } catch (err) {
        journalDiag.lastError = String(err?.message || err || "request failed");
        // continue posting next resident
      }
      journalDiag.posted = ok;
      renderJournalDiagnostics();
    }

    lastJournalDay = day;
    localStorage.setItem(journalDayStorageKey, String(day));
    journalDiag.status = ok > 0 ? "published" : "upstream unavailable";
    if (ok > 0) journalDiag.lastError = null;
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
  if (hp && (!hb || hp.distance < hb.distance)) select({ type: "person", id: hp.instanceId });
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
  if (selected.type === "person") {
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
  for (let i = 0; i < town.people.length; i++) {
    const p = town.people[i];
    const s = smooth[i];
    const k = 1 - Math.exp(-dt * 10);
    s.x += (p.x - s.x) * k;
    s.z += (p.z - s.z) * k;
    const visible = p.mode === "moving" || OUTDOOR.has(p.action) || (selected?.type === "person" && selected.id === i);
    const scale = visible ? (p.age < 13 ? 0.7 : 1) : 0;
    tmp.position.set(s.x, 0, s.z);
    tmp.scale.setScalar(scale);
    tmp.updateMatrix();
    people.setMatrixAt(i, tmp.matrix);
    people.setColorAt(i, color.setHex(ACTION_COLOR[p.mode === "moving" ? "walking" : p.action || "idle"]));
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

  // Slower UI work ~4×/s
  slowTimer += dt;
  if (slowTimer > 0.25) {
    slowTimer = 0;
    updateBuildings(daylight);
    updateHud();
    if (selected) renderInspector();
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function updateBuildings(daylight) {
  const occupied = new Map();
  for (const p of town.people) if (p.mode === "doing" && p.target != null) occupied.set(p.target, (occupied.get(p.target) || 0) + 1);
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
