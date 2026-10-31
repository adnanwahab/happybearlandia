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

const BASE_POLICY_PACKAGES = {
  none: { label: "No package", speedMult: 1, floodMitigation: 0, housingGrowth: 0, source: "local" },
  t_brt: { label: "BRT corridor", speedMult: 1.8, floodMitigation: 0, housingGrowth: 0, source: "local" },
  h_lots: { label: "Lot reform", speedMult: 1.05, floodMitigation: 0, housingGrowth: 0.35, source: "local" },
  f_drainage: { label: "Drainage investment", speedMult: 1, floodMitigation: 0.16, housingGrowth: 0, source: "local" },
  balanced: { label: "Balanced package", speedMult: 1.45, floodMitigation: 0.1, housingGrowth: 0.2, source: "local" },
};

let PLAN_PACKAGES = { ...BASE_POLICY_PACKAGES };
world.policy = { id: "none", ...PLAN_PACKAGES.none, displaced: 0, floodedNow: 0 };

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

function derivePolicyProfile(name, id, proposalIds) {
  let speedMult = 1, floodMitigation = 0, housingGrowth = 0;
  for (const pid0 of proposalIds) {
    const pid = String(pid0).toLowerCase();
    if (pid === "t_brt" || pid.includes("brt") || pid.includes("transit")) speedMult = Math.max(speedMult, 1.8);
    if (pid === "f_drainage" || pid.includes("drain") || pid.includes("flood")) floodMitigation += 0.16;
    if (pid === "h_lots" || pid.includes("lot") || pid.includes("housing")) housingGrowth += 0.35;
  }
  return {
    id,
    label: name,
    speedMult: Math.min(2.2, speedMult),
    floodMitigation: Math.min(0.35, floodMitigation),
    housingGrowth: Math.min(1.5, housingGrowth),
    source: "dear-congress",
    proposalIds,
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

function applyPolicy(id) {
  const k = PLAN_PACKAGES[id] ? id : "none";
  const p = PLAN_PACKAGES[k];
  world.policy = { ...world.policy, id: k, label: p.label, speedMult: p.speedMult, floodMitigation: p.floodMitigation, housingGrowth: p.housingGrowth, source: p.source };
  world.speedMult = p.speedMult;
  const src = p.source === "dear-congress" ? " · source: dear-congress" : " · source: local";
  $("policyNote").textContent = `${p.label} · transit ×${p.speedMult.toFixed(2)} · flood mitigation ${Math.round(p.floodMitigation * 100)}% · housing growth ${Math.round(p.housingGrowth * 100)}%${src}`;
  world.log(`Policy package set: ${p.label}`, "civic");
}

async function loadPolicyPackages() {
  const q = new URLSearchParams({ lat: String(origin.lat), lng: String(origin.lng) }).toString();
  const explicit = params.get("plans");
  const candidates = [
    ...(explicit ? [explicit] : []),
    `/api/dear-congress/packages?${q}`,
    `/api/dear-congress/package-results?${q}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const payload = await res.json();
      const rows = packageRows(payload);
      if (!Array.isArray(rows) || !rows.length) continue;

      const next = { ...BASE_POLICY_PACKAGES };
      let n = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row?.name || row?.title || row?.label || `Package ${i + 1}`;
        const id = slug(row?.id || row?.slug || name);
        const items = row?.items || row?.proposals || row?.package?.items || [];
        const proposalIds = Array.from(new Set(items.map(proposalIdFrom).filter(Boolean)));
        if (!proposalIds.length) continue;
        next[id] = derivePolicyProfile(name, id, proposalIds);
        n++;
      }
      if (!n) continue;

      PLAN_PACKAGES = next;
      refreshPolicySelect("none");
      world.log(`Loaded ${n} plan packages from dear-congress`, "civic");
      return true;
    } catch {
      // try next endpoint
    }
  }
  world.log("Could not load dear-congress packages; using local policy presets", "info");
  refreshPolicySelect("none");
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

$("policy").onchange = (e) => applyPolicy(e.target.value);
$("stormBtn").onclick = () => triggerStorm();
await loadPolicyPackages();
applyPolicy($("policy").value || "none");

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
