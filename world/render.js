import {mountAPIGeometryDetails} from './geometry-inspector.js';
import {journalCity} from './journals/presets.js';
import {createJournalRecorder,mountCharacterJournal} from './journals/client.js';
import {ensureJournal,journalPage,journalText,pruneSavedJournals} from './journals/model.js';
import {legacySocial} from './relationships/model.js';
import {renderRelationships} from './relationships/panel.js';
import { mountConstitutionWorldHost } from './constitution-city/host.js';
import { mountConstitutionComparison } from './constitution-visuals.js';
import * as THREE from "three";
import { createPhysicalPolicyLayer } from "./render/physical-policy-layer.js";
import { createHumanInstances } from "./render/people/human-renderer.js";
import { householdForPerson, commuteBurdenMinutes } from "./simulation-observations.js";
import { createSimulationPlayback } from "./simulation-playback.js";
import { personNeedsMarkup } from "./person-needs.js";
import { mountLivingWorld } from "./population/world-view.js";
import { createTrackedWorker } from "./workers/worker-registry.js";
import { mountMinimap } from "./minimap.js";
import { mountVehicleInspector } from "./vehicle-inspector.js";
import { mountMapControls } from "./map-controls.js";
import { mountFpsMeter } from "./fps-meter.js";
import { createMapStreamer } from "./render/map-streamer.js";
import { mountTileNavigation, adjacentNavigationQuery, geographicTileBounds } from "./tile-navigation.js";
import { createProgressiveLoader } from "./render/progressive-loader.js";
import { generateBuildingGeometry } from "./render/geometry/building-generator.js";
import { GeometryCache, toBufferGeometry } from "./render/geometry/geometry-cache.js";
import { benchmarkScene, configureBenchmark } from "./render/bench/scenes.js";
import { mountWorldBuildingBridge } from "./buildings/world-bridge.js";
import { mountNeighborhoodWhatIf } from "./what-if/panel.js";
import { mountBusinessMode } from "./business-mode.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCityRenderer } from "./render/renderer/webgpu-renderer.js";
import { mountCityRenderer } from "./render/city-renderer.js";
import { createFacadeMaterial } from "./render/buildings/facade-material.js";
import { buildTown, projector, hashSeed } from "./gen.js";
import { createWorld, clock, legacyNeedSnapshot } from "./sim.js";
import { journalFor, WALK_COMPLAINT_MINUTES } from "./journal.js";
import { computeEffectsForYear, derivePolicyProfile } from "./policy.js";
import { wellbeing, wellbeingHex } from "./wellbeing.js";
import { replayStormStrengthLabel } from "./replay-label.js";

/* ---------------------------------------------------------------- */
/* Where are we?  /world?lat=29.7286&lng=-95.4746&people=500         */
/* ---------------------------------------------------------------- */
const params = new URLSearchParams(location.search);
let loadedExperiment=null;
const savedExperimentId=params.get('experiment');
if(savedExperimentId){
 try{if(!/^[A-Za-z0-9_-]{8,16}$/.test(savedExperimentId))throw Error('Invalid saved experiment ID');const response=await fetch('/api/world-experiments/'+encodeURIComponent(savedExperimentId));const record=await response.json();if(!response.ok)throw Error(record.error||'Experiment load failed');if(record.schemaVersion!=='world-experiment-record.v1'||record.save?.schemaVersion!=='world-experiment-save.v1')throw Error('Unsupported saved experiment');loadedExperiment=record;}
 catch(error){const warning=document.createElement('p');warning.style.cssText='position:fixed;inset:20px;z-index:999;background:#18283b;color:white;padding:24px';warning.textContent='Saved experiment could not load: '+error.message+'. No replacement simulation was started.';document.body.append(warning);throw error;}
}
const renderBenchmark = benchmarkScene(location.pathname);
const demoMode = params.get("demo") === "1" || !!renderBenchmark;
const businessMode = params.get("business_mode") === "true" || params.get("business_mode") === "1";

// /world?simulation=…&reality=N enters one reality from the realities page (index.html
// sends a link without &reality to /world/realities.html before this module loads).
const simulationId = params.get("simulation");
const realityIndex = params.get("reality");
const realityRunSeed = simulationId && realityIndex != null && params.get("seed")
  ? `${params.get("seed")}:reality:${Number(realityIndex)}`
  : null;
// ?embed=1: a bare world for the "all possible worlds" grid (no panels, lighter rendering,
// reports its clock and mood to the parent page).
const embedMode = params.get("embed") === "1";
if (embedMode) document.documentElement.classList.add("embed");

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
  lat: loadedExperiment?.save.view.origin.lat??parseCoord(params.get("lat"), 29.7286),
  lng: loadedExperiment?.save.view.origin.lng??parseCoord(params.get("lng"), -95.4746),
};
const savedSyntheticHome = loadedExperiment?.save.mode === "living" && loadedExperiment.save.geometry.area.source === "synthetic";
const requestedPeople = Number(loadedExperiment?.save.view.maxPeople??loadedExperiment?.save.checkpoint.people?.length??params.get("people") ?? (savedSyntheticHome ? 1 : 2000));
const maxPeople = Number.isFinite(requestedPeople) ? Math.max(1, Math.min(3000, Math.floor(requestedPeople))) : 2000;
const $ = (id) => document.getElementById(id);
if(!embedMode){const routesLink=document.createElement('a');routesLink.href='/routes';routesLink.textContent='All routes';routesLink.style.cssText='display:inline-block;margin:4px 8px';$('top').append(routesLink);}
$("latlng").value = `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`;

function go(lat, lng, cameraState = null, tileBounds = null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const q = adjacentNavigationQuery(location.search, {lat,lng}, cameraState);
  if (!cameraState) q.delete("tileCamera");
  if (tileBounds?.radiusM) q.set("tileRadiusM",String(tileBounds.radiusM));
  else if (!cameraState) q.delete("tileRadiusM");
  location.search = q.toString();
}
$("goto").onsubmit = (e) => {
  e.preventDefault();
  const [a, b] = $("latlng").value.split(/[ ,]+/).map(Number);
  go(a, b);
};
$("preset").onchange = (e) => { if (e.target.value) { const [a, b] = e.target.value.split(",").map(Number); go(a, b); } };
$("here").onclick = () => navigator.geolocation?.getCurrentPosition((p) => go(p.coords.latitude, p.coords.longitude));

const startup = window.hblWorldStartup = { startedAt:performance.now(), firstFrameMs:null, mapReadyMs:null, placeholdersReadyMs:null, geometryReadyMs:null, readyMs:null, geometry:null, cancelled:false };
const startupAbort = new AbortController();
let policyPending=false;
const startupDisabled=new Map([...document.querySelectorAll('#stormBtn,#runExperimentBtn,#runCycleBtn,#demoBtn,#policy')].map(node=>[node,node.disabled]));
for(const node of startupDisabled.keys())node.disabled=true;
let buildingDateBridge=null,buildingDatePanel=null,buildingDateLastRefresh=0;
let startupCityRenderer=null,startupLastFrame=null;
let startupActive=true,startupRAF=null,manualPanRequested=false,streamingEnabled=false;
const initialAreaRequest=(async()=>{
  if(loadedExperiment)return structuredClone(loadedExperiment.save.geometry.area);
  if(demoMode)return {source:"none"};
  try {
    const tileRadius=Number(params.get("tileRadiusM")),radiusQuery=[150,250,400].includes(tileRadius)?`&radiusM=${tileRadius}`:'';
    const response=await fetch(`/api/area?lat=${origin.lat}&lng=${origin.lng}${radiusQuery}&core=1`,{signal:AbortSignal.any([startupAbort.signal,AbortSignal.timeout(12000)])});
    return response.ok?await response.json():{source:"none",error:`area HTTP ${response.status}`};
  }catch(error){return {source:"none",error:`area request failed: ${error.message}`};}
})();

const forceWebGL = params.get("renderer") === "webgl" || (loadedExperiment?.save.mode === "living" && !navigator.gpu);
const useMainWorldGPU = loadedExperiment?.save.mode !== "living" && !forceWebGL && !params.has("living") && !businessMode && !embedMode;
let graphics;
try {
  graphics = useMainWorldGPU
    ? await (await import("./world-gpu.js")).createWorldGPU({ antialias: !embedMode })
    : await createCityRenderer({ forceWebGL, antialias: !embedMode });
} catch (error) {
  if (!useMainWorldGPU) {
    const loading = $('loading');
    loading.setAttribute('role', 'alert');
    loading.textContent = '3D World could not start. Check that WebGL2 and hardware acceleration are available.';
    if (loadedExperiment && params.has('person')) {
      const link = document.createElement('a');
      link.href = '/tools/future-journey.html?' + params;
      link.textContent = 'Return to Worldline';
      loading.append(' ', link);
    }
  }
  throw error;
}
const { renderer, mode: rendererMode } = graphics;
renderer.setSize(innerWidth, innerHeight);
$("view").appendChild(renderer.domElement);


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 5000);
camera.position.set(320, 125, 450);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 30, 0);
controls.maxPolarAngle = Math.PI * 0.47;
controls.enableDamping = true;
const resizeWorldView = () => {camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
addEventListener("resize",resizeWorldView);

const mapControls=mountMapControls({container:document.body,camera,controls,THREE,buttons:false,onPan:()=>{manualPanRequested=true;streamingEnabled=true;}});
window.hblMapControls=mapControls;
const fpsMeter=mountFpsMeter({container:document.body});
addEventListener("pagehide",()=>{mapControls.destroy();fpsMeter.destroy();},{once:true});
// Adjacent neighborhoods retain the local view orientation and zoom.
try {
  const view = JSON.parse(params.get("tileCamera") || "null");
  if (view && [view.position,view.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<100000))) {
    camera.position.fromArray(view.position);controls.target.fromArray(view.target);controls.update();
  }
} catch {}
// In the grid, let the mouse wheel scroll the page instead of zooming each tiny world.
if (embedMode) controls.enableZoom = false;

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -280, right: 280, top: 280, bottom: -280, far: 1500 });
sun.shadow.normalBias = .08;sun.shadow.bias = -.00015;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshLambertMaterial({ color: 0x626b50 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);


scene.background=new THREE.Color(0xbcd3df);
function drawStartupFrame(now){if(!startupActive||startupAbort.signal.aborted)return;const started=performance.now(),frameMs=startupLastFrame===null?0:now-startupLastFrame;startupLastFrame=now;mapControls.update(now);fpsMeter.update(now);controls.update();startupCityRenderer?.beforeFrame(now,0,1,null,{}, {now:0,dt:0});renderer.render(scene,camera);if(frameMs>0)startupCityRenderer?.afterFrame(now,performance.now()-started,frameMs);startup.firstFrameMs??=performance.now();startupRAF=requestAnimationFrame(drawStartupFrame);}
requestAnimationFrame(drawStartupFrame);
addEventListener("pagehide",()=>{startup.cancelled=true;startupAbort.abort();startupActive=false;if(startupRAF!==null)cancelAnimationFrame(startupRAF);removeEventListener("resize",resizeWorldView);},{once:true});

/* ---------------------------------------------------------------- */
/* Load map data → synthetic town → world                            */
/* ---------------------------------------------------------------- */
// ?demo=1 pins the town: skip OpenStreetMap so the procedural town (and the story
// the demo tells) is identical on every machine, regardless of what Overpass returns.

let area = await initialAreaRequest;
const originalAreaGeometry=structuredClone(area);
startup.mapReadyMs=performance.now();
const town = buildTown(origin, area, { maxPeople, savedGeometry: savedSyntheticHome });
mountConstitutionComparison({ THREE, scene, camera, controls, town, params });
const world = createWorld(town, { journalsEnabled:!embedMode&&!realityRunSeed&&Boolean(journalCity(origin)),recordHistory:!embedMode, ...(realityRunSeed ? { runSeed:realityRunSeed } : {}) });
const legacyJournalCity=journalCity(origin),legacyJournalRun=`legacy:${crypto.randomUUID()}`;
const legacyJournalRecorder=world.journals?createJournalRecorder({city:legacyJournalCity,mode:'legacy',getRunId:()=>legacyJournalRun,getMinute:()=>world.t,getPage:query=>{for(const p of world.people)ensureJournal(world.journals,String(p.id),p.name,world.t);return journalPage(world.journals,query);},onSaved:minute=>pruneSavedJournals(world.journals,minute,world.t)}):null;
if(legacyJournalRecorder)void legacyJournalRecorder.flush(true);

// Metadata is read-only; loading it never starts another simulation.
window.hblSimulationModel={status:'loading',authority:'legacy-authoritative compatibility model'};
void Promise.all([import('./simulation-parameters.js'),import('./simulation-observations.js')]).then(([parameters,observations])=>{
 const parameterData=Object.fromEntries(Object.entries(parameters).filter(([,value])=>typeof value!=='function'));
 const observed=observations.createSimulationObservationCollector().result().observations;
 const metadata={status:'ready',authority:'legacy-authoritative compatibility model',parameters:parameterData,configuredParameters:structuredClone(world.parameters),observations:{schemaVersion:observed.schemaVersion,methods:observed.methods,limitations:observed.limitations},limits:['Daily legacy residents, living population and monthly Constitution forecasts remain separate simulation authorities.','Representative five-day annual samples carry state forward; unsampled days do not accrue economic or demographic changes.']};
 window.hblSimulationModel=metadata;
 const container=$('simulationModelMetadata');if(!container)return;container.replaceChildren();
 const note=document.createElement('p');note.textContent='Registered synthetic assumptions and observation definitions. No second model is advanced by this disclosure.';container.append(note);
 for(const[key,value]of Object.entries({parameters:metadata.parameters,observationMethods:metadata.observations.methods,limitations:[...metadata.observations.limitations,...metadata.limits]})){const detail=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=key;pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify(value,null,2);detail.append(summary,pre);container.append(detail);}
}).catch(error=>{window.hblSimulationModel={status:'unavailable',authority:'legacy-authoritative compatibility model',error:error.message};const container=$('simulationModelMetadata');if(container)container.textContent=`Model metadata unavailable: ${error.message}`;});
const isHarrisCountyTile = origin.lat >= 29.3 && origin.lat <= 30.25 && origin.lng >= -95.95 && origin.lng <= -94.9;
let measuredOutcomesLatest = {};
const geoProj = projector(origin);
const buildingsById = {};
for (const b of town.buildings) {
  buildingsById[b.index] = b;
  buildingsById[b.id] = b;
}
const floodSourceTxt = area.floodZonesStatus === "pending" ? "FEMA flood zones loading; flood overlay is provisional" : area.floodZonesSource === "fema-nfhl"
  ? `FEMA NFHL flood zones loaded (${(area.floodZones || []).length} polygons)`
  : `FEMA flood zones unavailable (${area.floodZonesError || "request failed"}); using local lowland fallback.`;

$("source").textContent = town.source === "synthetic"
  ? `${town.buildings.length} buildings from saved synthetic geometry`
  : town.source === "osm"
  ? `${town.buildings.length} real buildings (${town.attribution}) · ${town.people.length} synthetic residents · ${floodSourceTxt}`
  : area.error
    ? `Couldn't load map data (${area.error}), so this is a procedural town · ${town.people.length} synthetic residents · ${floodSourceTxt}`
    : demoMode
      ? `Demo town (pinned procedural layout) · ${town.people.length} synthetic residents`
      : `No map data here, so this is a procedural town · ${town.people.length} synthetic residents · ${floodSourceTxt}`;
$("loading").textContent=`Map ready · adding ${town.buildings.length} buildings…`;
$("source").textContent += ` · renderer ${rendererMode.toUpperCase()}`;
const tileNavigation = !embedMode ? mountTileNavigation({container: $("tile-navigation"),area,town,origin,camera,controls,THREE,navigate: (next,view,bounds)=>go(next.lat,next.lng,view,bounds)}) : null;
addEventListener("pagehide",()=>tileNavigation?.destroy(),{once:true});



async function loadAreaEnrichment(){
  if(!area.enrichment?.url)return;
  try {
    await new Promise(requestAnimationFrame);
    const response=await fetch(area.enrichment.url,{signal:AbortSignal.any([startupAbort.signal,AbortSignal.timeout(15000)])});
    if(!response.ok)throw new Error(`enrichment HTTP ${response.status}`);
    const overlay=await response.json();if(startupAbort.signal.aborted||overlay.areaKey!==area.areaKey)return;
    const {applyAreaEnrichment}=await import('./gen.js');
    if(typeof applyAreaEnrichment!=='function')throw new Error('Flood overlay update is not available.');
    const applied=applyAreaEnrichment(town,area,overlay);if(!applied.applied)throw new Error(applied.reason||'Flood overlay does not match the loaded area');startup.enrichmentUpdatedBuildings=applied.updated;
    const label=overlay.floodZonesStatus==='ready'?`FEMA NFHL flood zones loaded (${overlay.floodZones.length} polygons)`:overlay.floodZonesStatus==='stale'?'FEMA NFHL zones from a stale snapshot':`FEMA overlay unavailable (${overlay.floodZonesError||'no response'}); local fallback`;
    $("source").textContent=$("source").textContent.replace(floodSourceTxt,label);startup.enrichmentStatus=overlay.floodZonesStatus;
  }catch(error){if(!startupAbort.signal.aborted){area.floodZonesStatus='error';area.floodZonesError=error.message;startup.enrichmentStatus='error';$("source").textContent=$("source").textContent.replace(floodSourceTxt,`FEMA overlay unavailable (${error.message}); local fallback`);}}
}
loadAreaEnrichment();

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
// Buildings
const KIND_COLOR = { home: 0xd9cbb4, work: 0x8fa6c4, food: 0xe0875a, shop: 0xc9a23a, school: 0x9b7fd1, park: 0x7fb26a };

function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic per-building tint: keeps kind identity but makes nearby homes visibly different.
function baseColorFor(b) {
  const palette = b.kind === "park" ? [0x455d35,0x50653b,0x566841]
    : b.kind === "work" ? [0x646e73,0x85877d,0x555e62,0x99988a,0x697b80]
    : [0x8e806b,0xa39a84,0x796b58,0x8b6250,0xaaa58f,0x696d66,0x9a8972];
  return palette[hash32(`${b.id}:${b.kind}`) % palette.length];
}

const meshes = [];
const facades = [];
const geometryCache = new GeometryCache();
// Complete, coherent town first; exact park outlines and cheap building bounds make it visible while
// the same full-quality worker geometry is generated and uploaded incrementally.
const placeholderMaterials=new Map();
for (const [index,b] of town.buildings.entries()) {
  b.baseColor=baseColorFor(b);
  if(!placeholderMaterials.has(b.kind))placeholderMaterials.set(b.kind,new THREE.MeshLambertMaterial({color:KIND_COLOR[b.kind]||0xc7b9a2}));
  const xs=b.poly.map(p=>p[0]),zs=b.poly.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  // Park outlines are already cheap. Preserve them from the first frame,
  // including when asynchronous geometry fails or is still loading.
  const geo=b.kind==="park"?toBufferGeometry(generateBuildingGeometry({id:b.id,poly:b.poly,height:b.height,kind:b.kind},'LOW')):new THREE.BoxGeometry(Math.max(1,maxX-minX),b.height,Math.max(1,maxZ-minZ));
  if(b.kind!=="park")geo.translate((minX+maxX)/2,b.height/2,(minZ+maxZ)/2);
  const mesh=new THREE.Mesh(geo,placeholderMaterials.get(b.kind));mesh.castShadow=b.kind!=="park";mesh.receiveShadow=true;mesh.userData.b=b;mesh.userData.loadingGeometry=true;b.mesh=mesh;meshes.push(mesh);scene.add(mesh);
  if(index%40===39)await new Promise(requestAnimationFrame);
}
startup.placeholdersReadyMs=performance.now();
const progressiveGeometry=createProgressiveLoader({items:town.buildings,signal:startupAbort.signal,concurrency:3,frameBudgetMs:4,maxAttachmentsPerFrame:6,
  priority:b=>Math.hypot(b.center[0]-camera.position.x,b.center[1]-camera.position.z),
  load:b=>geometryCache.building({id:b.id,poly:b.poly,height:b.height,kind:b.kind}),
  attach:(data,b)=>{const geo=toBufferGeometry(data),facade=createFacadeMaterial(b.baseColor,hash32(String(b.id))%1000,{...data.metadata.facade,park:b.kind==="park"}),mesh=b.mesh;const old=mesh.geometry;mesh.geometry=geo;mesh.material=facade.material;mesh.userData.loadingGeometry=false;mesh.userData.geometryTier=1;buildingDateBridge?.refresh();facades.push(facade);b.populationFacade=facade;old.dispose();return()=>{geo.dispose();facade.material.dispose();};},
  fallback:(error,b)=>{b.mesh.userData.geometryError=error.message;return()=>b.mesh.geometry.dispose();},
  disposeSource:()=>geometryCache.dispose(),
  onProgress:progress=>{startup.geometry=progress;const label=$("loading");if(label)label.textContent=`Detailed buildings ${progress.successful} / ${progress.total}${progress.fallbacks?` · ${progress.fallbacks} footprints retained`:''}`;}
});
progressiveGeometry.start().then(()=>{startup.geometryReadyMs=performance.now();if(startup.geometry?.status==='completed'&&!startup.geometry.failed)$("loading")?.remove();}).catch(error=>{if(!startupAbort.signal.aborted&&$("loading"))$("loading").textContent=`Some geometry could not load: ${error.message}`;});
addEventListener("pagehide",()=>{progressiveGeometry.dispose();for(const material of placeholderMaterials.values())material.dispose();},{once:true});

let gpuParticleMenu=null,gpuParticleMenuDisposed=false;
const cityRenderer = mountCityRenderer({ renderer, mode: rendererMode, scene, camera, controls, town, sun, facades, geometryCache, embed: embedMode });
window.hblCityRenderer = cityRenderer;
startupCityRenderer=cityRenderer;
if(loadedExperiment?.save.view.graphics){const graphics=loadedExperiment.save.view.graphics;if(graphics.quality)cityRenderer.setQuality(graphics.quality);if(graphics.settings?.targetFPS)cityRenderer.setTargetFPS(graphics.settings.targetFPS);for(const [name,value] of Object.entries(graphics.features??{}))cityRenderer.setFeature(name,value);}
if(!embedMode)void import('./render/gpu-particle-menu.js').then(({mountGpuParticleMenu})=>{if(gpuParticleMenuDisposed)return;const container=document.querySelector('[data-testid=render-performance]');gpuParticleMenu=mountGpuParticleMenu({container,THREE,renderer,scene,bounds:{minX:-400,maxX:400,minZ:-400,maxZ:400},getSource:()=>({minute:livingWorld?.active?livingWorld.getClockMinute():world.t,frame:livingWorld?.active?physicalPolicySnapshot:null,electricity:world.electricity,weather:world.weather?.snapshot?.(),culture:world.cultureSnapshot})});window.hblGpuParticles=gpuParticleMenu;});
addEventListener('pagehide',()=>{gpuParticleMenuDisposed=true;gpuParticleMenu?.destroy();},{once:true});
if (renderBenchmark) configureBenchmark(cityRenderer, renderBenchmark);
addEventListener("pagehide", () => cityRenderer.destroy(), { once: true });
renderer.domElement.addEventListener("dblclick", (event) => {
  const bounds = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  const picker = new THREE.Raycaster(); picker.setFromCamera(pointer, camera);
  const hit = picker.intersectObjects(meshes)[0];
  if (hit) cityRenderer.focusBuilding(hit.object.userData.b.id);
});

// Dedicated construction clock and approval tools never alter resident/day time.
// Neighbor chunks are visual context only: never splice resident town arrays.
const streamStatus=document.createElement('div');streamStatus.id='world-stream-status';streamStatus.setAttribute('role','status');streamStatus.textContent='Neighbor map context loads as you pan; active residents remain in the original neighborhood.';document.body.append(streamStatus);
const retryNearby=document.createElement('button');retryNearby.type='button';retryNearby.textContent='Retry nearby map';retryNearby.id='retry-nearby-map';retryNearby.hidden=true;retryNearby.onclick=()=>mapStreamer.retry();document.body.append(retryNearby);
let minimap=null;
function disposeContext(group){scene.remove(group);group.traverse(node=>{node.geometry?.dispose();for(const mat of Array.isArray(node.material)?node.material:[node.material])mat?.dispose?.();});}
const generatedContext=town.source!=='osm';
const contextBuildings=new Map(),contextRoads=new Map();
let pendingContextChunks=null,lastContextMapUpdate=-Infinity,contextMapBounds=null,contextViewLimited=false;
function updateContextMinimap(chunks){if(chunks)pendingContextChunks=chunks;if(!minimap||!pendingContextChunks||performance.now()-lastContextMapUpdate<250)return;lastContextMapUpdate=performance.now();const loadedChunks=pendingContextChunks;pendingContextChunks=null;minimap.update({town,contextBuildings:[...contextBuildings.values()],contextRoads:[...[...contextRoads.values()].flat()],loadedChunks,bounds:contextMapBounds,viewLimited:contextViewLimited});}
const mapStreamer=createMapStreamer({mode:generatedContext?'generated':'osm',buildGeneratedTile:tile=>buildTown({lat:tile.lat,lng:tile.lng},{source:'none'},{maxPeople:0}),origin,projector:geoProj,initialArea:{...area,origin:area.origin||origin},initialBuildingIds:town.buildings.map(b=>b.id),tileRadiusM:generatedContext?430:([150,250,400].includes(area.radiusM)?area.radiusM:400),geometryCache,camera,signal:startupAbort.signal,maxTiles:9,concurrency:2,
  getTarget:()=>controls.target,
  getView:()=>{const footprint=mapControls.getPanFootprint?.(),distance=camera.position.distanceTo(controls.target),halfHeight=distance*Math.tan(camera.getEffectiveFOV()*Math.PI/360);return {x:controls.target.x,z:controls.target.z,halfWidth:footprint?footprint.width/2:halfHeight*camera.aspect,halfDepth:footprint?footprint.depth/2:halfHeight};},
  attachBuilding:(data,b)=>{const geometry=toBufferGeometry(data),facade=createFacadeMaterial(baseColorFor(b),hash32(String(b.id))%1000,{...data.metadata.facade,park:b.kind==="park"}),mesh=new THREE.Mesh(geometry,facade.material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.contextBuilding=b;b.mesh=mesh;scene.add(mesh);buildingDateBridge?.register(mesh,b);facades.push(facade);contextBuildings.set(b.id,b);return()=>{contextBuildings.delete(b.id);buildingDateBridge?.unregister(mesh);scene.remove(mesh);geometry.dispose();facade.material.dispose();const index=facades.indexOf(facade);if(index>=0)facades.splice(index,1);};},
  attachTile:(context,tile)=>{const group=new THREE.Group(),bounds=tile.actualBounds||tile.bounds,width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;const base=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshLambertMaterial({color:0x626b50}));base.rotation.x=-Math.PI/2;base.position.set((bounds.minX+bounds.maxX)/2,-.12,(bounds.minZ+bounds.maxZ)/2);base.receiveShadow=true;group.add(base);const minimapRoads=[];for(const road of context.roads||[]){const projected=(road.pts||[]).map(point=>context.coordinates==='world'?point:geoProj.toXZ(point[0],point[1]));minimapRoads.push({...road,pts:projected});const points=projected.map(([x,z])=>new THREE.Vector3(x,.06,z));if(points.length<2)continue;group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x92938e})));}scene.add(group);contextRoads.set(tile.key,minimapRoads);return()=>{contextRoads.delete(tile.key);disposeContext(group);};},
  onProgress:state=>{startup.stream=state;contextMapBounds=state.activeWindowBounds;contextViewLimited=state.viewLimited;const unavailable=state.tiles.filter(tile=>tile.status==='error').length,partial=state.tiles.filter(tile=>tile.status==='partial'||tile.error&&tile.status!=='error').length;retryNearby.hidden=!unavailable&&!partial;retryNearby.disabled=state.activeFetches>0;streamStatus.textContent=`${state.mode==='generated'?'Generated':'Real-map'} neighbor context: ${state.tileCount} / 9 retained areas · ${state.buildingCount} context buildings · ${state.activeFetches} map requests${unavailable?` · ${unavailable} unavailable`:''}${partial?` · ${partial} partial`:''}${state.viewLimited?' · zoom in for complete view coverage':''}. Original resident model unchanged.`;updateContextMinimap(state.tiles);}
});
window.hblMapStreamer=mapStreamer;
minimap=!embedMode?mountMinimap(document.body,{town,camera,controls,THREE,bounds:geographicTileBounds(area,town),loadedChunks:mapStreamer.getState().tiles,onPan:()=>{manualPanRequested=true;streamingEnabled=true;},onPanScreen:direction=>mapControls.panScreen(direction)}):null;
window.hblMapControls=mapControls;
let selectedVehicle=null,lastVehicleUpdate=0;
const vehicleInspector=!embedMode?mountVehicleInspector(document.body,{onClose:()=>{selectedVehicle=null;}}):null;
addEventListener('pagehide',()=>{minimap?.destroy();vehicleInspector?.destroy();},{once:true});

addEventListener('pagehide',()=>{mapStreamer.dispose();streamStatus.remove();retryNearby.remove();},{once:true});

const buildingBridge = !embedMode ? mountWorldBuildingBridge({ scene, camera, renderer, controls, town, THREE }) : null;
addEventListener("pagehide", () => buildingBridge?.destroy(), { once: true });
const constitutionWorldHost = !embedMode ? mountConstitutionWorldHost({THREE,scene,town,camera,controls}) : null;
window.hblConstitutionWorldHost=constitutionWorldHost;
addEventListener("pagehide",()=>constitutionWorldHost?.destroy(),{once:true});

// People: one instanced capsule mesh, hidden while indoors
const ACTION_COLOR = {
  walking: 0x2f6fd6, play_park: 0x3f9e4f, clean_park: 0x0f8f7a, eat_out: 0xd2552d, groceries: 0xb7871b,
  work: 0x4a5a78, study: 0x7a5ec2, sleep: 0x555555, eat_home: 0xb36b3b, relax_home: 0x8d6e63, idle: 0x999999,
};
const OUTDOOR = new Set(["play_park", "clean_park"]);
const humanPeople=createHumanInstances({THREE,count:town.people.length,readable:true});
const people=humanPeople.root;
scene.add(people);
window.hblHumanPeople=humanPeople;
let physicalPolicySnapshot=null;
const physicalPolicyLayer=createPhysicalPolicyLayer({THREE,scene,town});
window.hblPhysicalPolicyLayer=physicalPolicyLayer;
addEventListener('pagehide',()=>physicalPolicyLayer.destroy(),{once:true});
addEventListener('pagehide',()=>humanPeople.destroy(),{once:true});
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
// First-run feedback only describes actual recorded or currently observed model values.
function worldFeedback(type, detail = {}) {
  window.dispatchEvent(new CustomEvent('hbl:world-feedback', {detail:{type,...detail}}));
}
async function withClassicWorld(action) {
  if (livingWorld?.active) await livingWorld.setActive(false);
  return action();
}
let speed = Math.max(1, Math.min(100, Number(params.get("speed")) || 1)); // game minutes per real second
let selected = null; // { type: "person"|"building"|"journal", id }
let follow = false;
let overlayMode = "none";
let cycleResult = null;     // last Run cycle result from cycle.worker.js
let cycleView = "withPlan"; // which scores the "cycle" overlay shows: before | noPlan | withPlan
let todayJournalPosts = [];
let journalPins = [];
const originalTrafficEnabled=cityRenderer.getPerformanceStats().features?.traffic!==false;
let livingWorld=null,livingPlaybackUnsubscribe=null;
const activityListeners=new Set();let activityRuntimeUnsubscribe=null,activityDashboard=null,activityDashboardPromise=null,activityObserver=null,activityDisposed=false;
function notifyActivity(){if(!activityListeners.size||!window.hblWorldActivity)return;const snapshot=window.hblWorldActivity.getSnapshot();for(const listener of activityListeners)listener(snapshot);}
function bindActivityRuntime(runtime){if(activityRuntimeUnsubscribe)return;activityRuntimeUnsubscribe=runtime.subscribe(frame=>{physicalPolicySnapshot=frame;if(livingWorld?.active)notifyActivity();});}
const legacyActivityUnsubscribe=world.subscribeActivity(()=>{if(!livingWorld?.active)notifyActivity();});
const playback=createSimulationPlayback({initialSpeed:speed,onChange:state=>{speed=state.paused?0:state.speed;const runtime=livingWorld?.active?livingWorld.getRuntime():null;if(runtime){runtime.setSpeed(Math.min(32,state.speed));state.paused?runtime.pause():runtime.resume();}for(const button of $("speeds").children)button.classList.toggle("on",Number(button.dataset.s)===(state.paused?0:state.speed));if(selected?.type==="person")renderInspector();if(window.hblGuidedActions)worldFeedback("playback",{paused:state.paused,speed:state.speed});}});
window.hblSimulationPlayback=playback;
livingWorld=!embedMode?mountLivingWorld({container:document.body,scene,camera,controls,THREE,town,renderer,autoActivate:loadedExperiment?false:!businessMode&&!simulationId&&!demoMode&&!renderBenchmark,initialMinute:loadedExperiment?0:6*60,onRuntimeReady:runtime=>{bindActivityRuntime(runtime);const state=playback.getState();runtime.setSpeed(Math.min(32,state.speed));state.paused?runtime.pause():runtime.resume();if(!livingPlaybackUnsubscribe)livingPlaybackUnsubscribe=runtime.subscribe(frame=>{if(!livingWorld?.active||!frame?.runtime)return;if(Number.isFinite(frame.runtime.speed)&&frame.runtime.speed!==playback.getState().speed)playback.setSpeed(frame.runtime.speed);frame.runtime.paused?playback.pause():playback.resume();});return true;},onModeChange:active=>{people.visible=!active;follow=false;selected=null;document.documentElement.classList.remove("person-selected");$("inspect").removeAttribute("data-person-selected");$("inspect").style.display="none";cityRenderer.setFeature('traffic',active?false:originalTrafficEnabled);cityRenderer.updateCity({trafficDensity:active?0:1});document.body.classList.toggle('living-active',active);notifyActivity();const fastest=$('speeds').lastElementChild;fastest.dataset.s=active?'32':'60';fastest.textContent=active?'32×':'60×';if(active&&playback.getState().speed>32)playback.setSpeed(32);}}):null;
window.hblLivingWorld=livingWorld;
const neighborhoodWhatIf = !embedMode ? mountNeighborhoodWhatIf({scene,camera,controls,renderer,THREE,getContext:()=>livingWorld.getContext()}) : null;
addEventListener('pagehide',()=>neighborhoodWhatIf?.destroy(),{once:true});
window.hblWorldActivity={
 getSnapshot(){const snapshot=livingWorld?.active?livingWorld.getSnapshot():null;return livingWorld?.active?(snapshot?{...snapshot,mode:'living',peopleCount:snapshot.metrics?.syntheticPopulation??snapshot.population,people:snapshot.visibleAgents,runId:`${snapshot.runtime?.id}:${snapshot.runtime?.revision}`}:{mode:'living',peopleCount:null,minute:null,historyAvailable:false,runId:'living:resetting'}):world.getActivitySnapshot();},
 async getHistory(query={}){const source=window.hblWorldActivity.getSnapshot(),identity=source.runId;if(livingWorld?.active){const runtime=livingWorld.getRuntime();if(!runtime?.getActivityHistory)throw Error('Living history is not ready.');const history=await runtime.getActivityHistory(query);if(!livingWorld?.active||window.hblWorldActivity.getSnapshot().runId!==identity)throw Error('Activity source changed while history was loading; refresh the current run.');return {...history,runId:identity};}if(query.actorId)world.trackActivityPerson(query.actorId);const history=world.getActivityHistory(query);if(livingWorld?.active)throw Error('Activity source changed while history was loading.');return {...history,runId:identity};},
 subscribe(listener){activityListeners.add(listener);return()=>activityListeners.delete(listener);},
 selectPerson(id){if(livingWorld?.active)return livingWorld.selectPerson(String(id));const index=town.people.findIndex(person=>String(person.id)===String(id));if(index>=0)select({type:'person',id:index});}
};
const activityButton=$('activity-dashboard-button');
async function openActivityDashboard(){try{
 if(!activityDashboardPromise)activityDashboardPromise=import('./activity-dashboard.js').then(({mountActivityDashboard})=>{
  if(activityDisposed)return;activityDashboard=mountActivityDashboard({container:document.body,...window.hblWorldActivity,onSelectPerson:id=>window.hblWorldActivity.selectPerson(id)});
  const panel=document.querySelector('.activity-dashboard');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.tabIndex=-1;
  panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();activityDashboard.close();activityButton.focus();}if(event.key==='Tab'){const items=[...panel.querySelectorAll('button,input,select,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
  activityObserver=new MutationObserver(()=>{const opened=!panel.hidden;mapControls.setEnabled(!opened);activityButton.setAttribute('aria-expanded',String(opened));if(!opened)activityButton.focus();});activityObserver.observe(panel,{attributes:true,attributeFilter:['hidden']});
  return activityDashboard;
 });
 const dashboard=await activityDashboardPromise;if(!dashboard||activityDisposed)return;
 if(dashboard.isOpen()){dashboard.close();activityButton.setAttribute('aria-expanded','false');return;}
 await dashboard.open();mapControls.setEnabled(false);activityButton.setAttribute('aria-expanded','true');document.querySelector('.activity-dashboard button')?.focus();
 }catch(error){activityDashboardPromise=null;activityButton.title=error.message;console.error('Activity dashboard unavailable',error);}}
activityButton.setAttribute('aria-expanded','false');
activityButton.setAttribute('aria-controls','world-activity-dashboard');
activityButton.addEventListener('click',openActivityDashboard);
addEventListener('pagehide',()=>{activityDisposed=true;legacyActivityUnsubscribe?.();activityRuntimeUnsubscribe?.();activityObserver?.disconnect();activityDashboard?.destroy();activityListeners.clear();activityButton.removeEventListener('click',openActivityDashboard);},{once:true});

addEventListener('pagehide',()=>{livingPlaybackUnsubscribe?.();livingWorld?.destroy();playback.destroy();},{once:true});
let lawPanel=null,lawLayer=null,lawsDisposed=false;
if(!embedMode)void Promise.all([import('./laws/law-panel.js'),import('./laws/world-layer.js'),import('./laws/catalog.js'),import('./laws/comparison-client.js')]).then(([{mountLawPanel},{mountLawWorldLayer},{LAW_CATALOG},{compareLawInWorker:compareLaw}])=>{
 if(lawsDisposed)return;lawLayer=mountLawWorldLayer({THREE,scene,town});let planInput=null;
 const context=()=>{const frame=window.hblWorldActivity.getSnapshot(),config=livingWorld?.active?livingWorld.getSnapshot()?.config:null;const raw=config?.seed??world.seed,n=Number(raw),seed=Number.isInteger(n)&&n>=0&&n<=4294967295?n:hashSeed(String(raw??town.seedKey));return{mode:frame.mode,snapshot:frame,people:frame.people,population:frame.peopleCount??town.people.length,seed,worldContext:livingWorld?.getContext?.()||{buildings:town.buildings},populationConfig:config,sourceRunId:frame.runId};};
 lawPanel=mountLawPanel(document.body,{laws:LAW_CATALOG,getContext:context,worldLayer:lawLayer,onPlanIdeaChange:text=>{if(planInput)planInput.value=text;},compareLaw:async(law,ctx)=>{
  const sourceRunId=ctx.sourceRunId;const response=await compareLaw({lawId:law.id,worldContext:ctx.worldContext,seed:ctx.seed,population:ctx.population,...(law.mapping?.engine==='population'?{minutes:Math.min(1440,Math.floor(2000000/(2*ctx.population))),populationConfig:ctx.populationConfig||undefined}:{years:5}),signal:ctx.signal});
  if(window.hblWorldActivity.getSnapshot().runId!==sourceRunId)throw Error('Visible simulation source changed. Select the law again to compare the current source.');
  return{...response,scorecard:response.scorecard?.map(row=>({...row,current:row.current??row.selected})),supported:response.status==='completed',limitations:[...(response.limitations||[]),'Detached paired initialization uses the scene context and requested population. It is not a continuation or modification of the live household/business ledger.']};
 },onError:error=>console.error('Law comparison unavailable',error)});
 const panel=document.querySelector('[data-testid="law-panel"]');planInput=panel?.querySelector('textarea');if(panel&&!planInput){const label=document.createElement('label');label.textContent='Plan idea';planInput=document.createElement('textarea');planInput.rows=3;planInput.setAttribute('aria-label','Plan idea');label.append(planInput);panel.querySelector('header')?.after(label);const note=document.createElement('p');note.className='law-note';note.textContent='Selecting a law fills its exact text here. Editing this draft does not change its reviewed mechanism mapping.';label.after(note);}
 const lawButton=document.querySelector('[data-testid=law-panel-button]');const closeCulture=()=>{culturePanel?.close?.();weatherPanel?.close?.();scrapbook?.close?.();challengePanel?.close?.();};lawButton?.addEventListener('click',closeCulture);addEventListener('pagehide',()=>lawButton?.removeEventListener('click',closeCulture),{once:true});
 window.hblLawPanel=lawPanel;window.hblLawWorldLayer=lawLayer;
}).catch(error=>console.error('Law catalog unavailable',error));
addEventListener('pagehide',()=>{lawsDisposed=true;lawPanel?.destroy();lawLayer?.destroy();},{once:true});
let shadowComparison=null,shadowPanel=null,shadowDisposed=false;
if(params.get('shadow')==='1'&&!embedMode){
 void Promise.all([import('./runtime/shadow-comparison.js'),import('./runtime/shadow-view.js')]).then(([{createShadowComparison},{mountShadowComparisonPanel}])=>{
  if(shadowDisposed)return;shadowPanel=mountShadowComparisonPanel(document.body,{onPause:()=>shadowComparison?.pause(),onResume:()=>shadowComparison?.resume(),onRefresh:()=>shadowComparison?.refresh()});
  const numericSeed=Number(world.seed),seed=Number.isInteger(numericSeed)&&numericSeed>=0&&numericSeed<=4294967295?numericSeed:hashSeed(String(world.seed??town.seedKey));
  shadowComparison=createShadowComparison({legacyWorld:world,worldContext:livingWorld?.getContext?.()||{buildings:town.buildings},seed,population:world.people.length,isLegacyActive:()=>!livingWorld?.active,onUpdate:report=>shadowPanel?.update(report),onError:error=>console.error('Shadow comparison failed',error)});
  window.hblShadowComparison=shadowComparison;shadowComparison.ready.catch(error=>shadowPanel?.update({status:'Shadow initialization failed',error:error.message,authority:'legacy; unchanged'}));
 }).catch(error=>console.error('Optional shadow comparison unavailable',error));
}
addEventListener('pagehide',()=>{shadowDisposed=true;shadowComparison?.destroy();shadowPanel?.destroy();},{once:true});
let challengePanel=null,challengePanelDisposed=false;
let scrapbook=null,scrapbookDisposed=false,scrapbookUnsubscribe=null,scrapbookSource=null;
let weatherPanel=null,weatherPanelDisposed=false,weatherPanelUnsubscribe=null,weatherPanelLastRefresh=-Infinity;
let culturePanel=null,culturePanelDisposed=false,culturePanelUnsubscribe=null,culturePanelLastRefresh=-Infinity;
void import('./culture/culture-panel.js').then(({mountCulturePanel})=>{
 if(culturePanelDisposed||embedMode)return;
 culturePanel=mountCulturePanel(document.body,{onChange:event=>{if(event.type==='schedule'&&scrapbook){const source=scrapbookSourceFrame();const culture=livingWorld?.active?livingWorld.getCultureSimulation?.():world.culture;scrapbook.observe({...source,events:culture?.snapshot?.().activeEvents||[]});}if(event.type==='open'){if(!document.querySelector('[data-testid=law-panel]')?.hidden)lawPanel?.close();weatherPanel?.close?.();scrapbook?.close?.();challengePanel?.close?.();}},getSimulation:()=>livingWorld?.active?(livingWorld.getCultureSimulation?.()??null):(world.culture??null)});
 window.hblCulturePanel=culturePanel;
 culturePanelUnsubscribe=window.hblWorldActivity.subscribe(()=>{const now=performance.now();if(now-culturePanelLastRefresh>=750){culturePanelLastRefresh=now;culturePanel.refresh();}});
}).catch(error=>console.error('Culture controls unavailable',error));
addEventListener('pagehide',()=>{culturePanelDisposed=true;culturePanelUnsubscribe?.();culturePanel?.destroy();},{once:true});
void import('./weather/weather-panel.js').then(({mountWeatherPanel})=>{if(weatherPanelDisposed||embedMode)return;weatherPanel=mountWeatherPanel(document.body,{getSimulation:()=>livingWorld?.active?(livingWorld.getWeatherSimulation?.()??null):(world.weather??null),getObservations:()=>livingWorld?.active?(physicalPolicySnapshot?.weather?.electricity??null):(world.electricity??null),onChange:event=>{if(event.type==='open'){challengePanel?.close?.();scrapbook?.close?.();culturePanel?.close?.();if(!document.querySelector('[data-testid=law-panel]')?.hidden)lawPanel?.close();}}});window.hblWeatherPanel=weatherPanel;weatherPanelUnsubscribe=window.hblWorldActivity.subscribe(()=>{const now=performance.now();if(now-weatherPanelLastRefresh>=750){weatherPanelLastRefresh=now;weatherPanel.refresh();}});}).catch(error=>console.error('Weather controls unavailable',error));
addEventListener('pagehide',()=>{weatherPanelDisposed=true;weatherPanelUnsubscribe?.();weatherPanel?.destroy();},{once:true});
function scrapbookSourceFrame(frame=window.hblWorldActivity.getSnapshot()){return{minute:frame.minute??frame.clock?.minute,mode:frame.mode,runId:frame.runId,peopleCount:frame.peopleCount,seed:frame.config?.seed??world.seed??realityRunSeed??town.seedKey,modelVersion:frame.modelVersion??world.modelVersion,events:[...(frame.mode==='living'?(frame.events||[]):world.events.slice(0,12).reverse()),...((frame.mode==='living'?physicalPolicySnapshot?.culture:world.cultureSnapshot)?.activeEvents||[])]};}
void import('./scrapbook/scrapbook.js').then(({mountCityScrapbook})=>{if(scrapbookDisposed||embedMode)return;scrapbook=mountCityScrapbook(document.body,{onOpen:()=>{challengePanel?.close?.();culturePanel?.close?.();weatherPanel?.close?.();if(!document.querySelector('[data-testid=law-panel]')?.hidden)lawPanel?.close();}});window.hblCityScrapbook=scrapbook;scrapbookSource=scrapbookSourceFrame();scrapbook.observe(scrapbookSource);scrapbookUnsubscribe=window.hblWorldActivity.subscribe(frame=>{scrapbookSource=scrapbookSourceFrame(frame);scrapbook.observe(scrapbookSource);});}).catch(error=>console.error('City scrapbook unavailable',error));
addEventListener('pagehide',()=>{scrapbookDisposed=true;scrapbookUnsubscribe?.();scrapbook?.destroy();},{once:true});
if(!embedMode)void Promise.all([import('./challenges/panel.js'),import('./city/seed.js')]).then(([{mountChallengePanel},{createCity,createCityFromArea}])=>{if(challengePanelDisposed)return;challengePanel=mountChallengePanel(document.body,{getInitialState:()=>{const raw=livingWorld?.active?physicalPolicySnapshot?.config?.seed:world.seed;const value=Number(raw),seed=Number.isInteger(value)&&value>=0&&value<=4294967295?value:hashSeed(String(raw??town.seedKey));const buildings=(area.buildings||[]).filter(b=>b.kind!=='park'&&Array.isArray(b.pts)&&b.pts.length>=3).slice(0,80);const state=buildings.length?createCityFromArea({...area,origin,buildings},{seed,households:30}):createCity({seed,households:30});state.provenance.assumptions.push(`Challenge sample: ${buildings.length} mapped footprints (up to80),30 synthetic households. Frozen monthly city; daily live ledgers are unchanged.`);return state;},onOpen:()=>{culturePanel?.close?.();weatherPanel?.close?.();scrapbook?.close?.();if(!document.querySelector('[data-testid=law-panel]')?.hidden)lawPanel?.close();}});window.hblChallengePanel=challengePanel;}).catch(error=>console.error('Challenge links unavailable',error));
addEventListener('pagehide',()=>{challengePanelDisposed=true;challengePanel?.destroy();},{once:true});
let buildingDateDisposed=false,buildingDateObserver=null;
if(!embedMode)void Promise.all([import('./temporal/building-dates.js'),import('./temporal/date-filter.js')]).then(([{createBuildingDateFilter},{mountBuildingDateFilter}])=>{if(buildingDateDisposed)return;buildingDateBridge=createBuildingDateFilter({getHLODEnabled:()=>cityRenderer.getPerformanceStats().features.lod,setHLODEnabled:value=>cityRenderer.setFeature('lod',value)});for(const b of [...town.buildings,...contextBuildings.values()])if(b.mesh)buildingDateBridge.register(b.mesh,b);buildingDatePanel=mountBuildingDateFilter($('top'),{buildings:[...town.buildings,...contextBuildings.values()],onChange:next=>buildingDateBridge.set(next)});const place=()=>{const shortcuts=$('top').querySelector('[data-testid=proposal-shortcuts]');if(shortcuts&&shortcuts.nextElementSibling!==buildingDatePanel.element)shortcuts.after(buildingDatePanel.element);};buildingDateObserver=new MutationObserver(place);buildingDateObserver.observe($('top'),{childList:true});place();const saved=loadedExperiment?.save.view.buildingDateFilter;if(saved){for(const [key,value] of Object.entries(saved)){const field=buildingDatePanel.element.querySelector('[data-date="'+key+'"]');if(field){if(field.type==='checkbox')field.checked=value;else field.value=value;}}buildingDatePanel.element.dispatchEvent(new Event('change'));}window.hblBuildingDateFilter={bridge:buildingDateBridge,panel:buildingDatePanel};}).catch(error=>console.error('Building date filter unavailable',error));
addEventListener('pagehide',()=>{buildingDateDisposed=true;buildingDateObserver?.disconnect();buildingDatePanel?.destroy();buildingDateBridge?.destroy();},{once:true});
let proposalShortcuts=null,proposalShortcutsDisposed=false;
if(!embedMode)void import('./proposal-shortcuts.js').then(({mountProposalShortcuts})=>{if(proposalShortcutsDisposed)return;proposalShortcuts=mountProposalShortcuts($('top'),{origin});window.hblProposalShortcuts=proposalShortcuts;}).catch(error=>console.error('Proposal shortcuts unavailable',error));
addEventListener('pagehide',()=>{proposalShortcutsDisposed=true;proposalShortcuts?.destroy();},{once:true});
let realityPaintbrush=null,realityPaintbrushDisposed=false;
if(!embedMode)void import('./reality/paintbrush.js').then(({mountRealityPaintbrush})=>{if(realityPaintbrushDisposed)return;realityPaintbrush=mountRealityPaintbrush({container:$('top'),THREE,scene,camera,canvas:renderer.domElement,town,controls});window.hblRealityPaintbrush=realityPaintbrush;}).catch(error=>console.error('Reality paintbrush unavailable',error));
addEventListener('pagehide',()=>{realityPaintbrushDisposed=true;realityPaintbrush?.destroy();},{once:true});
let cityDiffRadar=null,cityDiffRadarDisposed=false;
if(!embedMode)void import('./reality/diff-radar-panel.js').then(({mountCityDiffRadar})=>{if(cityDiffRadarDisposed)return;cityDiffRadar=mountCityDiffRadar({container:document.body,THREE,scene,camera,controls,town,getStreamedBuildings:()=>[...contextBuildings.values()],getStreamRevision:()=>JSON.stringify(mapStreamer.getState().tiles.map(tile=>[tile.key,tile.status]))+contextBuildings.size,getPolicyRevision:()=>($('policy')?.value??'')+':'+($('planYear')?.value??'')});window.hblCityDiffRadar=cityDiffRadar;}).catch(error=>console.error('City difference radar unavailable',error));
addEventListener('pagehide',()=>{cityDiffRadarDisposed=true;cityDiffRadar?.destroy();},{once:true});



let temporalCity=null,temporalCityDisposed=false;
if(!embedMode)void import('./temporal/panel.js').then(({mountTemporalCity})=>{if(temporalCityDisposed)return;temporalCity=mountTemporalCity({container:document.body,origin:{lat:origin.lat,lng:origin.lng}});window.hblTemporalCity=temporalCity;}).catch(error=>console.error('City Time Machine unavailable',error));
addEventListener('pagehide',()=>{temporalCityDisposed=true;temporalCity?.destroy();},{once:true});

const overlayEl = $("overlayMode");
const overlayLegendEl = $("overlayLegend");
if (overlayEl) overlayEl.onchange = (e) => { overlayMode = e.target.value || "none"; };
for (const btn of $("speeds").children) btn.classList.toggle("on", Number(btn.dataset.s) === speed);
for (const btn of $("speeds").children) btn.onclick = () => {
  const requested=Number(btn.dataset.s);
  if(requested===0)playback.pause();else{playback.setSpeed(requested);playback.resume();}
  if(selected?.type === "person")renderInspector();
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

  if(scrapbook){scrapbookSource=scrapbookSourceFrame();scrapbook.observe({...scrapbookSource,events:[{type:'POLICY_APPLIED',id:`policy:${world.policy.id}:${year}:${world.t}`,minute:world.t,title:'A policy package changes',text:`${p.label} applied at policy year ${year}. This records a configured scenario change, not proof of its outcomes.`,policyId:world.policy.id}]});}
  const src = p.source === "dear-congress" ? "dear-congress" : "local";
  const pendingTxt = staged.unsupported.length
    ? ` · not simulated yet: ${staged.unsupported.slice(0, 4).join(", ")}${staged.unsupported.length > 4 ? "…" : ""}`
    : "";

  const simNote = BALANCED_SIM_NOTE ? ` · ${BALANCED_SIM_NOTE}` : "";
  $("policyNote").textContent = `${p.label} · year ${year} · transit ×${staged.effects.speedMult.toFixed(2)} · flood mitigation ${Math.round(staged.effects.floodMitigation * 100)}% · housing growth ${Math.round(staged.effects.housingGrowth * 100)}% · vouchers ${staged.effects.voucherMonthly.toFixed(0)}/mo${staged.effects.groceryDelivery > 0 ? ` · grocery delivery ${Math.round(staged.effects.groceryDelivery * 100)}%` : ""} · source: ${src}${pendingTxt}${simNote}`;
  if (window.hblGuidedActions) worldFeedback('policy', {
    label: 'Plan configured',
    message: p.label + ' at plan year ' + year + '. These are configured mechanisms; run a paired experiment to measure outcomes.',
    metrics: [
      {label:'Transit time multiplier',value:staged.effects.speedMult.toFixed(2) + '×'},
      {label:'Flood mitigation',value:Math.round(staged.effects.floodMitigation * 100) + '%'},
      {label:'Housing growth',value:Math.round(staged.effects.housingGrowth * 100) + '%'},
    ],
  });
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
        ? { method: "POST", headers: { "content-type": "application/json" }, body: attempt.body, signal: AbortSignal.any([startupAbort.signal,AbortSignal.timeout(8000)]) }
        : { signal: AbortSignal.any([startupAbort.signal,AbortSignal.timeout(8000)]) });
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
    overlayLegendEl.textContent = `home color = recorded daily total travel, all purposes (threshold ${WALK_COMPLAINT_MINUTES}m)`;
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
  overlayMode = 'flood';
  if (overlayEl) overlayEl.value = 'flood';
  updateOverlayLegend();
  worldFeedback('storm', {
    label:'Storm result',
    message:'A synthetic storm has affected the classic town. The highlighted flooded parcels and relocated residents come from the simulation.',
    metrics:[
      {label:'Flooded parcels',value:String(floodedNow)},
      {label:'Residents displaced',value:String(displaced)},
      {label:'Selected plan',value:String(world.policy?.label || 'No plan')},
    ],
  });
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

$("stormBtn").onclick = () => withClassicWorld(triggerStorm).catch(error => worldFeedback("error",{label:"Storm unavailable",message:error.message}));
// A world embedded in the grid only needs its frozen plan, so it skips synthesizing packages.
if (!loadedExperiment && !(embedMode && realityRunSeed)) {
  if(realityRunSeed)await loadPolicyPackages(); // Frozen reality ordering is unchanged.
  else {
    policyPending=true;startup.policyStatus='loading';refreshPolicySelect(activePolicyId);
    for(const id of ['policy','runExperimentBtn','runCycleBtn','demoBtn'])if($(id))$(id).disabled=true;
    loadPolicyPackages().then(ok=>{if(startupAbort.signal.aborted)return;policyPending=false;startup.policyStatus=ok?'ready':'local-fallback';if($("policyNote"))$("policyNote").textContent=$("policyNote").textContent.replace(' · remote plan packages loading; current local policy unchanged','')+(ok?'':' · using local presets; remote packages unavailable');for(const id of ['policy','runExperimentBtn','runCycleBtn','demoBtn'])if($(id))$(id).disabled=startupDisabled.get($(id))||false;});
  }
}
activePolicyId = $("policy").value || "none";
if (realityRunSeed) {
  // Entering one reality from the realities page: run its frozen plan with its seed.
  try {
    const res = await fetch(`/api/dear-congress/simulation-snapshots/${encodeURIComponent(simulationId)}`, { signal: AbortSignal.any([startupAbort.signal,AbortSignal.timeout(8000)]) });
    const snap = (await res.json())?.snapshot;
    if (snap?.plan?.proposalIds?.length) {
      PLAN_PACKAGES = {
        ...PLAN_PACKAGES,
        snapshot: derivePolicyProfile(`${snap.plan.label} (frozen plan) · reality #${Number(realityIndex)}`, "snapshot", snap.plan.proposalIds, "dear-congress"),
      };
      refreshPolicySelect("snapshot");
      activePolicyId = "snapshot";
    }
  } catch (err) {
    console.warn("[world] could not load simulation snapshot", err);
  }
}
applyPolicy(activePolicyId, policyYear);
if(policyPending)$("policyNote").textContent += " · remote plan packages loading; current local policy unchanged";

// ?person=<id> (from "why this reality"): select that resident and follow them.
if (params.get("person") != null) followResident(Number(params.get("person")));

const EXP_PACKAGES = ["Balanced", "Minimal change", "Most popular"];
let experimentWorker = null;
let lastExperimentSeed = null;
let lastCompletedRunSeed = null;
let lastCompletedRunFingerprint = null;

function lineChartSvg(title, byPkg, key, colorByPkg, opts = {}) {
  const w = 470, h = 120, pad = 24;
  const metricValue=row=>{const value=row?.outcomes?.[key]??row?.outcomes?.[opts.fallbackKey];return Number.isFinite(value)?value:undefined;};
  const ptsAll = [];
  for (const name of EXP_PACKAGES) {
    for (const row of (byPkg[name] || [])) {
      const value=metricValue(row);if(value!==undefined)ptsAll.push(value);
    }
  }
  if(!ptsAll.length)return `<div class="exp-chart"><h2>${title}</h2><p class="muted">Unavailable: no recorded values were supplied.</p></div>`;
  const min = ptsAll.length ? Math.min(...ptsAll) : 0;
  const max = ptsAll.length ? Math.max(...ptsAll) : 1;
  const lo = min === max ? min - 1 : min;
  const hi = min === max ? max + 1 : max;

  const pathFor = (rows) => {
    const series = rows || [];
    if (!series.length) return "";
    const n = Math.max(1, series.length - 1);
    const parts = [];let started=false;
    for (let i = 0; i < series.length; i++) {
      const x = pad + (i / n) * (w - pad * 2);
      const v = metricValue(series[i]);if(v===undefined){started=false;continue;}
      const y = h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);
      parts.push(`${started ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);started=true;
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
    lineChartSvg("Commute minutes", byPkg, "avgTravelMinutes", colors, { xLabels: labels, markYears, fallbackKey:"avgWalkMinutes" }),
    lineChartSvg("Budget-stressed households", byPkg, "budgetStressRate", colors, { xLabels: labels, markYears }),
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
      <td>${Number.isFinite(y10Outcomes.outcomes.avgTravelMinutes??y10Outcomes.outcomes.avgWalkMinutes)?Number(y10Outcomes.outcomes.avgTravelMinutes??y10Outcomes.outcomes.avgWalkMinutes).toFixed(1):"Unavailable"}</td>
      <td>${Number.isFinite(y10Outcomes.outcomes.budgetStressRate)?(100*y10Outcomes.outcomes.budgetStressRate).toFixed(1)+"%":"Unavailable"}</td>
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
    <thead><tr><th>Package</th><th>Flooded (Y10)</th><th>Displaced (Y10)</th><th>Commute minutes (Y10)</th><th>Budget-stressed households (Y10)</th><th>Mood (Y10)</th><th>Items Y2</th><th>Plan changes Y2</th><th>Items Y5</th><th>Plan changes Y5</th><th>Items Y10</th><th>Plan changes Y10</th><th>Not simulated Y2</th><th>Not simulated Y5</th><th>Not simulated Y10</th></tr></thead>
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

  experimentWorker = createTrackedWorker(new URL("./experiment.worker.js", import.meta.url), { type: "module" }, { type: "Simulation", ownership: { system: "legacy-experiments" } });
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
      worldFeedback('error',{label:'10-year experiment failed',message:String(msg.error)});
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
      const chosen = results['Balanced']?.history?.find(row=>row.year===10) || results['Balanced']?.history?.at(-1);
      const comparison = results['Minimal change']?.history?.find(row=>row.year===10) || results['Minimal change']?.history?.at(-1);
      const comparisonMetrics = [];
      for(const [label,key] of [['Average mood','avgMood'],['Flooded parcels','floodedParcels'],['Displaced residents','displacedResidents']]) {
        const a = comparison?.outcomes?.[key], b = chosen?.outcomes?.[key];
        if(Number.isFinite(a) && Number.isFinite(b)) comparisonMetrics.push({label:label+' (Balanced − Minimal)',value:(b>=a?'+':'')+(b-a).toFixed(1)});
      }
      worldFeedback('longitudinal',{label:'10-year results',
        message:'Three plan packages have been simulated. These deltas compare Balanced with Minimal change, not with a no-plan branch.',
        metrics:comparisonMetrics,resultId:'experimentPanel',
      });
      const before = await beforeStatePromise;
      const after = await readStateEntryCount();
      const stateMsg = before != null && after != null
        ? `done · dear-congress entries ${before} → ${after}`
        : "done";
      setExperimentStatus(`10-year longitudinal experiment: ${stateMsg}`);
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

$("runExperimentBtn")?.addEventListener("click", () => withClassicWorld(runExperiment10Years).catch(error=>worldFeedback("error",{label:"Experiment unavailable",message:error.message})));

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
const changeLabel = (x) => x?.label || x?.id || (typeof x === "string" ? x : "");
const changeLabels = (arr) => (Array.isArray(arr) ? arr.map(changeLabel).filter(Boolean) : []);

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
  if (r.waiting) return `Cycle ${n}: dear-congress is leaning toward ${r.waiting.label} (${r.waiting.streak} of ${r.waiting.needed}), plan unchanged this week`;
  const added = changeLabels(r.added);
  const removed = changeLabels(r.removed);
  if (!added.length && !removed.length) return `Cycle ${n}: no fixable complaints left, so plan ${n} = plan ${n - 1}`;
  const by = r.source === "dear-congress" ? "dear-congress adopted " : "";
  const what = `${by}${added.length ? `+ ${added.join(", ")}` : `− ${removed.join(", ")}`}`;
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
  cycleWorker = createTrackedWorker(new URL("./cycle.worker.js", import.meta.url), { type: "module" }, { type: "Cycle", ownership: { system: "legacy-cycle" } });
  cycleWorker.onmessage = (ev) => {
    const msg = ev?.data || {};
    const status = $("cycleStatus");
    if (msg.type === "progress") { status.textContent = `${msg.stage}…`; return; }
    if (msg.type === "error") {
      status.textContent = `Cycle failed: ${msg.error}`;
      worldFeedback('error',{label:'Weekly comparison failed',message:String(msg.error)});
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
  const requestedId = cyclePackageId();
  const pkg = PLAN_PACKAGES[requestedId]
    || PLAN_PACKAGES.balanced
    || Object.values(PLAN_PACKAGES).find((p) => p?.id && p.id !== "none")
    || PLAN_PACKAGES.none;
  if (!pkg) {
    $("cycleStatus").textContent = "Cycle failed: no plan packages available";
    return;
  }
  const pkgId = pkg.id || requestedId || "none";
  const pkgLabel = pkg.label || pkgId;
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
  pendingCycleLabel = pkgLabel;
  pendingCycleSource = pkg.source;
  cycleWorker.postMessage({
    type: "run",
    payload: { origin, area, maxPeople, proposalIds: pkg.proposalIds || [], label: pkgLabel, remoteId: pkg.remoteId || null, year, days: 7 },
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
  const addedForLog = changeLabels(r.added);
  world.log(`Cycle ${n}${n > 1 && addedForLog.length ? ` (+ ${addedForLog.join(", ")})` : `: ${label}`} → ${signed(d)} avg well-being ${vs}`, "civic");
  setCycleBusy(false);
  renderCyclePanel();
  $("cyclePanel").scrollTop = 0;
  worldFeedback('cycle',{
    label:n===1?'Paired weekly result':'Civic cycle '+n,
    message:n===1 ? 'Same starting town and seed: '+label+' versus no plan. These are synthetic matched-model results.' : 'Same-seed comparison with keeping plan '+(n-1)+'. Synthetic model results.',
    metrics:[
      {label:n===1?'No plan':'Keeping previous plan',value:fmt(r.avg.noPlan)},
      {label:'With selected plan',value:fmt(r.avg.withPlan)},
      {label:'Well-being difference',value:signed(d)},
      {label:'Residents better off',value:String(r.improved)},
      {label:'Residents worse off',value:String(r.worse)},
    ],
    resultId:'cyclePanel',
  });
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

  const addedLabels = changeLabels(r.added);
  const removedLabels = changeLabels(r.removed);
  // Cycle 2+: what the journals changed, and what nothing in the catalog can fix yet.
  const changes = n > 1 ? `
    <div class="cy-who" style="margin-top:8px">
      <div class="lbl">What residents' journals changed</div>
      ${r.waiting
        ? `<div><b>⏳ Leaning toward ${esc(r.waiting.label)}</b> <span class="muted">(${r.waiting.streak} of ${r.waiting.needed} rounds)</span></div>`
        : addedLabels.length
          ? addedLabels.map((name) => `<div><b style="color:var(--accent)">+ ${esc(name)}</b>${r.source === "dear-congress" ? ` <span class="muted">adopted by dear-congress</span>` : ""}</div>`).join("")
          : `<div class="muted">No new simulated proposal.</div>`}
      ${removedLabels.length ? removedLabels.map((name) => `<div class="muted">− ${esc(name)}</div>`).join("") : ""}
      ${r.target ? `<div class="muted">${r.source === "dear-congress" ? "Complaint it answers" : "Top fixable complaint"}: ${esc(r.target?.label || r.target?.id || "that issue")} (${r.target.count} residents)</div>` : ""}
      <div class="muted" style="margin-top:2px">${esc(r.note)}</div>
      ${r.unreachable?.length ? `<div class="warn">Can't fix yet: ${r.unreachable.map((u) => `${esc(u?.label || u?.id || "unknown")} (${u?.count ?? 0} residents)`).join(", ")}. No proposal in the plan catalog reaches this in the simulation.</div>` : ""}
    </div>` : "";

  // Cycle 2+: follow up on whoever the previous plan hurt most.
  const f = r.followUp;
  const followUp = n > 1 && f ? `
    <div class="cy-who">
      <div class="row" style="justify-content:space-between;margin:0"><b>${esc(f.name)}</b><button id="cycleFollowUp">Follow</button></div>
      <div class="lbl">Hurt most by plan ${f.byPlan}. Did plan ${n} help?</div>
      <div class="cy-fric" style="grid-template-columns:1fr auto;margin-top:4px">
        ${f.byPlan === 1 ? `<span>No plan</span><span>${fmt(f.noPlan1)}</span>` : `<span>Before plan ${f.byPlan}</span><span>${fmt(f.noPlan1)}</span>`}
        <span>Plan ${f.byPlan}</span><span>${fmt(f.plan1)}</span>
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

$("runCycleBtn")?.addEventListener("click", () => withClassicWorld(runCycle).catch(error=>worldFeedback("error",{label:"Weekly comparison unavailable",message:error.message})));
/* ---------------------------------------------------------------- */
/* Demo mode: three cycles hands-free, with captions and follow-cam.  */
/* ---------------------------------------------------------------- */
// synthetic=0: load dear-congress packages from real journals only, the same view
// cycles use. The blended view counts synthetic journals the world has published
// over time (including grocery complaints), which would make cycle 1 unpredictable.
const DEMO_URL = "/world/?lat=29.7286&lng=-95.4746&people=500&demo=1&synthetic=0";
const QUICK_DEMO = params.get('quick') === '1';
const DEMO_HOLD_MS = QUICK_DEMO ? 1700 : 8000; // short highlight or original full tour
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
    await demoHold(QUICK_DEMO ? 750 : 7000);

    // Cycle 1: the Balanced plan vs. an identical town with no plan.
    activePolicyId = balancedPackageId();
    $("policy").value = activePolicyId;
    policyYear = 3;
    const plan1Label = PLAN_PACKAGES[activePolicyId]?.label || "Balanced";
    demoCaption("Cycle 1", `Trying the ${plan1Label} plan for a week, next to an identical copy of the town with no plan…`);
    const r1 = await demoCycle(runCycle);
    deltas.push({ n: 1, text: signed(r1.avg.withPlan - r1.avg.noPlan) });
    demoShow("noPlan");
    demoCaption("Cycle 1", `A week with no plan: average well-being ${fmt(r1.avg.noPlan)}.`);
    await demoHold(QUICK_DEMO ? 1300 : 5000);
    demoShow("withPlan");
    followResident(r1.best.index);
    demoCaption("Cycle 1", `With the ${plan1Label} plan: ${fmt(r1.avg.withPlan)} (${deltas[0].text}). ${r1.improved} residents are better off, mostly from shorter commutes.`);
    await demoHold();
    if (r1.worst) {
      demoShow("withPlan", "worst");
      followResident(r1.worst.index);
      demoCaption("Cycle 1", `But ${r1.worse} residents are worse off, like ${r1.worst.name}: ${fmt(r1.worst.noPlan)} without the plan, ${fmt(r1.worst.withPlan)} with it. They write about it in their journals.`);
      await demoHold();
    }

    if (!QUICK_DEMO) {
    // Then let residents' journals drive the plan until two more changes land.
    // With dear-congress live, a change can take two cycles: it leans first, then adopts.
    let changes = 0;
    for (let n = 2; n <= 5 && changes < 2; n++) {
      demoCaption(`Cycle ${n}`, `Reading this week's journals to pick the next change…`);
      const r = await demoCycle(runNextCycle);
      const d = r.avg.withPlan - r.avg.noPlan;
      const why = r.target ? `${r.target.count} residents wrote about ${r.target?.label || r.target?.id || "that issue"}` : "Residents' journals changed the plan";
      if (r.waiting) {
        deltas.push({ n, text: "waited" });
        demoShow("withPlan");
        demoCaption(`Cycle ${n}`, `${why}. dear-congress is leaning toward ${r.waiting.label} (${r.waiting.streak} of ${r.waiting.needed} rounds), but it won't change a city plan on one week of evidence. The plan stays the same this week.`);
        await demoHold();
        continue;
      }
      if (!r.added?.length && !r.removed?.length) {
        demoCaption(`Cycle ${n}`, "The journals don't point at anything the plan catalog can still fix, so the plan stays as it is.");
        await demoHold();
        break;
      }
      changes++;
      deltas.push({ n, text: signed(d) });
      const what = changeLabels(r.added).join(" and ") || "no new simulated proposal";
      const action = r.source === "dear-congress" ? `dear-congress adopted ${what}` : `${what} added`;
      demoShow("withPlan");
      demoCaption(`Cycle ${n}`, `${why} → ${action}. ${signed(d)} well-being compared with keeping plan ${n - 1}; ${r.improved} residents better off, ${r.worse} worse off.`);
      await demoHold();
      const f = r.followUp;
      if (f && f.plan2 - f.keepPlan1 >= 3) { // only a recovery worth pointing at
        followResident(f.index);
        demoCaption(`Cycle ${n}`, `${f.name} was hurt most by plan ${f.byPlan}. Keeping the current plan: ${fmt(f.keepPlan1)}. With plan ${n}: ${fmt(f.plan2)}.`);
        await demoHold();
      }
    }

    }
    demoCaption("Recap", `${deltas.map((x) => `Cycle ${x.n}: ${x.text}`).join(" · ")}. Both futures share the same starting town and seed. Differences are synthetic model results.`);
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
      const probe = { ...p, today: sourceDay, travelMinutesAvg3d:p.travelMinutesAvg3d??p.walkMinutesAvg3d, walkMinutesAvg3d: Number(p.walkMinutesAvg3d || 0) };
      const text = journalFor(probe, {
        tileKey,
        buildingsById,
        policyLabel: world.policy?.label || "No package",
        year: policyYear,
      });
      if (text) {
        const floodSeverity = sourceDay.displaced ? 2 : (sourceDay.homeFlooded ? 1 : 0);
        const transitSeverity = commuteBurdenMinutes(probe,{day:sourceDay,rolling:false})??0;
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
          travelMinutesAvg3d: commuteBurdenMinutes(p),
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
          signal: AbortSignal.any([startupAbort.signal,AbortSignal.timeout(8000)]),
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
let downAt = null,downVehicle = null;
let hoveredLegacyPerson=null,lastLegacyHoverAt=-Infinity;
const clearLegacyHover=()=>{hoveredLegacyPerson=null;if(!livingWorld?.active)renderer.domElement.style.cursor='';};
const hoverLegacyPerson=event=>{if(livingWorld?.active)return;if(event.buttons){clearLegacyHover();return;}const now=performance.now();if(now-lastLegacyHoverAt<75)return;lastLegacyHoverAt=now;const rect=renderer.domElement.getBoundingClientRect();ptr.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(ptr,camera);const person=humanPeople.pick(ray),building=ray.intersectObjects(meshes)[0];hoveredLegacyPerson=person&&(!building||person.distance<building.distance)?person.index:null;renderer.domElement.style.cursor=hoveredLegacyPerson===null?'':'pointer';};
renderer.domElement.addEventListener('pointermove',hoverLegacyPerson);renderer.domElement.addEventListener('pointerleave',clearLegacyHover);controls.addEventListener('start',clearLegacyHover);
addEventListener('pagehide',()=>{renderer.domElement.removeEventListener('pointermove',hoverLegacyPerson);renderer.domElement.removeEventListener('pointerleave',clearLegacyHover);controls.removeEventListener('start',clearLegacyHover);},{once:true});
let businessMarker;
const focusBusiness = b => { controls.target.set(b.center[0], 0, b.center[1]); controls.update(); };
const businessUI = businessMode ? mountBusinessMode(world, {
  onFocus: focusBusiness,
  onPlace(b) {
    if (!businessMarker) {
      businessMarker = new THREE.Mesh(new THREE.TorusGeometry(18, 2, 8, 48), new THREE.MeshBasicMaterial({ color: 0x51e7ff, depthTest: false }));
      businessMarker.rotation.x = -Math.PI / 2;
      businessMarker.renderOrder = 10;
      scene.add(businessMarker);
    }
    businessMarker.position.set(b.center[0], 3, b.center[1]);
    focusBusiness(b);
  },
}) : null;
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY];ptr.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(ptr,camera);downVehicle=cityRenderer.pickVehicle?.(ray)||null; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if(e.defaultPrevented)return; // Living City claimed an actual sampled person; let OrbitControls finish release.
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; // was a drag
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hp = livingWorld?.active?null:humanPeople.pick(ray);
  const hb = ray.intersectObjects(meshes)[0];
  const hj = journalPins.length ? ray.intersectObjects(journalPins.map((x) => x.mesh))[0] : null;
  const vehicle=cityRenderer.pickVehicle?.(ray)||downVehicle;
  const populationHit=livingWorld?.pick(ray);
  if(populationHit&&(!hb||populationHit.distance<hb.distance)&&(!hp||populationHit.distance<hp.distance)&&(!hj||populationHit.distance<hj.distance)&&(!vehicle||populationHit.distance<vehicle.distance)){select(null);livingWorld.selectPerson(populationHit.personId);return;}
  if(vehicle&&(!hb||vehicle.distance<hb.distance)&&(!hp||vehicle.distance<hp.distance)&&(!hj||vehicle.distance<hj.distance)) {select(null);selectedVehicle=vehicle.id;vehicleInspector?.select(vehicle);return;}
  selectedVehicle=null;vehicleInspector?.select(null);
  if (businessUI && hb && (!hp||hb.distance<hp.distance)) {
    businessUI.choose(hb.object.userData.b);
    return;
  }
  if (hj) {
    const ji = hj.object.userData.journalIndex;
    select({ type: "journal", id: ji });
  } else if (hp && (!hb || hp.distance < hb.distance)) {if(emitLegacyPersonContext(e,hp.index)!==false)select({ type: "person", id: hp.index });}
  else if (hb) select({ type: "building", id: hb.object.userData.b.index });
  else select(null);
});
addEventListener("keydown", (e) => { if (e.key === "Escape") select(null); });

function emitLegacyPersonContext(event,index){const person=town.people[index];return window.dispatchEvent(new CustomEvent('world:person-context',{cancelable:true,detail:{mode:'legacy',actorId:selected?.type==='person'?String(town.people[selected.id].id):null,targetId:String(person.id),clientX:event.clientX,clientY:event.clientY,...(event.type==='contextmenu'?{trigger:'contextmenu'}:{})}}));}
renderer.domElement.addEventListener('contextmenu',event=>{if(livingWorld?.active||event.defaultPrevented)return;const bounds=renderer.domElement.getBoundingClientRect();ptr.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);ray.setFromCamera(ptr,camera);const hit=humanPeople.pick(ray),building=ray.intersectObjects(meshes)[0];if(hit&&(!building||hit.distance<building.distance)){event.preventDefault();emitLegacyPersonContext(event,hit.index);}});
function select(s) {
  selected = s;
  if(s?.type==='building'){const building=town.buildings[s.id];if(building)window.dispatchEvent(new CustomEvent('world:building-selected',{detail:{id:String(building.id)}}));}
  $('inspect').toggleAttribute('data-inspector-focused',Boolean(s));
  if(s?.type==="person")world.trackActivityPerson(String(town.people[s.id]?.id??s.id));
  document.documentElement.classList.toggle("person-selected",s?.type === "person");
  cityRenderer.updateCity({ selectedBuilding: s?.type === "building" ? town.buildings[s.id]?.id : null });
  follow = false;
  $("inspect").toggleAttribute("data-person-selected",s?.type === "person");
  $("inspect").style.display = s ? "block" : "none";
  renderInspector();
}

function needBars(p) {
  return personNeedsMarkup(legacyNeedSnapshot(p,world),{paused:speed===0||Boolean(livingWorld?.active)});
}

function renderInspector() {
  const el = $("inspect");
  const previousJournal=el.querySelector('[data-character-journal]');
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
    const household=householdForPerson(world,p),householdCash=household?.cash;
    const cashLabel=Number.isFinite(householdCash)?`Household cash: $${householdCash.toFixed(0)}`:Number.isFinite(p.money)?`Cash (legacy record): $${p.money.toFixed(0)}`:"Household cash unavailable";
    const job = p.job != null ? town.buildings[p.job].name : p.school != null ? town.buildings[p.school].name : "—";
    el.innerHTML = `<h1>${p.name}</h1>
      <div class="muted">${p.age} · ${p.trait} · ${cashLabel}</div>
      <div style="margin:8px 0"><b>${p.doing}</b></div>
      ${needBars(p)}
      <div class="muted" style="margin-top:8px">Lives at ${home.name}<br/>${p.age < 18 ? "School" : "Works at"}: ${job}</div>
      <div class="row"><button id="followBtn" class="${follow ? "on" : ""}">${follow ? "Following" : "Follow"}</button><button data-b="${p.home}">Show home</button></div>`;
    $("followBtn").onclick = () => { follow = !follow; renderInspector(); };
    el.style.maxHeight='calc(100vh - 112px)';el.style.overflowY='auto';
    const relationships=document.createElement('section');el.append(relationships);
    const social=legacySocial(world),id=String(p.id??selected.id);
    const reuseJournal=previousJournal?.dataset.characterJournal===id;const journal=reuseJournal?previousJournal:document.createElement('section');journal.dataset.characterJournal=id;el.append(journal);if(!reuseJournal)mountCharacterJournal(journal,{personId:id,recorder:legacyJournalRecorder,current:()=>{const e=ensureJournal(world.journals,id,p.name,world.t);return {...structuredClone(e),text:journalText(e)};},routine:p.age<18?'wake up · school · meals · play · home · sleep':'wake up · meals · work or errands · park · home · sleep'});
    renderRelationships(relationships,social.inspect(id),{onSelect:id=>{const index=town.people.findIndex((p,i)=>String(p.id??i)===String(id));if(index>=0)select({type:'person',id:index});},onInteract:(targetId,action)=>social.interact(id,targetId,action)});
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
        <button id="cityFocus">Focus</button>${b.kind !== "park" ? `<button id="cityCutaway">Cutaway</button>` : ""}
        ${["food", "shop", "work", "school"].includes(b.kind) ? `<button id="toggleOpen">${s.open ? "Close it" : "Reopen"}</button>` : ""}
        ${s.maxStock ? `<button id="restock">Deliver stock</button>` : ""}
        ${b.kind === "park" ? `<button id="litterBtn">Dump litter</button>` : ""}
      </div>`;
    mountAPIGeometryDetails(el,{area:originalAreaGeometry,buildingId:b.id});el.style.maxHeight='calc(100vh - 112px)';el.style.overflowY='auto';
    $("cityFocus")?.addEventListener("click", () => cityRenderer.focusBuilding(b.id));
    $("cityCutaway")?.addEventListener("click", () => { cityRenderer.focusBuilding(b.id); cityRenderer.setCutaway(!cityRenderer.cutawayEnabled); });
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
let lastEmbedPostT = -Infinity;
let last = performance.now();

function frame(now) {
  if(startupAbort.signal.aborted)return;
  mapControls.update(now);fpsMeter.update(now);if(selectedVehicle&&now-lastVehicleUpdate>200){lastVehicleUpdate=now;const vehicle=cityRenderer.getVehicle?.(selectedVehicle);if(vehicle)vehicleInspector?.update(vehicle);}if(manualPanRequested){follow=false;manualPanRequested=false;}
  if(streamingEnabled||Math.hypot(controls.target.x,controls.target.z)>400){streamingEnabled=true;mapStreamer.update();}updateContextMinimap();
  const cpuStart = performance.now();
  const frameMs = now - last;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // Advance the simulation in whole game minutes.
  const simulationFrame=playback.update(now);
  if(!livingWorld?.active)acc += simulationFrame.deltaMs/1000;
  const steps = livingWorld?.active?0:Math.floor(acc);
  if (steps > 0) { world.step(Math.min(steps, 240));if(legacyJournalRecorder)void legacyJournalRecorder.flush(); acc -= steps; if(selected?.type === "person")renderInspector(); }

  // Once per simulated day per tile: publish a few synthetic resident journals.
  // Trigger after 8:00 local sim time so demos show the loop quickly.
  // Possible realities are counterfactual worlds: their residents never post to Dear Congress.
  if (!livingWorld?.active && !realityRunSeed && world.day() > lastJournalDay && world.minuteOfDay() >= 8 * 60) {
    publishSyntheticJournalsForDay(world.day());
  }

  if(!livingWorld?.active)businessUI?.update();
  livingWorld?.update(now);

  // Keep the default daylight lighting independent of the simulation clock.
  // Only follow simulated time when explicitly selected in the renderer controls.
  const livingMinute=livingWorld?.active?livingWorld.getClockMinute():null;
  const policyFrame=livingWorld?.active?physicalPolicySnapshot:null;
  const policyMinute=Number.isFinite(livingMinute)?livingMinute:world.t;
  physicalPolicyLayer.update({minute:policyMinute,transitService:livingWorld?.active?(policyFrame?.config?.transitService??0):(world.transitServiceMult??0),projects:world.projects??[],districts:policyFrame?.districts??[],source:livingWorld?.active?'Living configured transit service; no civic project ledger supplied':'Legacy transitServiceMult; actual civic projects only'});
  const m = cityRenderer.timeOfDay != null ? cityRenderer.timeOfDay * 60 : Number.isFinite(livingMinute) ? livingMinute % 1440 : world.minuteOfDay();
  const daylight = Math.max(0, Math.sin(((m - 6 * 60) / (14 * 60)) * Math.PI)); // 6am–8pm arc
  sky.copy(night).lerp(day, daylight);
  scene.background = buildingBridge?.worldVisuals.skyColor ? new THREE.Color(buildingBridge.worldVisuals.skyColor) : sky;
  hemi.intensity = (buildingBridge?.worldVisuals.nightBrightness ?? 0.12) + 0.42 * daylight;
  hemi.color.setHex(0xc5ddf2);hemi.groundColor.setHex(0x55523f);
  sun.intensity = 2.8 * daylight;
  sun.color.setHex(daylight < .35 ? 0xffce98 : 0xffefda);
  const ang = ((m - 6 * 60) / (14 * 60)) * Math.PI;
  sun.position.set(Math.cos(ang) * 400, Math.max(40, Math.sin(ang) * 500), 200);

  // People
  // In the well-being and cycle overlays everyone is shown (indoors too), colored red→green.
  const wbOverlay = overlayMode === "wellbeing" || (overlayMode === "cycle" && cycleResult);
  const cycleScores = overlayMode === "cycle" && cycleResult ? cycleResult.scores[cycleView] : null;
  for (let i = 0; !livingWorld?.active && i < town.people.length; i++) {
    const p = town.people[i];
    const s = smooth[i];
    const k = playback.getState().paused?0:1 - Math.exp(-dt * 10);
    s.x += (p.x - s.x) * k;
    s.z += (p.z - s.z) * k;
    const selectedPerson = selected?.type === "person" && selected.id === i;
    const withinDetailBudget = (i * 0.61803398875) % 1 < cityRenderer.density;
    const visible = (p.travelMode!=="transit"||p.transitWaitMinutesRemaining>0)&&(wbOverlay || selectedPerson || (withinDetailBudget && (p.mode === "moving" || OUTDOOR.has(p.action))));
    const scale = visible ? (p.age < 13 ? 0.7 : 1) * (wbOverlay ? 1.8 : 1) : 0;
    const hex=cycleScores?wellbeingHex(cycleScores[i]??0):wbOverlay?wellbeingHex(wellbeing(p)):null;
    humanPeople.setPerson(i,{id:p.id??i,x:s.x,z:s.z,scale,visible,selected:selectedPerson,hovered:hoveredLegacyPerson===i,heading:Math.atan2(p.x-s.x,p.z-s.z),...(hex==null?{}:{shirtColor:hex})});
  }
  humanPeople.commit();

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
    if (selected && selected.type !== "person") renderInspector();
    if (embedMode && window.parent !== window && world.t - lastEmbedPostT >= 60) {
      lastEmbedPostT = world.t;
      const s = world.summary();
      window.parent.postMessage({ type: "hbl-world", reality: realityIndex == null ? null : Number(realityIndex), clock: clock(world.t), day: world.day(), mood: s.mood, displaced: world.policy?.displaced || 0 }, location.origin);
    }
  }

  controls.update();
  if(buildingDateBridge?.get().enabled&&now-buildingDateLastRefresh>500){buildingDateLastRefresh=now;buildingDateBridge.refresh();}
  personCommandUI?.update();
  houseEntryControls?.update();
  gpuParticleMenu?.update();
  const drawCity=cityRenderer.beforeFrame(now,dt,daylight,selected?.type==='building'?selected.id:null,buildingBridge?.worldVisuals,{now:simulationFrame.simulationNow/10,dt:simulationFrame.deltaMs/10000});
  if(livingWorld?.active)livingWorld.applyBuildingOccupancy?.();
  if(drawCity){renderer.render(scene,camera);if(scrapbook&&scrapbookSource)void scrapbook.afterRender(renderer.domElement,scrapbookSource);}
  cityRenderer.afterFrame(now, performance.now() - cpuStart, frameMs);
  requestAnimationFrame(frame);
}

function updateBuildings(daylight) {
  const occupied = new Map();
  for (const p of town.people) if (p.mode === "doing" && p.target != null) occupied.set(p.target, (occupied.get(p.target) || 0) + 1);
  const floodSourceReal = area.floodZonesSource === "fema-nfhl";
  const walkByHome = new Map();
  for (const p of town.people) {
    const rec = walkByHome.get(p.home) || { sum: 0, n: 0 };
    const travel=commuteBurdenMinutes(p);if(Number.isFinite(travel)){rec.sum+=travel;rec.n+=1;}
    walkByHome.set(p.home, rec);
  }
  for (const b of town.buildings) {
    const mat = b.mesh.material;
    const n = occupied.get(b.index) || 0;
    const base = b.baseColor || KIND_COLOR[b.kind];
    mat.emissive.setHex(base);
    // Windows glow at night where people are inside; busy shops glow a little by day.
    mat.emissiveIntensity = b.kind === "park" ? 0 : Math.min(0.45, n * 0.07) * (1 - daylight * 0.85);
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
    mat.color.set(buildingBridge?.worldVisuals.facadeColor && b.kind !== "park" ? buildingBridge.worldVisuals.facadeColor : c);
    b.mesh.scale.y = (buildingBridge?.worldVisuals.heightScale || 1) * Math.max(0.5, Math.min(1.8, buildingBridge?.futureMapping.supplyIndex || 1));
    if (buildingBridge?.futureMapping.recordedMonth != null && b.kind !== "park") mat.color.lerp(new THREE.Color(0x33464b), Math.max(0, Math.min(0.6, (buildingBridge.futureMapping.vacancyPercent || 0) / 100)));
  }
}

let lastFirstRunSampleMs = -Infinity;
function updateHud() {
  const livingSnapshot=livingWorld?.active?livingWorld.getSnapshot():null;
  $("clock").textContent = livingSnapshot?clock(livingSnapshot.minute):clock(world.t);
  $("moodLabel").textContent=livingSnapshot?"Modeled utility":"Mood";
  $("source").textContent=$("source").textContent.replace(/[\d,]+ synthetic residents/,`${(livingSnapshot?.population??town.people.length).toLocaleString()} synthetic residents`);
  if (!journalInFlight) {
    if (world.day() <= lastJournalDay) journalDiag.status = "done for today";
    else if (world.minuteOfDay() < 8 * 60) journalDiag.status = "waiting for 08:00";
    else journalDiag.status = "pending";
    renderJournalDiagnostics();
  }
  const s = livingSnapshot?{mood:100*(livingSnapshot.metrics?.modeledUtility??0),doing:Object.fromEntries(Object.entries(livingSnapshot.activityCounts||{}).map(([key,value])=>[{HOME:"at home",WORK:"working",SCHOOL:"at school",TRANSIT:"traveling",DINING:"eating",RECREATION:"recreation",SHOPPING:"shopping"}[key]||key.toLowerCase(),value]))}:world.summary();
  $("mood").style.width = `${s.mood}%`;
  $("moodN").textContent = s.mood.toFixed(0);
  const top = Object.entries(s.doing).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const status = world.policy.floodedNow ? ` · ${world.policy.floodedNow} flooded parcels · ${world.policy.displaced} displaced` : "";
  $("counts").textContent = top.map(([k, v]) => `${v} ${k}`).join(" · ") + status;
  const firstRunNow = performance.now();
  if(window.hblGuidedActions && firstRunNow-lastFirstRunSampleMs>=1100) {
    lastFirstRunSampleMs=firstRunNow;
    worldFeedback('snapshot',{
      mode:livingSnapshot?'living':'legacy',mood:s.mood,minute:livingSnapshot?.minute ?? world.t,
      clock:$("clock").textContent,
      activity:top.slice(0,2).map(([kind,count])=>count+' '+kind).join(' · '),
    });
  }
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
        const observedTravel=town.people.map(p=>commuteBurdenMinutes(p)).filter(Number.isFinite);
        const commuteShare=observedTravel.length?observedTravel.filter(minutes=>minutes>WALK_COMPLAINT_MINUTES).length/observedTravel.length:null;
        const floodSeveritySim = Math.max(0, Math.min(1, Number(world.policy?.displaced || 0) / (0.1 * pop)));
        const floodTxt = `${floodSeveritySim.toFixed(2)} sim vs ${Number(flood.severity).toFixed(2)} measured (${flood.year}, ${flood.source?.name || "source"})`;
        const transitTxt = transit
          ? `${Number.isFinite(commuteShare)?commuteShare.toFixed(2):"unavailable"} sim vs ${Number(transit.value).toFixed(3)} measured (${transit.year}, ${transit.source?.name || "source"})`
          : `${Number.isFinite(commuteShare)?commuteShare.toFixed(2):"unavailable"} sim vs n/a measured`;
        rc.textContent = `Flooding severity: ${floodTxt} · All-purpose travel share over ${WALK_COMPLAINT_MINUTES}m (not a work-only commute measure): ${transitTxt}`;
      }
    }
  }

  if (world.events.length && world.events[0] !== lastEvents) {
    lastEvents = world.events[0];
    $("feed").innerHTML = world.events.slice(0, 25)
      .map((e) => `<div data-b="${e.building ?? ""}"><b>${clock(e.t).replace(/^\w+ /, "")}</b>${e.text}</div>`).join("");
  }
}



// A saved experiment restores the authoritative checkpoint before the first live tick.
let experimentRestored=!loadedExperiment;
if(loadedExperiment){
 const saved=loadedExperiment.save;
 try{playback.pause();if(saved.mode==='living'){await livingWorld.setActive(true);const runtime=livingWorld.getRuntime();runtime.pause();await runtime.restoreCheckpoint(saved.checkpoint);if(saved.view.livingCulture)livingWorld.getCultureSimulation()?.restore(saved.view.livingCulture);}else{await livingWorld?.setActive(false);world.restoreCheckpoint(saved.checkpoint);}
 if(saved.view.camera?.position?.length===3&&saved.view.camera?.target?.length===3){camera.position.fromArray(saved.view.camera.position);controls.target.fromArray(saved.view.camera.target);controls.update();}
 if(saved.view.graphics){const graphics=saved.view.graphics;if(graphics.quality)cityRenderer.setQuality(graphics.quality);if(graphics.settings?.targetFPS)cityRenderer.setTargetFPS(graphics.settings.targetFPS);for(const [name,value] of Object.entries(graphics.features??{}))cityRenderer.setFeature(name,value);}if(saved.mode==='living' && params.has('person')){
   const personId=params.get('person');const runtime=livingWorld.getRuntime();
   if(!await runtime.inspectPerson(personId))throw Error('That resident is absent from this checkpoint.');
   await livingWorld.selectPerson(personId);
   const {journeyURL}=await import('./future-journey/navigation.js');
   const {inspectFuture}=await import('./future-journey/model.js');
   const {readPopulationCheckpoint}=await import('./population/checkpoint.js');
   const exact=inspectFuture({record:loadedExperiment,state:readPopulationCheckpoint(saved.checkpoint)},personId);
   const navigation=document.createElement('nav');
   navigation.className='saved-future-navigation';
   navigation.setAttribute('aria-label','Saved future');
   for(const [surface,label] of [['worldline','Return to Worldline'],['house','Open exact household in House Simulator']]){
     const link=document.createElement('a');link.textContent=label;
     link.href=journeyURL(surface,exact,location.search);
     navigation.append(link);
   }
   $('top').querySelector('summary').after(navigation);
 }else if(saved.view.selection){if(saved.mode==='living')await livingWorld.selectPerson(saved.view.selection.id);else select(saved.view.selection);}
 if(saved.view.policyPackages)PLAN_PACKAGES=structuredClone(saved.view.policyPackages);activePolicyId=saved.view.policy??'none';policyYear=saved.view.planYear??0;if($('policy'))$('policy').value=activePolicyId;if(planYearEl)planYearEl.value=String(policyYear);
 const settings=saved.view.playback;if(settings){playback.setSpeed(settings.speed);settings.paused||params.has('person')?playback.pause():playback.resume();}
 if(saved.view.buildingWorkspace){if(!buildingBridge?.restoreCheckpoint)throw Error('Construction checkpoint adapter unavailable');await buildingBridge.ready;buildingBridge.restoreCheckpoint(saved.view.buildingWorkspace);}
 experimentRestored=true;
 }catch(error){playback.pause();startup.restoreError=error.message;const notice=document.createElement('p');notice.style.cssText='position:fixed;top:80px;left:20px;z-index:999;background:#641f28;color:white;padding:16px';notice.textContent='Saved experiment restoration failed; playback paused: '+error.message;document.body.append(notice);}
}
let questionsPanel=null,questionsDisposed=false;
if(!embedMode)void import('./questions/panel.js').then(({mountOpenQuestions})=>{if(questionsDisposed)return;questionsPanel=mountOpenQuestions({container:$('top'),getContext:async()=>{camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));const visible=[...town.buildings,...contextBuildings.values()].filter(b=>b.mesh?.visible&&frustum.intersectsObject(b.mesh)).sort((a,b)=>Math.hypot(a.center[0]-controls.target.x,a.center[1]-controls.target.z)-Math.hypot(b.center[0]-controls.target.x,b.center[1]-controls.target.z));const frame=livingWorld?.active?livingWorld.getSnapshot():null;const person=livingWorld?.active?livingWorld.getSelection():selected;const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),groundCorners=[];for(const x of [-1,1])for(const y of [-1,1]){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),camera);const point=ray.ray.intersectPlane(groundPlane,new THREE.Vector3());if(point&&ray.ray.origin.distanceTo(point)<=camera.far)groundCorners.push(point);}return{origin,bounds:groundCorners.length?{minX:Math.min(...groundCorners.map(p=>p.x)),maxX:Math.max(...groundCorners.map(p=>p.x)),minZ:Math.min(...groundCorners.map(p=>p.z)),maxZ:Math.max(...groundCorners.map(p=>p.z))}:{},visibleBuildingIds:visible.map(b=>String(b.id)),selectedEntity:person?{id:String(person.id??person.personId),kind:livingWorld?.active?'person':person.type}:null,config:frame?.config??world.params,metrics:frame?.metrics??{minute:world.t,population:world.people.length},recentLogs:[{id:'observation-scope',time:livingWorld?.active?livingWorld.getClockMinute():world.t,type:'source-scope',text:'Resident metrics and logs describe the original modeled region at '+origin.lat+','+origin.lng+'; streamed neighboring map geometry does not extend the resident simulation.'},...(livingWorld?.active?frame?.events??[]:world.events).slice(0,39)].map(e=>({id:String(e.id??e.t??e.minute),time:e.minute??e.t??e.time,type:e.type,text:e.text,entityId:e.personId?String(e.personId):undefined}))};}});window.hblOpenQuestions=questionsPanel;}).catch(error=>console.error('Open questions unavailable',error));
addEventListener('pagehide',()=>{questionsDisposed=true;questionsPanel?.destroy();},{once:true});
let persistencePanel=null,persistenceDisposed=false;
if(!embedMode)void import('./experiments/persistence-panel.js').then(({mountWorldPersistence})=>{if(persistenceDisposed)return;persistencePanel=mountWorldPersistence({container:$('top'),currentId:loadedExperiment?.id,canCapture:()=>experimentRestored&&(!livingWorld?.active||typeof livingWorld.getRuntime()?.exportCheckpoint==='function'),capture:captureWorldExperiment});window.hblWorldPersistence=persistencePanel;}).catch(error=>console.error('World persistence unavailable',error));
async function captureWorldExperiment({keepPaused=false}={}){
 const wasPaused=playback.getState().paused;playback.pause();let captured=false;try{const mode=livingWorld?.active?'living':'legacy',checkpoint=mode==='living'?await livingWorld.getRuntime().exportCheckpoint():world.captureCheckpoint(),buildingWorkspace=buildingBridge?.captureCheckpoint?await buildingBridge.captureCheckpoint():null;const save={schemaVersion:'world-experiment-save.v1',label:'City experiment',mode,checkpoint,geometry:{area:structuredClone(originalAreaGeometry)},view:{origin:{...origin},maxPeople,camera:{position:camera.position.toArray(),target:controls.target.toArray()},playback:{...playback.getState(),paused:wasPaused},policy:activePolicyId,planYear:policyYear,policyPackages:structuredClone(PLAN_PACKAGES),selection:mode==='living'?livingWorld.getSelection()?{id:String(livingWorld.getSelection().id??livingWorld.getSelection().personId),type:'person'}:null:selected?{...selected}:null,graphics:cityRenderer.getPerformanceStats(),urlSettings:Object.fromEntries(params),buildingDateFilter:buildingDatePanel?.get()??null,...(buildingWorkspace?{buildingWorkspace}:{}),...(mode==='living'&&livingWorld.getCultureSimulation()?.serialize?{livingCulture:livingWorld.getCultureSimulation().serialize()}:{}),coverage:{authority:'complete versioned active model checkpoint',excluded:['streamed context geometry','separate comparison experiments','browser scrapbook','external journal archives','uncommitted UI drafts']}}};captured=true;return save;}finally{if(!wasPaused&&(!keepPaused||!captured))playback.resume();}
}
window.hblCaptureWorldExperiment=captureWorldExperiment;
let personCommandUI=null,personCommandDisposed=false;
function commandSelection(){if(livingWorld?.active){const person=livingWorld.getSelection();return person?{...person,id:String(person.id??person.personId),label:person.name??'Person '+(person.id??person.personId),mode:'living'}:null;}if(selected?.type!=='person')return null;const person=town.people[selected.id];return person?{...person,id:String(person.id),label:person.name,mode:'legacy'}:null;}
if(!embedMode)void import('./people/person-command-menu.js').then(({mountPersonCommands})=>{if(personCommandDisposed)return;personCommandUI=mountPersonCommands({container:document.body,canvas:renderer.domElement,getSelection:commandSelection,isPaused:()=>playback.getState().paused,onSelect:(mode,id)=>{if(mode==='living')return livingWorld.selectPerson(id);const index=town.people.findIndex(p=>String(p.id)===String(id));if(index>=0)select({type:'person',id:index});},toGround:event=>{const rect=renderer.domElement.getBoundingClientRect(),picker=new THREE.Raycaster();picker.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const point=picker.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());return point&&picker.ray.origin.distanceTo(point)<=camera.far?{x:point.x,z:point.z}:null;},onWalk:async(actor,point)=>{if((livingWorld?.active?'living':'legacy')!==actor.mode)throw Error('The active simulation changed. Select a person again.');if(actor.mode==='living'){const runtime=livingWorld.getRuntime();if(!runtime?.walkPerson)throw Error('Resident walk commands are not ready.');const result=await runtime.walkPerson(actor.id,point);await livingWorld.selectPerson(actor.id);return{...result,message:`Walking trip accepted · ${result.plannedMinutes.toFixed(1)} modeled minutes.`};}if(!world.commandPerson)throw Error('Legacy walk commands are not ready.');const result=world.commandPerson(actor.id,{type:'walk',destination:point});renderInspector();return result;},onSocial:async(actor,targetId,action)=>{if((livingWorld?.active?'living':'legacy')!==actor.mode)throw Error('The active simulation changed. Select a person again.');if(actor.mode==='living'){const result=await livingWorld.getRuntime().socialAction(actor.id,String(targetId),action);await livingWorld.selectPerson(actor.id);return result;}const result=legacySocial(world).interact(actor.id,String(targetId),action);renderInspector();return result;}});window.hblPersonCommands=personCommandUI;}).catch(error=>console.error('Person commands unavailable',error));
addEventListener('pagehide',()=>{personCommandDisposed=true;personCommandUI?.destroy();},{once:true});

let houseEntryControls=null,houseEntryDisposed=false;
if(!embedMode)void import('./house/bridge.js').then(({mountHouseEntryControls})=>{if(houseEntryDisposed)return;houseEntryControls=mountHouseEntryControls({container:document.body,getSelection:()=>selected?.type==='building'?null:livingWorld?.active?livingWorld.getSelection()?{...livingWorld.getSelection(),mode:'living'}:null:selected?.type==='person'?{...town.people[selected.id],mode:'legacy'}:null,getBuilding:()=>selected?.type==='building'?town.buildings[selected.id]:null,getRuntime:()=>livingWorld?.active?livingWorld.getRuntime():null,capture:captureWorldExperiment,getPreferredHousehold:()=>livingWorld?.getSelection()?.householdId??loadedExperiment?.save.view.houseMode?.householdId??null,getParentId:()=>persistencePanel?.getState().id??loadedExperiment?.id,restorePlayback:state=>{state.paused?playback.pause():playback.resume();}});window.hblHouseEntry=houseEntryControls;});
addEventListener('pagehide',()=>{houseEntryDisposed=true;houseEntryControls?.destroy();},{once:true});
addEventListener('pagehide',()=>{persistenceDisposed=true;persistencePanel?.destroy();},{once:true});

if(!loadedExperiment)world.log(`Welcome to ${origin.lat.toFixed(3)}, ${origin.lng.toFixed(3)}. Click a person or building.`, "info");
// The guide becomes actionable only after the actual World scene is ready.
if (!embedMode && !businessMode && !simulationId && !loadedExperiment) {
  window.hblGuidedActions = {
    week: () => withClassicWorld(async()=>{if(cycleBusy)throw new Error("A cycle is already running.");const completed=nextCycleResult();runCycle();return completed;}),
    storm: () => withClassicWorld(triggerStorm),
    tenYear: () => withClassicWorld(runExperiment10Years),
    resident: () => withClassicWorld(() => {
      if (!town.people.length) throw new Error("No simulated residents are available.");
      followResident(0);
      worldFeedback('resident',{label:'Resident selected',message:'The camera is following a synthetic resident. Their current needs and activities are shown in the inspector.'});
    }),
  };
  window.dispatchEvent(new CustomEvent('hbl:world-ready'));
  addEventListener('pagehide',()=>{delete window.hblGuidedActions;},{once:true});
}
startup.readyMs=performance.now();for(const [node,disabled] of startupDisabled)node.disabled=policyPending&&['policy','runExperimentBtn','runCycleBtn','demoBtn'].includes(node.id)?true:disabled;startupActive=false;if(startupRAF!==null)cancelAnimationFrame(startupRAF);
requestAnimationFrame(frame);
