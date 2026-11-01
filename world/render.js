import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildTown } from "./gen.js";
import { createWorld, clock } from "./sim.js";
import { journalFor, WALK_COMPLAINT_MINUTES } from "./journal.js";
import { computeEffectsForYear, derivePolicyProfile } from "./policy.js";

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
const buildingsById = {};
for (const b of town.buildings) {
  buildingsById[b.index] = b;
  buildingsById[b.id] = b;
}
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

function lineChartSvg(title, byPkg, key, colorByPkg) {
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

  const xTicks = [0, 5, 10].map((x) => {
    const xx = pad + (x / 10) * (w - pad * 2);
    return `<text x="${xx}" y="${h - 6}" text-anchor="middle" fill="currentColor" opacity="0.65" font-size="10">${x}</text>`;
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

  charts.innerHTML = [
    lineChartSvg("Flooded parcels", byPkg, "floodedParcels", colors),
    lineChartSvg("Displaced residents", byPkg, "displacedResidents", colors),
    lineChartSvg("Commute / walk minutes", byPkg, "avgWalkMinutes", colors),
    lineChartSvg("Mood", byPkg, "avgMood", colors),
  ].join("");

  const rows = EXP_PACKAGES.map((name) => {
    const hist = byPkg[name] || [];
    const y10 = hist.find((r) => r.year === 10) || hist[hist.length - 1] || { outcomes: {} };
    const plans = results?.[name]?.plansByYear || [];
    const p1 = (plans.find((p) => p.year === 1)?.proposalIds || []).join(", ") || "—";
    const p5 = (plans.find((p) => p.year === 5)?.proposalIds || []).join(", ") || "—";
    const p10 = (plans.find((p) => p.year === 10)?.proposalIds || []).join(", ") || "—";
    return `<tr>
      <th>${name}</th>
      <td>${Number(y10.outcomes.floodedParcels ?? 0).toFixed(0)}</td>
      <td>${Number(y10.outcomes.displacedResidents ?? 0).toFixed(0)}</td>
      <td>${Number(y10.outcomes.avgWalkMinutes ?? 0).toFixed(1)}</td>
      <td>${Number(y10.outcomes.avgMood ?? 0).toFixed(1)}</td>
      <td>${p1}</td>
      <td>${p5}</td>
      <td>${p10}</td>
    </tr>`;
  }).join("");

  tableWrap.innerHTML = `<table class="exp-table">
    <thead><tr><th>Package</th><th>Flooded (Y10)</th><th>Displaced (Y10)</th><th>Walk min (Y10)</th><th>Mood (Y10)</th><th>Items Y1</th><th>Items Y5</th><th>Items Y10</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  panel.style.display = "block";
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
      setExperimentStatus(`Running ${pkg}: year ${msg.year}/10 (${msg.donePackages + 1}/3 packages)`);
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
      seed: experimentSeed,
    },
  });
}

$("runExperimentBtn")?.addEventListener("click", runExperiment10Years);

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
      if (text) candidates.push({
        p: probe,
        i,
        mood: residentMood(p),
        text,
        hasFlood: !!(sourceDay.displaced || sourceDay.homeFlooded),
      });
    }

    const ranked = candidates.sort((a, b) => a.mood - b.mood);
    const picked = ranked.slice(0, 3);
    const floodIdx = picked.findIndex((x) => x.hasFlood);
    if (floodIdx < 0) {
      const floodCandidate = ranked.find((x) => x.hasFlood);
      if (floodCandidate && picked.length) picked[picked.length - 1] = floodCandidate;
    }

    if (!picked.length) {
      journalDiag.attempted = 0;
      journalDiag.posted = 0;
      journalDiag.status = "no candidates";
      journalDiag.lastError = null;
      lastJournalDay = day;
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
      renderJournalDiagnostics();
      return;
    }

    journalDiag.attempted = picked.length;
    journalDiag.posted = 0;
    journalDiag.lastError = null;

    let ok = 0;
    for (const { p, i, mood, text } of picked) {
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
        if (res.ok) ok++;
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
