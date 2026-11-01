// Sims-style needs + utility AI. Buildings advertise actions; each person scores every
// nearby advertisement against their needs, walks there, does it, and the action changes
// shared world state (stock, cash, fridges, litter). Pure module, deterministic per seed.

import { rng, hashSeed } from "./gen.js";

const DECAY = { hunger: 0.09, energy: 0.045, fun: 0.05, social: 0.04 }; // per game minute
const WALK_M_PER_MIN = 80;
const ROAD_CONNECT_MAX_M = 220;

/**
 * Each action: where it happens, how long, what it does to needs per minute,
 * one-off effects on start, and when it's available.
 */
export const ACTIONS = {
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
    at: "job", label: "working", minutes: (p, w) => Math.max(30, p.shiftStart + p.shiftLen - w.minuteOfDay()),
    rate: { fun: -0.02, social: 0.06, energy: -0.01 }, pay: 0.3,
    ok: (p, b, w) => w.isWorkday() && !p.workedToday && b.state.open,
  },
  study: {
    at: "school", label: "at school", minutes: (p, w) => Math.max(30, 15 * 60 - w.minuteOfDay()),
    rate: { social: 0.12, fun: 0.05 }, ok: (p, b, w) => w.isWorkday() && !p.workedToday && w.minuteOfDay() < 14 * 60,
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

  return { nodes, adj };
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
  const path = aStarRoad(graph, start, goal);
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
    soldOutAt: [],
    emptyFridge: false,
    dirtyParkVisits: 0,
    displaced: false,
    homeFlooded: false,
  };
}

export function createWorld(town, opts = {}) {
  const r = rng(hashSeed(town.seedKey + ":sim"));
  const byKind = {};
  for (const b of town.buildings) (byKind[b.kind] ||= []).push(b);
  const roadGraph = buildRoadGraph(town.roads || []);
  const initialDay = Math.floor((opts.startMinute ?? 6 * 60 + 30) / 1440);

  for (const p of town.people) {
    p.today = newToday(initialDay);
    p.walkHistory = [];
    p.walkMinutesAvg3d = 0;
  }

  const w = {
    ...town,
    t: opts.startMinute ?? 6 * 60 + 30, // absolute game minutes since day 0
    speedMult: 1,
    parkCleanupBoost: 0,
    restockBoost: 0,
    hiringBoost: 0,
    voucherMonthly: 0,
    groceryDelivery: 0, // 0–1: share of nearly-empty home fridges refilled each afternoon
    events: [],
    stats: { spent: 0, meals: 0, groceries: 0, cleanups: 0 },
    byKind,
    rand: r,
    minuteOfDay: () => w.t % 1440,
    day: () => Math.floor(w.t / 1440),
    isWorkday: () => w.day() % 7 < 5,
    isDaytime: () => { const m = w.t % 1440; return m >= 7 * 60 && m < 21 * 60; },
    isOpen: (b) => { const m = w.t % 1440; return b.state.open && m >= 7 * 60 && m < 22 * 60; },
    log(text, kind = "info", building = null) {
      w.events.unshift({ t: w.t, text, kind, building: building?.index ?? null });
      if (w.events.length > 60) w.events.pop();
    },
  };

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
      else places = nearest(byKind[a.at] || [], p, 6);
      for (const b of places) {
        const ok = !a.ok || a.ok(p, b, w);
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

  function score(p, id, a, b) {
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
    // Distance, traits, noise
    const dist = Math.hypot(b.center[0] - p.x, b.center[1] - p.z);
    s /= 1 + dist / (250 * w.speedMult);
    s *= TRAIT_BONUS[p.trait]?.[id] ?? 1;
    return s * (0.85 + r() * 0.3);
  }

  function decide(p) {
    let best = null, bestS = -1;
    for (const [id, a, b] of candidates(p)) {
      const s = score(p, id, a, b);
      if (s > bestS) { bestS = s; best = [id, a, b]; }
    }
    if (!best) { p.mode = "doing"; p.until = w.t + 15; p.doing = "idling"; p.path = null; p.pathI = 0; return; }
    const [id, a, b] = best;
    p.action = id; p.target = b.index;
    const j = r.range(-0.3, 0.3);
    const tx = b.center[0] + j * Math.sqrt(b.area || 100) * 0.5;
    const tz = b.center[1] + j * Math.sqrt(b.area || 100) * 0.5;
    p.path = roadWaypoints(roadGraph, p.x, p.z, tx, tz);
    p.pathI = 0;
    [p.tx, p.tz] = p.path[0] || [tx, tz];
    p.mode = "moving"; p.doing = `walking to ${b.name}`;
  }

  function arrive(p) {
    const a = ACTIONS[p.action];
    const b = w.buildings[p.target];
    if (a.ok && !a.ok(p, b, w)) {
      if ((p.action === "eat_out" || p.action === "groceries") && b?.name) {
        if (!p.today.soldOutAt.includes(b.name)) p.today.soldOutAt.push(b.name);
      }
      p.mode = "idle"; p.path = null; p.pathI = 0; return;
    } // it changed while walking (sold out!)
    a.start?.(p, b, w);
    if (p.action === "eat_out") w.stats.meals++;
    if (p.action === "groceries") w.stats.groceries++;
    if (p.action === "clean_park") w.stats.cleanups++;
    w.stats.spent += a.cost ?? 0;
    b.state.visitors++;
    p.mode = "doing"; p.doing = a.label;
    p.until = w.t + Math.round(a.minutes(p, w));
    if ((p.action === "eat_out" || p.action === "groceries") && r() < 0.12) w.log(`${p.name} is ${a.label} at ${b.name}`, "routine", b);
  }

  function finish(p) {
    const b = w.buildings[p.target];
    if (b) b.state.visitors = Math.max(0, b.state.visitors - 1);
    if (p.action === "work" || p.action === "study") p.workedToday = true;
    p.mode = "idle"; p.action = null; p.path = null; p.pathI = 0;
  }

  // --------------------------------------------------------------------
  // World tick: one game minute.
  // --------------------------------------------------------------------
  function minute() {
    w.t += 1;
    const m = w.minuteOfDay();
    if (m === 0) {
      const d = w.day();
      for (const p of w.people) {
        p.workedToday = false;
        p.yesterday = p.today;
        const prevWalk = Number(p.yesterday?.walkMinutes || 0);
        p.walkHistory = [...(p.walkHistory || []), prevWalk].slice(-3);
        p.walkMinutesAvg3d = p.walkHistory.length
          ? p.walkHistory.reduce((a, b) => a + b, 0) / p.walkHistory.length
          : 0;
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
      let supported = 0;
      for (const p of w.people) {
        if (p.money <= 90) {
          p.money += w.voucherMonthly;
          supported++;
        }
      }
      if (supported) w.log(`Voucher support deposited to ${supported} households`, "civic");
    }

    for (const p of w.people) {
      const a = p.mode === "doing" && p.action ? ACTIONS[p.action] : null;
      for (const need of Object.keys(DECAY)) {
        let d = -DECAY[need];
        if (need === "hunger" && a && p.action === "sleep") d = -0.04;
        if (a?.rate?.[need] != null) {
          let rate = a.rate[need];
          if (a.littered && need === "fun") rate *= 1 - w.buildings[p.target].state.litter / 140;
          d += rate;
        }
        p.needs[need] = clamp(p.needs[need] + d);
      }
      if (a?.pay) {
        const wageBoost = p.action === "work" ? 1 + w.hiringBoost * 0.5 : 1;
        p.money += a.pay * wageBoost;
      }

      if (p.mode === "idle") decide(p);
      else if (p.mode === "moving") {
        p.today.walkMinutes += 1;
        const dx = p.tx - p.x, dz = p.tz - p.z;
        const d = Math.hypot(dx, dz), step = WALK_M_PER_MIN * w.speedMult;
        if (d <= step) {
          p.x = p.tx; p.z = p.tz;
          if (p.path && p.pathI < p.path.length - 1) {
            p.pathI += 1;
            [p.tx, p.tz] = p.path[p.pathI];
          } else {
            arrive(p);
          }
        } else {
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
        }
      } else if (p.mode === "doing" && w.t >= p.until) finish(p);
    }
  }

  function restock(b, to, quiet = false) {
    const was = b.state.stock;
    b.state.stock = to;
    if (!quiet && was < 5 && to > was) w.log(`${b.name} got a delivery`, "restock", b);
  }

  w.step = (gameMinutes) => { for (let i = 0; i < gameMinutes; i++) minute(); };

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

  return w;
}

export function clock(t) {
  const m = t % 1440, h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Math.floor(t / 1440) % 7];
  return `${day} ${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "am" : "pm"}`;
}
