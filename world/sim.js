import {installLegacyPersonCommands} from './person-commands.js';
import {captureLegacyCheckpoint,restoreLegacyCheckpoint} from './legacy-checkpoint.js';
import {ensureJournal,recordJournalInterval,recordJournalMoment} from './journals/model.js';
// Sims-style needs + utility AI. Buildings advertise actions; each person scores every
// nearby advertisement against their needs, walks there, does it, and the action changes
// shared world state (stock, cash, fridges, litter). Pure module, deterministic per seed.

import { rng, hashSeed } from "./gen.js";
import { createActivityHistory, recordActivity, recordHistoryEvent, snapshotActivityHistory } from "./activity-history.js";
import { createCultureSimulation, cultureEffectsForDistrict } from "./culture/culture-simulation.js";
import { resolveSimulationParameters, SIMULATION_MODEL_METADATA } from "./simulation-parameters.js";
import { captureSimulationState, restoreSimulationState } from "./simulation-state.js";
import { createWeatherSimulation } from "./weather/weather-simulation.js";

const DECAY = { hunger: 0.09, energy: 0.045, fun: 0.05, social: 0.04 }; // per game minute
// Physical walking speed is independent of transit policy.
export const WALK_M_PER_MIN = 40; // 2.4 km/h: an unhurried stroll.
const ROAD_CONNECT_MAX_M = 220;

/**
 * Each action: where it happens, how long, what it does to needs per minute,
 * one-off effects on start, and when it's available.
 */
export const ACTIONS = {
  visit_business: {
    at: "business", label: "visiting your business", minutes: () => 25,
    rate: { fun: 1.2, social: 0.5 },
    ok: (p, b, w) => w.business?.building === b.index && w.business.open && w.isDaytime() && w.business.stock > 0 && p.money >= w.business.price,
    start: (p, b, w) => {
      const business = w.business;
      business.stock--; business.visits++; business.revenue += business.price;
      p.money -= business.price;
      w.stats.spent += business.price;
      w.log(`${p.name} visited your business (+$${business.price.toFixed(2)})`, "business", b);
    },
  },
  sleep: {
    at: "home", label: "sleeping", minutes: (p) => Math.round(Math.max(60, Math.min(540, (100 - p.needs.energy) / 0.25))),
    rate: { energy: 0.25 }, // hunger also decays slower while asleep (see minute())
  },
  eat_home: {
    at: "home", label: "cooking at home", minutes: () => 30, rate: { hunger: 2.6, social: 0.2 },
    ok: (p, b) => b.state.fridge > 0,
    start: (p, b, w) => {
      b.state.fridge -= 1;
      if (b.state.fridge <= 0) p.today.emptyFridge = true;
      if (b.state.fridge === 0 && w.rand() < 0.08) w.log(`${p.name}'s fridge is empty`, "fridge", b);
    },
  },
  relax_home: { at: "home", label: "watching TV", minutes: () => 60, rate: { fun: 0.55, social: 0.15 } },
  work: {
    at: "job", label: "working", minutes: (p, w) => Math.max(1, p.shiftStart + p.shiftLen - w.minuteOfDay()),
    rate: { fun: -0.02, social: 0.06, energy: -0.01 }, pay: 0.3,
    ok: (p, b, w) => w.isWorkday() && !p.workedToday && b.state.open && w.minuteOfDay() >= p.shiftStart - 60 && w.minuteOfDay() < p.shiftStart + p.shiftLen,
  },
  wait_shift: { at: "none", label: "waiting for shift", minutes: (p,w) => Math.max(1,p.shiftStart-w.minuteOfDay()), rate: { social: 0.02 } },
  study: {
    at: "school", label: "at school", minutes: (p, w) => Math.max(30, 15 * 60 - w.minuteOfDay()),
    rate: { social: 0.12, fun: 0.05 }, ok: (p, b, w) => w.isWorkday() && !p.workedToday && w.minuteOfDay() >= 7 * 60 && w.minuteOfDay() < 14 * 60,
  },
  eat_out: {
    at: "food", label: "eating out", minutes: () => 35, rate: { hunger: 2.6, social: 0.6, fun: 0.3 }, cost: 12,
    ok: (p, b, w) => w.isOpen(b) && b.state.stock > 0 && p.money >= 12,
    start: (p, b, w) => {
      b.state.stock -= 1; b.state.cash += 12; p.money -= 12;
      if (b.state.stock === 0) w.log(`${b.name} sold out`, "soldout", b);
    },
  },
  groceries: {
    at: "shop", label: "buying groceries", minutes: () => 25, rate: { social: 0.2 }, cost: 30,
    ok: (p, b, w) => w.isOpen(b) && b.state.stock >= 5 && p.money >= 30 && p.age >= 16,
    // Groceries help hunger later (fridge), so they advertise hunger via the household fridge.
    advert: (p, w) => ({ hunger: w.buildings[p.home].state.fridge < 3 ? 40 : 5 }),
    start: (p, b, w) => {
      b.state.stock -= 5; b.state.cash += 30; p.money -= 30;
      w.buildings[p.home].state.fridge += 6;
      if (b.state.stock < 5) w.log(`${b.name} shelves are empty`, "soldout", b);
    },
  },
  play_park: {
    at: "park", label: "hanging out in the park", minutes: () => 60,
    rate: { fun: 1.0, social: 0.6 }, littered: true, // fun scales down with litter
    ok: (p, b, w) => w.isDaytime(),
    start: (p, b, w) => {
      if (b.state.litter > 50) p.today.dirtyParkVisits += 1;
      b.state.litter = Math.min(100, b.state.litter + (p.trait === "outdoorsy" ? 0.5 : 2));
      if (b.state.litter >= 60 && !b.flaggedDirty) { b.flaggedDirty = true; w.log(`${b.name} is getting trashed`, "litter", b); }
    },
  },
  clean_park: {
    at: "park", label: "picking up litter", minutes: () => 40, rate: { fun: 0.25, social: 0.3 },
    ok: (p, b, w) => w.isDaytime() && b.state.litter > 45 && p.age >= 10,
    advert: () => ({ fun: 25, social: 15 }),
    start: (p, b, w) => {
      if (b.state.litter > 50) p.today.dirtyParkVisits += 1;
      b.state.litter = Math.max(0, b.state.litter - 40);
      b.flaggedDirty = false;
      w.log(`${p.name} cleaned up ${b.name}`, "civic", b);
    },
  },
};

/** Net need change per simulated minute, shared by the model and person inspector. */
export function needRateFor(person, need, world) {
  if (!(need in DECAY)) return null;
  const action = person.mode === "doing" && person.action ? ACTIONS[person.action] : null;
  let rate = need === "hunger" && action && person.action === "sleep" ? -0.04 : -DECAY[need];
  if (action?.rate?.[need] != null) {
    let gain = action.rate[need];
    if (action.littered && need === "fun") gain *= 1 - (world?.buildings?.[person.target]?.state?.litter || 0) / 140;
    rate += gain;
  }
  return rate;
}
export function legacyNeedSnapshot(person, world) {
  return { needs: { ...person.needs }, needRates: Object.fromEntries(Object.keys(DECAY).map(key => [key, needRateFor(person, key, world)])), needActivity: person.doing || (person.mode === "doing" ? ACTIONS[person.action]?.label : null) || person.mode };
}

const TRAIT_BONUS = {
  foodie: { eat_out: 1.6 }, homebody: { relax_home: 1.5, eat_home: 1.3, play_park: 0.7 },
  "social butterfly": { eat_out: 1.3, play_park: 1.4 }, outdoorsy: { play_park: 1.7, clean_park: 1.8 },
  saver: { eat_out: 0.5, eat_home: 1.4 }, workaholic: {},
};

const clamp = (v) => (v < 0 ? 0 : v > 100 ? 100 : v);
// Sims-style curve: a need at 20 matters far more than a need at 70.
const urgency = (v) => ((100 - v) / 100) ** 2;

function roadNodeKey(x, z) {
  return `${x.toFixed(1)},${z.toFixed(1)}`;
}

function buildRoadGraph(roads = []) {
  const nodes = [];
  const adj = [];
  const byKey = new Map();

  const nodeId = (x, z) => {
    const key = roadNodeKey(x, z);
    if (byKey.has(key)) return byKey.get(key);
    const id = nodes.length;
    byKey.set(key, id);
    nodes.push([x, z]);
    adj.push([]);
    return id;
  };

  for (const rd of roads) {
    const pts = rd?.pts || [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      if (![ax, az, bx, bz].every(Number.isFinite)) continue;
      const a = nodeId(ax, az), b = nodeId(bx, bz);
      if (a === b) continue;
      const d = Math.hypot(bx - ax, bz - az);
      if (d < 0.5) continue;
      adj[a].push([b, d]);
      adj[b].push([a, d]);
    }
  }

  return { nodes, adj, routes:new Map() };
}

function nearestRoadNode(graph, x, z, maxDist = ROAD_CONNECT_MAX_M) {
  let best = -1;
  let bestD2 = maxDist * maxDist;
  for (let i = 0; i < graph.nodes.length; i++) {
    const [nx, nz] = graph.nodes[i];
    const d2 = (nx - x) ** 2 + (nz - z) ** 2;
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return best;
}

function aStarRoad(graph, start, goal) {
  if (start === goal) return [start];
  const n = graph.nodes.length;
  const g = new Array(n).fill(Infinity);
  const f = new Array(n).fill(Infinity);
  const came = new Array(n).fill(-1);
  const open = [start];
  const inOpen = new Array(n).fill(false);
  inOpen[start] = true;
  g[start] = 0;

  const heuristic = (id) => {
    const [x1, z1] = graph.nodes[id];
    const [x2, z2] = graph.nodes[goal];
    return Math.hypot(x2 - x1, z2 - z1);
  };
  f[start] = heuristic(start);

  while (open.length) {
    let bestI = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bestI]]) bestI = i;
    const cur = open[bestI];
    open.splice(bestI, 1);
    inOpen[cur] = false;

    if (cur === goal) {
      const ids = [cur];
      let at = cur;
      while (came[at] !== -1) { at = came[at]; ids.push(at); }
      ids.reverse();
      return ids;
    }

    for (const [next, w] of graph.adj[cur]) {
      const cand = g[cur] + w;
      if (cand >= g[next]) continue;
      came[next] = cur;
      g[next] = cand;
      f[next] = cand + heuristic(next);
      if (!inOpen[next]) {
        open.push(next);
        inOpen[next] = true;
      }
    }
  }

  return null;
}

function roadWaypoints(graph, sx, sz, tx, tz) {
  if (!graph.nodes.length) return [[tx, tz]];
  const start = nearestRoadNode(graph, sx, sz);
  const goal = nearestRoadNode(graph, tx, tz);
  if (start < 0 || goal < 0) return [[tx, tz]];
  const key=`${start}:${goal}`;
  let path=graph.routes.get(key);
  if(path===undefined){path=aStarRoad(graph,start,goal);if(graph.routes.size>=4096)graph.routes.clear();graph.routes.set(key,path);}
  if (!path || !path.length) return [[tx, tz]];

  const out = [];
  for (const id of path) out.push(graph.nodes[id]);
  out.push([tx, tz]);

  const deduped = [];
  for (const p of out) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1) deduped.push(p);
  }
  return deduped;
}

function newToday(day) {
  return {
    day,
    walkMinutes: 0,
    travelMinutes: 0,
    transitMinutes: 0,
    transitWaitMinutes: 0,
    soldOutAt: [],
    emptyFridge: false,
    dirtyParkVisits: 0,
    displaced: false,
    homeFlooded: false,
  };
}

export function createWorld(town, opts = {}) {
  let parameters = resolveSimulationParameters(opts.parameters);
  // opts.runSeed varies the sim's dice for paired multi-seed experiments. Without it the
  // world draws exactly the same numbers as before (seeded by location only).
  const r = rng(hashSeed(town.seedKey + ":sim" + (opts.runSeed != null ? `:${opts.runSeed}` : "")));
  const byKind = {};
  for (const b of town.buildings) (byKind[b.kind] ||= []).push(b);
  const roadGraph = buildRoadGraph(town.roads || []);
  const initialDay = Math.floor((opts.startMinute ?? 6 * 60) / 1440);
  let transitCounterContext={runSeed:String(opts.runSeed??'default'),year:String(opts.year??initialDay)};

  for (const p of town.people) {
    p.today = newToday(initialDay);
    p.walkHistory = [];
    p.walkMinutesAvg3d = 0;
    p.travelHistory = [];
    p.travelMinutesAvg3d = 0;
    p.travelMode = "walk";
    p.transitWaitMinutesRemaining = 0;
  }

  const activityHistory = opts.recordHistory ? createActivityHistory(opts.historyOptions) : null;
  let activityRunId=`legacy:${town.seedKey}:${opts.runSeed??"default"}:${opts.startMinute??360}`;
  const historyListeners = new Set();
  const personRoutines = activityHistory ? new Map() : null;
  const w = {
    ...town,
    journals:opts.journalsEnabled?{}:null,
    modelVersion: "neighborhood-activity.v2",
    parameters,
    modelMetadata: SIMULATION_MODEL_METADATA,
    activityHistory,
    t: opts.startMinute ?? 6 * 60, // absolute game minutes since day 0
    transitServiceMult: 1,
    parkCleanupBoost: 0,
    restockBoost: 0,
    hiringBoost: 0,
    voucherMonthly: 0,
    groceryDelivery: 0, // 0–1: share of nearly-empty home fridges refilled each afternoon
    wageMult: 1, // economy-wide pay level (possible-worlds conditions); 1 = unchanged
    events: [],
    stats: { spent: 0, earned: 0, meals: 0, groceries: 0, cleanups: 0, householdCosts:0, fares:0, vouchers:0 },
    byKind,
    rand: r,
    minuteOfDay: () => w.t % 1440,
    day: () => Math.floor(w.t / 1440),
    isWorkday: () => w.day() % 7 < 5,
    isDaytime: () => { const m = w.t % 1440; return m >= 7 * 60 && m < 21 * 60; },
    isOpen: (b) => { const m = w.t % 1440; return b.state.open && w.isServiceAvailable(b) && m >= 7 * 60 && m < 22 * 60; },
    log(text, kind = "info", building = null) {
      w.events.unshift({ t: w.t, text, kind, building: building?.index ?? null });
      if (w.events.length > 60) w.events.pop();
      if(activityHistory) recordHistoryEvent(activityHistory,{minute:w.t,type:`WORLD_${String(kind).toUpperCase()}`,text,buildingId:building?.id??null,districtId:building?.kind??"world"});
    },
  };

  // @deprecated speedMult aliases transitServiceMult; walking stays fixed.
  Object.defineProperty(w,'speedMult',{enumerable:true,get:()=>w.transitServiceMult,set:value=>{if(!Number.isFinite(value)||value<=0)throw new RangeError('Transit service multiplier must be positive');w.transitServiceMult=value;}});
  w.households=[];
  w.householdById=new Map();
  const initialWallets=new Set();
  for(const p of w.people){
    const id=String(p.householdId??`person:${p.id}`);p.householdId=id;
    let h=w.householdById.get(id);
    if(!h){h={id,members:[],cash:0,stressedDays:0,lastDailyCost:0,lastShortfall:0,lastCostDay:initialDay,voucherPeriods:[]};w.households.push(h);w.householdById.set(id,h);}
    h.members.push(p.id);
    // Seed contributions once. A preexisting shared accessor is not a second
    // contribution; its captured source wallet is counted once on reuse.
    const source=p.moneyScope==='household'?id:(p.moneyHousehold??p);
    if(!initialWallets.has(source)){h.cash+=Math.max(0,Number(p.money)||0);initialWallets.add(source);}
    // Survives plain-object/JSON town cloning, so shared aliases are never
    // mistaken for separate starting endowments on a subsequent world build.
    p.moneyScope='household';
    Object.defineProperty(p,'moneyHousehold',{configurable:true,enumerable:false,value:h});
    Object.defineProperty(p,'money',{configurable:true,enumerable:true,get:()=>h.cash,set:value=>{if(!Number.isFinite(value)||value<0)throw new RangeError('Household cash must be finite and nonnegative');h.cash=value;}});
  }
  w.getHousehold=id=>w.householdById.get(String(id))??null;
  w.sampleVoucher=periodKey=>{
    if(periodKey===undefined||periodKey===null)throw new Error('Voucher period key required');
    const key=String(periodKey);let supported=0;
    if(!(w.voucherMonthly>0))return supported;
    for(const h of w.households){if(h.voucherPeriods.includes(key))continue;h.voucherPeriods.push(key);if(h.cash<=parameters.voucherEligibilityCash){h.cash+=w.voucherMonthly;w.stats.vouchers+=w.voucherMonthly;supported++;}}
    if(supported)w.log(`Voucher support deposited to ${supported} households`,'civic');
    return supported;
  };

  // The pure culture engine follows committed simulation time, never wall time.
  w.culture = (opts.createCultureSimulation ?? createCultureSimulation)({
    seed: opts.runSeed ?? town.seedKey,
    initialMinute: w.t,
    context: { buildings: town.buildings },
    population: town.people,
  });
  w.cultureSnapshot=w.culture?.snapshot?.()??null;
  w.getCultureEffects=districtId=>cultureEffectsForDistrict(w.cultureSnapshot,districtId??'neighborhood');
  w.cultureIntegration={authority:'Legacy simulation-clock events',effects:'Event multipliers are exposed by getCultureEffects for adapters. No automatic needs or money offsets.'};
  w.weather=(opts.createWeatherSimulation??createWeatherSimulation)({seed:opts.runSeed??town.seedKey,initialMinute:w.t,parameters:opts.weatherParameters});
  const bounded=(value,fallback=1)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
  w.refreshWeatherEffects=(snapshot=w.weather?.snapshot?.()??null)=>{
    w.weatherSnapshot=snapshot;
    const e=w.weatherSnapshot?.effects??{};
    w.actualElectricityDemand=w.households.length*parameters.electricityKwPerHousehold*Math.max(0,Number.isFinite(e.electricityDemandMultiplier)?e.electricityDemandMultiplier:1);
    const capacity=w.households.length*parameters.electricityCapacityKwPerHousehold;
    w.electricity={demandKw:w.actualElectricityDemand,assumedCapacityKw:capacity,shortfallKw:Math.max(0,w.actualElectricityDemand-capacity),unit:'kW',source:'Explicit synthetic concurrent load and capacity assumptions; no measured grid or damage model.'};
    w.weatherEffects={walkComfort:Math.max(.05,bounded(e.walkComfort)),parkComfort:bounded(e.parkComfort),roadAvailability:bounded(e.roadAvailability),transitAvailability:bounded(e.transitAvailability),serviceAvailability:bounded(e.serviceAvailability)*(w.actualElectricityDemand>0?Math.min(1,capacity/w.actualElectricityDemand):1)};
  };
  w.refreshWeatherEffects();
  if(w.weather?.configure){const configure=w.weather.configure.bind(w.weather);w.weather.configure=patch=>{const snapshot=configure(patch);w.refreshWeatherEffects(snapshot);return snapshot;};}
  w.isServiceAvailable=b=>b.kind==='home'||hashSeed(`${town.seedKey}:${b.id}:${Math.floor(w.t/60)}:weather-service`)/4294967296<w.weatherEffects.serviceAvailability;
  w.weatherIntegration={walking:'Rain changes generalized comfort cost, never the physical 40 m/min pace.',outages:'Seeded coarse hourly building/trip access; synthetic electricity capacity can reduce service access. No physical damage or money offsets.'};

  const personId = p => String(p.id);
  const activityOf = p => p.mode === "moving" ? p.travelMode==='transit'?(p.transitWaitMinutesRemaining>0?'TRANSIT_WAIT':'TRANSIT') : "WALK" : p.mode === "doing" && p.action ? p.action.toUpperCase() : "IDLE";
  const placeOf = p => p.mode === "moving" ? "travel" : w.buildings[p.target??p.home]?.kind || "unknown";
  function recordRoutine(p,activity,districtId,startMinute,endMinute,needs) {
    if(!personRoutines)return;
    const id=personId(p); let routine=personRoutines.get(id);
    if(!routine){routine={intervals:[],events:[],droppedIntervals:0,droppedEvents:0,totalEvents:0,fromMinute:startMinute,toMinute:endMinute};personRoutines.set(id,routine);}
    routine.toMinute=endMinute;
    const last=routine.intervals.at(-1),duration=endMinute-startMinute;
    if(last&&last.activity===activity&&last.districtId===districtId&&last.endMinute===startMinute){
      const previous=last.endMinute-last.startMinute;
      for(const key of Object.keys(needs))last.needs[key]=(last.needs[key]*previous+needs[key]*duration)/(previous+duration);
      last.endMinute=endMinute;
    }else routine.intervals.push({id,householdId:p.householdId,districtId,activity,startMinute,endMinute,weight:1,needs:{...needs}});
    if(routine.intervals.length>96){routine.intervals.shift();routine.droppedIntervals++;}
  }
  function historyEvent(p,type,detail={}) {
    if(activityHistory) {
      recordHistoryEvent(activityHistory,{minute:w.t,type,personId:personId(p),householdId:p.householdId,districtId:placeOf(p),...detail});
      const routine=personRoutines.get(personId(p));if(routine)routine.totalEvents++;
    }
  }
  function completeTrip(p) {
    if(!Number.isFinite(p.tripStartedMinute))return;
    p.lastTrip={mode:p.travelMode??'walk',travelMinutes:p.tripTravelMinutes??Math.max(0,w.t-p.tripStartedMinute),walkMinutes:p.tripWalkMinutes??0,transitMinutes:p.tripTransitMinutes??0,transitWaitMinutes:p.tripWaitMinutes??0,distanceMeters:p.tripDistanceMeters||0,destinationId:w.buildings[p.target]?.id??null};
    historyEvent(p,"TRIP_COMPLETED",p.lastTrip);
    p.tripStartedMinute=null;
  }

  function tripPlan(p,b,path=null,cost=0){
    const sheltered=b.kind==='home'&&Math.hypot(p.x-b.center[0],p.z-b.center[1])<Math.max(10,Math.sqrt(b.area||100));
    path??=sheltered?[b.center]:roadWaypoints(roadGraph,p.x,p.z,...b.center);
    let previous=[p.x,p.z],distance=0;
    for(const point of path){distance+=Math.hypot(point[0]-previous[0],point[1]-previous[1]);previous=point;}
    const service=Math.max(.1,Math.min(5,w.transitServiceMult));
    // Counter-style keyed draw does not consume the behavior RNG. Same year,
    // person and destination share the same exogenous wait across policy runs.
    const draw=hashSeed(`${town.seedKey}:${transitCounterContext.runSeed}:${transitCounterContext.year}:${p.id}:${b.id}:transit-wait`)/4294967296;
    const wait=draw*parameters.transitHeadwayMinutes/service;
    const rideSpeed=parameters.transitMetersPerMinute*service;
    const walk=distance/WALK_M_PER_MIN/w.weatherEffects.walkComfort,transit=wait*parameters.transitWaitWeight+distance/rideSpeed;
    const accessDraw=hashSeed(`${town.seedKey}:${p.id}:${b.id}:${Math.floor(w.t/60)}:weather-access`)/4294967296;
    const roadAccessible=sheltered||distance<1||accessDraw<w.weatherEffects.roadAvailability;
    const mode=roadAccessible&&accessDraw<w.weatherEffects.transitAvailability&&distance>=parameters.minimumTransitDistanceMeters&&p.money>=parameters.transitFare+cost&&transit<walk?'transit':'walk';
    return{path,distance,mode,wait:mode==='transit'?wait:0,rideSpeed,minutes:roadAccessible?(mode==='transit'?transit:walk):Infinity};
  }

  const personCommands=installLegacyPersonCommands(w,{actions:ACTIONS,historyEvent,planWalk:(p,destination,building)=>tripPlan(p,building??{id:'user-point',kind:'command',center:[destination.x,destination.z],area:0})});

  // --------------------------------------------------------------------
  // Decide: score every reachable advertisement, pick the best (with a bit of noise).
  // --------------------------------------------------------------------
  function candidates(p) {
    const out = [];
    const home = w.buildings[p.home];
    for (const [id, a] of Object.entries(ACTIONS)) {
      let places;
      if (a.at === "home") places = [home];
      else if (a.at === "job") places = p.job != null ? [w.buildings[p.job]] : [];
      else if (a.at === "school") places = p.school != null ? [w.buildings[p.school]] : [];
      else if (a.at === "business") places = w.business ? [w.buildings[w.business.building]] : [];
      else places = nearest(byKind[a.at] || [], p, 6);
      for (const b of places) {
        const ok = (!a.ok || a.ok(p, b, w)) && (b?.kind==='home'||w.isServiceAvailable(b));
        if (!ok && id === "eat_home" && b?.state?.fridge <= 0) p.today.emptyFridge = true;
        if (ok) out.push([id, a, b]);
      }
    }
    return out;
  }

  function nearest(list, p, k) {
    return list
      .map((b) => [b, (b.center[0] - p.x) ** 2 + (b.center[1] - p.z) ** 2])
      .sort((x, y) => x[1] - y[1]).slice(0, k).map((x) => x[0]);
  }

  function score(p, id, a, b, trip) {
    const mins = a.minutes(p, w);
    let s = 0;
    const gains = a.advert ? a.advert(p, w) : {};
    for (const need of Object.keys(DECAY)) {
      let rate = a.rate?.[need] ?? 0;
      if (a.littered && need === "fun") rate *= 1 - b.state.litter / 140;
      const gain = Math.min(100 - p.needs[need], Math.max(0, rate * mins)) + (gains[need] ?? 0);
      const weight = need === "social" && p.trait === "social butterfly" ? 1.5 : 1;
      s += gain * urgency(p.needs[need]) * weight;
    }
    // Obligations
    const m = w.minuteOfDay();
    if (id === "work" && m >= p.shiftStart - 30 && m < p.shiftStart + p.shiftLen) s += p.trait === "workaholic" ? 80 : 50;
    if (id === "study" && m >= 7.5 * 60) s += 60;
    if (id === "sleep" && (m >= 22 * 60 || m < 6 * 60)) s += 40;
    if (id === "sleep" && p.needs.energy > 75) s *= 0.1;
    if (id === "sleep" && m >= 7 * 60 && m < 21 * 60 && p.needs.energy > 30) s = 0; // no daytime naps unless wiped out
    if (id === "relax_home") s += 0.3; // the default "nothing better to do" activity
    if (id === "work" || id === "study") { if (p.needs.hunger < 12 || p.needs.energy < 8) s *= 0.2; }
    if (id === "visit_business") s *= (0.5 + w.business.quality / 100) * Math.min(2, 12 / Math.max(1, w.business.price));
    if(a.at==='park')s*=w.weatherEffects.parkComfort;
    if(w.journals&&m>=15*60&&m<20*60&&hashSeed(`${p.id}:${w.day()}:surprise`)%100<8&&id==='clean_park')s+=25;
    // Distance, traits, noise
    s /= 1 + trip.minutes / (250 / WALK_M_PER_MIN);
    s *= TRAIT_BONUS[p.trait]?.[id] ?? 1;
    return s * (0.85 + r() * 0.3);
  }

  function decide(p) {
    let best = null, bestS = -1;
    const considered = activityHistory ? [] : null;
    for (const [id, a, b] of candidates(p)) {
      const trip=tripPlan(p,b,undefined,id==='visit_business'?w.business.price:(a.cost??0));
      if(!Number.isFinite(trip.minutes))continue;
      const s = score(p, id, a, b,trip);
      considered?.push({activity:id,buildingId:b.id,score:s});
      if (s > bestS) { bestS = s; best = [id, a, b,trip]; }
    }
    if (!best) { p.action = null; p.target = null; p.mode = "doing"; p.until = w.t + 15; p.doing = "idling"; p.path = null; p.pathI = 0; return; }
    const [id, a, b,trip] = best;
    if(activityHistory) {
      const decision={minute:w.t,type:"ACTIVITY_SELECTED",chosen:id,score:bestS,needs:{...p.needs},alternatives:considered.sort((a,b)=>b.score-a.score).slice(0,6),reasonCodes:["NEED_URGENCY_AND_SCHEDULE_SCORE"]};
      p.lastDecision=decision; (p.decisionHistory||=[]).push(decision); if(p.decisionHistory.length>16)p.decisionHistory.shift();
      historyEvent(p,"ACTIVITY_SELECTED",{activity:id,score:bestS,buildingId:b.id,reasonCodes:decision.reasonCodes});
    }
    p.action = id; p.target = b.index;
    p.path = trip.path;
    p.pathI = 0;
    [p.tx, p.tz] = p.path[0] || b.center;
    p.travelMode=trip.mode;
    p.transitWaitMinutesRemaining=trip.wait;
    p.tripRideMetersPerMinute=trip.rideSpeed;
    p.tripTravelMinutes=0;p.tripWalkMinutes=0;p.tripTransitMinutes=0;p.tripWaitMinutes=0;
    if(trip.mode==='transit'){p.money-=parameters.transitFare;w.stats.spent+=parameters.transitFare;w.stats.fares+=parameters.transitFare;}
    p.mode = "moving"; p.doing = `${trip.mode==='transit'?'taking transit':'walking'} to ${b.name}`;
    p.tripStartedMinute=w.t;
    p.tripDistanceMeters=trip.distance;
    historyEvent(p,"TRIP_STARTED",{mode:trip.mode,activity:id,destinationId:b.id,distanceMeters:p.tripDistanceMeters,expectedWaitMinutes:trip.wait});
  }

  function arrive(p) {
    completeTrip(p);
    if(personCommands.arrive(p))return;
    const a = ACTIONS[p.action];
    const b = w.buildings[p.target];
    if ((a.ok && !a.ok(p, b, w)) || !w.isServiceAvailable(b)) {
      if ((p.action === "eat_out" || p.action === "groceries") && b?.name) {
        if (!p.today.soldOutAt.includes(b.name)) p.today.soldOutAt.push(b.name);
      }
      historyEvent(p,"ACTIVITY_UNAVAILABLE",{activity:p.action,buildingId:b?.id??null,reason:"Availability changed during travel"});
      personCommands.unavailable(p);
      p.mode = "idle"; p.action=null; p.path = null; p.pathI = 0; return;
    } // it changed while walking (sold out!)
    if (p.action === "work" && w.minuteOfDay() < p.shiftStart) {
      p.action = "wait_shift"; p.mode = "doing"; p.doing = ACTIONS.wait_shift.label;
      p.until = w.t + p.shiftStart - w.minuteOfDay(); b.state.visitors++;
      historyEvent(p,"ACTIVITY_STARTED",{activity:"WAIT_SHIFT",buildingId:b.id}); return;
    }
    a.start?.(p, b, w);
    personCommands.activityStarted(p);
    if(w.journals&&p.action==='clean_park')recordJournalMoment(w.journals,String(p.id),p.name,w.t,`I stopped to help clean up ${b.name}. It was a change from my usual day.`);
    if (p.action === "eat_out") w.stats.meals++;
    if (p.action === "groceries") w.stats.groceries++;
    if (p.action === "clean_park") w.stats.cleanups++;
    w.stats.spent += a.cost ?? 0;
    b.state.visitors++;
    p.mode = "doing"; p.doing = a.label;
    p.until = w.t + Math.round(a.minutes(p, w));
    historyEvent(p,"ACTIVITY_STARTED",{activity:p.action.toUpperCase(),buildingId:b.id,...(a.cost?{cost:a.cost}:{})});
    if ((p.action === "eat_out" || p.action === "groceries") && r() < 0.12) w.log(`${p.name} is ${a.label} at ${b.name}`, "routine", b);
  }

  function finish(p) {
    historyEvent(p,"ACTIVITY_ENDED",{activity:activityOf(p)});
    const b = w.buildings[p.target];
    if (b) b.state.visitors = Math.max(0, b.state.visitors - 1);
    if (p.action === "wait_shift") { p.action = "work"; arrive(p); return; }
    if (p.action === "work" || p.action === "study") p.workedToday = true;
    p.mode = "idle"; p.action = null; p.path = null; p.pathI = 0;
    personCommands.activityFinished(p);
  }

  // --------------------------------------------------------------------
  // World tick: one game minute.
  // --------------------------------------------------------------------
  function minute() {
    w.t += 1;
    const m = w.minuteOfDay();
    if (m === 0) {
      const d = w.day();
      for(const h of w.households){
        if(h.lastCostDay===d)continue;
        const cost=parameters.dailyHousingCost+parameters.dailyUtilitiesCost;
        h.lastDailyCost=cost;h.lastShortfall=Math.max(0,cost-h.cash);h.stressedDays+=h.lastShortfall>0?1:0;
        const paid=Math.min(h.cash,cost);h.cash-=paid;w.stats.spent+=paid;w.stats.householdCosts+=paid;h.lastCostDay=d;
      }
      for (const p of w.people) {
        p.workedToday = false;
        p.yesterday = p.today;
        const prevWalk = Number(p.yesterday?.walkMinutes || 0);
        p.walkHistory = [...(p.walkHistory || []), prevWalk].slice(-3);
        p.walkMinutesAvg3d = p.walkHistory.length
          ? p.walkHistory.reduce((a, b) => a + b, 0) / p.walkHistory.length
          : 0;
        p.travelHistory=[...(p.travelHistory||[]),Number(p.yesterday?.travelMinutes||0)].slice(-3);
        p.travelMinutesAvg3d=p.travelHistory.reduce((a,b)=>a+b,0)/p.travelHistory.length;
        p.commuteMinutesAvg3d=p.travelMinutesAvg3d;
        p.today = newToday(d);
      }
    }
    // Deliveries: shops at 6:00 and 14:00 (+18:00 when small-biz support ramps in), kitchens prep every hour while open.
    const extraDelivery = w.restockBoost >= 0.18 && m === 18 * 60;
    for (const b of byKind.shop || []) if (m === 6 * 60 || m === 14 * 60 || extraDelivery) restock(b, b.state.maxStock);
    const prepBase = 6;
    for (const b of byKind.food || []) if (m % 60 === 0 && w.isOpen(b)) restock(b, Math.min(b.state.maxStock, b.state.stock + Math.round(prepBase * (1 + w.restockBoost))), true);

    // Litter slowly blows away / city crew at 5am (boosted by 311-type service policies)
    const cleanupAtDawn = Math.round(15 * (1 + w.parkCleanupBoost));
    for (const b of byKind.park || []) if (m === 5 * 60) b.state.litter = Math.max(0, b.state.litter - cleanupAtDawn);

    // 07:00: grocery delivery program. Homes with less than 2 meals per resident get
    // 3 meals per resident (about a day's food), sized by household because big
    // households empty a fixed refill by dinner. Which homes are served is a fixed hash
    // of (home, day), not w.rand(), so a world without the program draws the exact
    // same random numbers as before.
    if (m === 7 * 60 && w.groceryDelivery > 0) {
      const residents = new Map();
      for (const p of w.people) residents.set(p.home, (residents.get(p.home) || 0) + 1);
      let served = 0;
      const day = w.day();
      for (const b of byKind.home || []) {
        const n = residents.get(b.index) || 0;
        if (!n || b.state.fridge >= 2 * n) continue;
        const h = Math.imul((b.index + 1) * 2654435761 ^ (day + 1) * 40503, 2246822519) >>> 0;
        if ((h % 1000) / 1000 < w.groceryDelivery) { b.state.fridge += 3 * n; served++; }
      }
      if (served) w.log(`Grocery delivery restocked ${served} home fridges`, "civic");
    }

    // Once every 30 game days: voucher-style support to lower-cash households.
    if (m === 0 && w.day() > 0 && w.day() % 30 === 0 && w.voucherMonthly > 0) {
      w.sampleVoucher(`month:${Math.floor(w.day()/30)}`);
    }

    for (const p of w.people) {
      if(w.journals){const activity=p.mode==='moving'?'TRANSIT':({sleep:'SLEEP',eat_home:'MEAL',eat_out:'DINING',relax_home:'HOME',play_park:'PARK',clean_park:'PARK',groceries:'GROCERIES',work:'WORK',study:'SCHOOL'})[p.action]??'OTHER';recordJournalInterval(w.journals,String(p.id),p.name,activity,w.t-1,w.t);}
      const beforeNeeds=activityHistory?{...p.needs}:null;
      const recordedActivity=activityOf(p),recordedPlace=placeOf(p);
      const a = p.mode === "doing" && p.action ? ACTIONS[p.action] : null;
      for (const need of Object.keys(DECAY)) {
        p.needs[need] = clamp(p.needs[need] + needRateFor(p, need, w));
      }
      if (a?.pay) {
        const wageBoost = p.action === "work" ? 1 + w.hiringBoost * 0.5 : 1;
        const earned=(p.action==='work'?parameters.workPayPerMinute:a.pay) * wageBoost * (w.wageMult ?? 1);
        p.money += earned; w.stats.earned+=earned;
      }

      if(activityHistory) {
        const observedNeeds=Object.fromEntries(Object.keys(DECAY).map(key=>[key,(beforeNeeds[key]+p.needs[key])/2]));
        recordActivity(activityHistory,{id:personId(p),householdId:p.householdId,districtId:recordedPlace,activity:recordedActivity,startMinute:w.t-1,endMinute:w.t,weight:1,needs:observedNeeds});
        recordRoutine(p,recordedActivity,recordedPlace,w.t-1,w.t,observedNeeds);
      }
      if (p.mode === "idle") decide(p);
      else if (p.mode === "moving") {
        let availableMinutes=1;
        if(p.travelMode==='transit'&&p.transitWaitMinutesRemaining>0){
          const waited=Math.min(availableMinutes,p.transitWaitMinutesRemaining);
          p.transitWaitMinutesRemaining-=waited;availableMinutes-=waited;
          p.today.transitWaitMinutes+=waited;p.today.travelMinutes+=waited;
          p.tripWaitMinutes+=waited;p.tripTravelMinutes+=waited;
        }
        // Spend one complete walking budget across short road segments; reaching
        // an intermediate waypoint must not discard the rest of this minute.
        const speed=p.travelMode==='transit'?(p.tripRideMetersPerMinute||parameters.transitMetersPerMinute):WALK_M_PER_MIN;
        let remaining = speed*availableMinutes;
        while (remaining > 0 && p.mode === "moving") {
          const dx = p.tx - p.x, dz = p.tz - p.z, distance = Math.hypot(dx,dz);
          const used=Math.min(distance,remaining)/speed;
          const key=p.travelMode==='transit'?'transitMinutes':'walkMinutes';
          p.today[key]+=used;p.today.travelMinutes+=used;p.tripTravelMinutes=(p.tripTravelMinutes||0)+used;
          if(p.travelMode==='transit')p.tripTransitMinutes=(p.tripTransitMinutes||0)+used;else p.tripWalkMinutes=(p.tripWalkMinutes||0)+used;
          if (distance <= remaining) {
            p.x = p.tx; p.z = p.tz; remaining -= distance;
            if (p.path && p.pathI < p.path.length-1) {
              p.pathI++; [p.tx,p.tz] = p.path[p.pathI];
            } else arrive(p);
          } else { p.x += dx / distance * remaining; p.z += dz / distance * remaining; remaining = 0; }
        }
      } else if (p.mode === "doing" && w.t >= p.until) finish(p);
    }
  }

  function restock(b, to, quiet = false) {
    const was = b.state.stock;
    b.state.stock = to;
    if (!quiet && was < 5 && to > was) w.log(`${b.name} got a delivery`, "restock", b);
  }

  w.step = (gameMinutes) => {
    if(!Number.isInteger(gameMinutes)||gameMinutes<0)throw new RangeError("Neighborhood steps require nonnegative whole modeled minutes");
    for (let i = 0; i < gameMinutes; i++) {
      minute();
      w.cultureSnapshot=w.culture?.stepTo(w.t)??null;
      w.refreshWeatherEffects(w.weather?.stepTo(w.t)??null);
    }
    if(gameMinutes&&activityHistory)for(const listener of historyListeners)try{listener({mode:"legacy",minute:w.t,peopleCount:w.people.length,modelVersion:w.modelVersion});}catch{/* A view cannot interrupt the authoritative simulation. */}
  };
  w.getActivityHistory = (query={}) => {
    if(!activityHistory)return {schemaVersion:"activity-history.v1",available:false,coverage:{fromMinute:null,toMinute:null},totals:null,buckets:[],recentEvents:[],retention:{},notice:"Activity recording was not enabled for this world."};
    const result=snapshotActivityHistory(activityHistory,query),id=query.actorId??query.filters?.personId;
    if(id!==undefined){const routine=personRoutines.get(String(id));result.actorTimeline=routine?{...structuredClone(routine),events:result.recentEvents.filter(e=>e.personId===String(id)),droppedEvents:Math.max(0,routine.totalEvents-result.recentEvents.filter(e=>e.personId===String(id)).length),scope:"Actual compact legacy activity bouts; at most96 per person. Event detail shares the bounded global log."}:null;}
    return result;
  };
  w.trackActivityPerson = id => {if(!w.people.some(p=>personId(p)===String(id)))throw new Error("Unknown legacy person");};
  w.subscribeActivity = callback => {historyListeners.add(callback);return()=>historyListeners.delete(callback);};
  w.getActivitySnapshot = () => ({mode:"legacy",minute:w.t,peopleCount:w.people.length,modelVersion:w.modelVersion,runId:activityRunId,historyAvailable:!!activityHistory,stats:{...w.stats},metrics:{population:w.people.length,earned:w.stats.earned,spent:w.stats.spent,...w.summary().avg},people:w.people.map(p=>({id:personId(p),name:p.name,householdId:p.householdId,activity:activityOf(p),districtId:placeOf(p),needs:{...p.needs},doing:p.doing,decisionTrace:p.decisionHistory||[]})),districtLabel:"Place type",districts:[...new Set(w.buildings.map(b=>b.kind)),"travel"].map(id=>({id,label:id}))});

  w.summary = () => {
    const n = w.people.length || 1;
    const avg = { hunger: 0, energy: 0, fun: 0, social: 0 };
    for (const p of w.people) for (const k in avg) avg[k] += p.needs[k] / n;
    const doing = {};
    for (const p of w.people) {
      const label = p.mode === "moving" ? "walking" : p.mode === "doing" && p.action ? ACTIONS[p.action].label : "idle";
      doing[label] = (doing[label] || 0) + 1;
    }
    return { avg, mood: (avg.hunger + avg.energy + avg.fun + avg.social) / 4, doing };
  };

  w.restoreCheckpointParameters=value=>{parameters=resolveSimulationParameters(value);w.parameters=parameters;};
  w.captureCheckpointRetention=()=>({runId:activityRunId,transitCounterContext:{...transitCounterContext},enabled:!!activityHistory,activityHistory:activityHistory?structuredClone(activityHistory):null,personRoutines:personRoutines?[...personRoutines.entries()].map(([id,value])=>[id,structuredClone(value)]):[]});
  w.restoreCheckpointRetention=(saved,{validateOnly=false}={})=>{
    if(!saved||typeof saved.runId!=='string'||saved.runId.length>256||!['runSeed','year'].every(key=>typeof saved.transitCounterContext?.[key]==='string'&&saved.transitCounterContext[key].length<=256)||saved.enabled!==!!activityHistory||!Array.isArray(saved.personRoutines)||saved.personRoutines.length>w.people.length)throw new Error('Legacy checkpoint history authority mismatch');
    if(activityHistory){const h=saved.activityHistory;if(h?.schemaVersion!=='activity-history-state.v1'||Object.keys(createActivityHistory()).some(key=>!Object.hasOwn(h,key))||!['maxEvents','maxBuckets','bucketMinutes','actorCount'].every(key=>Number.isInteger(h[key])&&h[key]>=0)||!['dimensions','eventTypes','activityTypes'].every(key=>Array.isArray(h[key]))||!h.actors||!h.selected||!h.totals||!h.coverage||!h.retention||!Array.isArray(h.recentEvents)||!h.buckets||h.maxEvents>2000||h.maxBuckets>744||h.bucketMinutes<1||h.bucketMinutes>1440||h.recentEvents.length>h.maxEvents||Object.keys(h.buckets).length>h.maxBuckets||saved.personRoutines.some(row=>!Array.isArray(row)||row.length!==2||!w.people.some(p=>String(p.id)===row[0])||!Array.isArray(row[1]?.intervals)||row[1].intervals.length>96)||new Set(saved.personRoutines.map(row=>row[0])).size!==saved.personRoutines.length)throw new Error('Invalid legacy checkpoint retained history');}
    else if(saved.activityHistory!==null||saved.personRoutines.length)throw new Error('Unexpected legacy checkpoint history');
    if(validateOnly)return;
    activityRunId=saved.runId;transitCounterContext={...saved.transitCounterContext};
    if(activityHistory){for(const key of Object.keys(activityHistory))delete activityHistory[key];Object.assign(activityHistory,structuredClone(saved.activityHistory));personRoutines.clear();for(const [id,value]of saved.personRoutines)personRoutines.set(id,structuredClone(value));}
  };
  w.captureCheckpoint=()=>captureLegacyCheckpoint(w);
  w.restoreCheckpoint=saved=>restoreLegacyCheckpoint(w,saved);
  w.captureState=()=>captureSimulationState(w);
  w.restoreState=(state,options)=>restoreSimulationState(w,state,options);
  if(opts.state||opts.longitudinalState)w.restoreState(opts.state??opts.longitudinalState,{preserveClock:true});
  return w;
}

export function clock(t) {
  const m = t % 1440, h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Math.floor(t / 1440) % 7];
  return `${day} ${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "am" : "pm"}`;
}
