// Possible-worlds engine: vary the world itself, not just the plan.
//
// A "future" is one reality (same seed as multiverse.js, so resident dice match) plus a
// sampled path of world conditions over the years:
//
//   conditions  economy, supply chains, storm climate, civic trust, street conditions and
//               how well the plan is delivered. Each starts somewhere in a range and drifts
//               a little every year (a random walk).
//   shocks      recessions, hurricanes, supply shocks, political turnover, ... Each year a
//               shock can start with a hazard that depends on last year's conditions (a weak
//               economy makes a recession likelier; low trust makes unrest likelier), so a
//               small difference early on can tip later events: path dependence.
//   plan delay  some plans start late.
//
// Every random number is drawn up front from the reality's seed, independent of any
// override. A branch ("what if trust were higher from year 4?") reuses the same draws, so
// the only difference between a future and its branch is the change itself.
//
// Each simulated year is one full week of the agent simulation (experiment.js), run with
// no plan and with each plan under the same conditions and resident dice.
//
// Pure module: runs in workers, the browser and Bun.

import { hashSeed, rng } from "./gen.js";
import { simulateYear } from "./experiment.js";
import { METRICS } from "./paired.js";
import { compilePlan, planForYear } from "./planspec.js";
import { realitySeed } from "./multiverse.js";
import { POLICY_RULES } from "./policy.js";

export const FUTURES_VERSION = "futures-1";
export const MAX_YEARS = 10;

/* ------------------------------------------------------------------ */
/* Assumptions                                                         */
/* ------------------------------------------------------------------ */

// lo/hi: range of starting values. drift: yearly random-walk step (sd). clamp: hard
// limits after shocks. neutral: value meaning "as today". group: for the uncertainty
// breakdown. How each one reaches the simulation is in toSimConditions().
export const CONDITIONS = Object.freeze({
  economy: { label: "Household economy", short: "economy", group: "economy", lo: 0.75, hi: 1.25, neutral: 1, drift: 0.05, clamp: [0.35, 1.7], unit: "× pay and savings", fmt: (v) => `${v.toFixed(2)}×` },
  supply: { label: "Supply chains", short: "supply", group: "economy", lo: -0.3, hi: 0.25, neutral: 0, drift: 0.05, clamp: [-0.85, 0.6], unit: "restocking vs today", fmt: (v) => `${v >= 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)}%` },
  climate: { label: "Storm climate", short: "storms", group: "climate", lo: 0.85, hi: 1.3, neutral: 1, drift: 0.04, clamp: [0.6, 2.2], unit: "× storm strength", fmt: (v) => `${v.toFixed(2)}×` },
  trust: { label: "Civic trust", short: "trust", group: "society", lo: -0.35, hi: 0.45, neutral: 0, drift: 0.06, clamp: [-0.85, 0.9], unit: "park upkeep vs today", fmt: (v) => `${v >= 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)}%` },
  mobility: { label: "Street conditions", short: "streets", group: "infrastructure", lo: 0.88, hi: 1.1, neutral: 1, drift: 0.03, clamp: [0.6, 1.25], unit: "× travel speed", fmt: (v) => `${v.toFixed(2)}×` },
  delivery: { label: "Plan delivery", short: "delivery", group: "implementation", lo: 0.5, hi: 1.1, neutral: 1, drift: 0.05, clamp: [0, 1.4], unit: "share of designed effect", fmt: (v) => `${Math.round(v * 100)}%` },
});

export const CONDITION_KEYS = Object.freeze(Object.keys(CONDITIONS));

// rate: base chance per year. duration: years it lasts. effects: added to conditions at
// full strength (× magnitude × recovery weight). recovery: how the effect fades over its
// duration. fragility: hazard multiplier exp(Σ k·z), z = last year's condition level
// rescaled to −1…+1 across its starting range. Negative k → likelier when that is low.
export const SHOCKS = Object.freeze({
  recession: { label: "Recession", icon: "📉", rate: 0.07, duration: 2, magnitude: [0.7, 1.3], recovery: "linear", effects: { economy: -0.3, supply: -0.08, trust: -0.1 }, fragility: { economy: -1.4, trust: -0.4 } },
  boom: { label: "Economic boom", icon: "📈", rate: 0.05, duration: 3, magnitude: [0.6, 1.2], recovery: "fade", effects: { economy: 0.25, trust: 0.05 }, fragility: { economy: 0.8, trust: 0.5 } },
  hurricane: { label: "Hurricane season", icon: "🌀", rate: 0.09, duration: 1, magnitude: [0.7, 1.4], recovery: "step", effects: { climate: 0.55 }, fragility: { climate: 1.0 } },
  supplyShock: { label: "Supply shock", icon: "📦", rate: 0.06, duration: 1, magnitude: [0.7, 1.3], recovery: "step", effects: { supply: -0.4 }, fragility: { supply: -0.8 } },
  infrastructure: { label: "Infrastructure failure", icon: "🚧", rate: 0.05, duration: 1, magnitude: [0.7, 1.3], recovery: "step", effects: { mobility: -0.15 }, fragility: { mobility: -1.0, climate: 0.6 } },
  turnover: { label: "Political turnover", icon: "🏛", rate: 0.07, duration: 2, magnitude: [0.7, 1.3], recovery: "linear", effects: { delivery: -0.35, trust: -0.05 }, fragility: { trust: -1.0 } },
  movement: { label: "Community movement", icon: "🤝", rate: 0.05, duration: 2, magnitude: [0.7, 1.3], recovery: "linear", effects: { trust: 0.35, delivery: 0.1 }, fragility: { climate: 0.5, trust: 0.3 } },
  pandemic: { label: "Pandemic", icon: "🦠", rate: 0.025, duration: 2, magnitude: [0.7, 1.3], recovery: "linear", effects: { economy: -0.2, supply: -0.25, trust: -0.15, mobility: -0.05 }, fragility: {} },
  unrest: { label: "Civic unrest", icon: "📢", rate: 0.04, duration: 1, magnitude: [0.7, 1.3], recovery: "step", effects: { trust: -0.35, delivery: -0.15 }, fragility: { economy: -1.2, trust: -1.2 } },
});

export const SHOCK_KEYS = Object.freeze(Object.keys(SHOCKS));

// Chance the plan starts 0, 1 or 2 years late.
export const DELAY_PROBS = Object.freeze([0.6, 0.27, 0.13]);

export function defaultAssumptions() {
  return {
    ranges: Object.fromEntries(CONDITION_KEYS.map((k) => [k, [CONDITIONS[k].lo, CONDITIONS[k].hi]])),
    shockRates: Object.fromEntries(SHOCK_KEYS.map((k) => [k, SHOCKS[k].rate])),
    volatility: 1, // scales every yearly drift
    delay: true, // allow plans to start late
  };
}

/** Fill in anything missing and clamp to sane values (assumptions come from URLs). */
export function normalizeAssumptions(a = {}) {
  const d = defaultAssumptions();
  const out = { ranges: {}, shockRates: {}, volatility: d.volatility, delay: d.delay };
  for (const k of CONDITION_KEYS) {
    const r = Array.isArray(a?.ranges?.[k]) ? a.ranges[k].map(Number) : d.ranges[k];
    const [cl, ch] = CONDITIONS[k].clamp;
    let lo = Number.isFinite(r[0]) ? Math.max(cl, Math.min(ch, r[0])) : d.ranges[k][0];
    let hi = Number.isFinite(r[1]) ? Math.max(cl, Math.min(ch, r[1])) : d.ranges[k][1];
    if (hi < lo) [lo, hi] = [hi, lo];
    out.ranges[k] = [lo, hi];
  }
  for (const k of SHOCK_KEYS) {
    const v = Number(a?.shockRates?.[k]);
    out.shockRates[k] = Number.isFinite(v) ? Math.max(0, Math.min(0.9, v)) : d.shockRates[k];
  }
  if (Number.isFinite(Number(a?.volatility))) out.volatility = Math.max(0, Math.min(4, Number(a.volatility)));
  if (a?.delay === false) out.delay = false;
  return out;
}

/** −1 … +1 position of a value within the condition's starting range (can exceed). */
export function conditionZ(key, value, assumptions) {
  const [lo, hi] = assumptions?.ranges?.[key] || [CONDITIONS[key].lo, CONDITIONS[key].hi];
  return hi > lo ? ((value - lo) / (hi - lo)) * 2 - 1 : 0;
}

/** 0 … 1 level (0 = bottom of the starting range, 1 = top). For search and display. */
export function conditionLevel(key, value, assumptions) {
  return (conditionZ(key, value, assumptions) + 1) / 2;
}

/* ------------------------------------------------------------------ */
/* Random draws (independent of overrides)                             */
/* ------------------------------------------------------------------ */

function normal(r) {
  const u = Math.max(1e-12, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function drawsFor(seed, years) {
  const n = Math.max(1, Math.min(MAX_YEARS, years));
  const init = {}, inc = {};
  for (const k of CONDITION_KEYS) {
    const r = rng(hashSeed(`${seed}:cond:${k}`));
    init[k] = r();
    inc[k] = Array.from({ length: n + 1 }, () => normal(r));
  }
  const shock = {};
  for (const k of SHOCK_KEYS) {
    const r = rng(hashSeed(`${seed}:shock:${k}`));
    shock[k] = Array.from({ length: n + 1 }, () => ({ u: r(), m: r() }));
  }
  const delayU = rng(hashSeed(`${seed}:delay`))();
  return { years: n, init, inc, shock, delayU };
}

function recoveryWeight(kind, k, duration) {
  if (kind === "linear") return Math.max(0, 1 - k / duration);
  if (kind === "fade") return 0.6 ** k;
  return 1; // step
}

/**
 * The world-condition path of one reality.
 * override: { fromYear, set: {condition: value}, force: [{id, year}], block: [{id, year?}], delay }
 *   set     replaces the condition's underlying value at fromYear; later years keep the
 *           same random steps from there.
 *   force   start a shock in that year (if it isn't already running).
 *   block   stop a shock from starting (in that year, or any year ≥ fromYear).
 *   delay   plan delay in years (applies from year 1).
 */
export function worldPath(seed, years, assumptions = null, override = null, draws = null) {
  const a = normalizeAssumptions(assumptions || {});
  const d = draws || drawsFor(seed, years);
  const n = d.years;
  const from = Math.max(1, Number(override?.fromYear) || 1);
  const base = {};
  for (const k of CONDITION_KEYS) {
    const [lo, hi] = a.ranges[k];
    base[k] = lo + d.init[k] * (hi - lo);
  }
  let delay = 0;
  if (a.delay) {
    let acc = 0;
    for (let i = 0; i < DELAY_PROBS.length; i++) { acc += DELAY_PROBS[i]; if (d.delayU < acc) { delay = i; break; } }
  }
  if (Number.isFinite(Number(override?.delay))) delay = Math.max(0, Math.min(5, Math.round(Number(override.delay))));

  const forced = new Set((override?.force || []).map((f) => `${f.id}@${f.year}`));
  const blocked = (id, year) => (override?.block || []).some((b) => b.id === id && (b.year != null ? Number(b.year) === year : year >= from));

  const starts = []; // { id, year, mag }
  const out = [];
  let prevEff = null;
  let prevContrib = {};
  for (let y = 1; y <= n; y++) {
    // Underlying conditions: random walk.
    if (y > 1) for (const k of CONDITION_KEYS) base[k] += CONDITIONS[k].drift * a.volatility * d.inc[k][y];
    if (y === from && override?.set) {
      for (const [k, v] of Object.entries(override.set)) if (CONDITIONS[k] && Number.isFinite(Number(v))) base[k] = Number(v);
    }
    for (const k of CONDITION_KEYS) {
      const [cl, ch] = CONDITIONS[k].clamp;
      base[k] = Math.max(cl, Math.min(ch, base[k]));
    }

    // New shocks this year: hazard from last year's effective conditions (or this year's
    // base in year 1), leaving out that shock's own lingering effect so a hurricane
    // doesn't make the next hurricane likelier. Other shocks do cascade.
    const started = [];
    for (const id of SHOCK_KEYS) {
      const s = SHOCKS[id];
      const running = starts.some((x) => x.id === id && y < x.year + s.duration);
      if (running) continue;
      let hz = a.shockRates[id];
      let e = 0;
      for (const [k, f] of Object.entries(s.fragility || {})) {
        const ref = prevEff ? prevEff[k] - (prevContrib[id]?.[k] || 0) : base[k];
        e += f * Math.max(-1.5, Math.min(1.5, conditionZ(k, ref, a)));
      }
      hz = Math.min(0.9, hz * Math.exp(e));
      const draw = d.shock[id][y];
      let hit = draw.u < hz;
      if (forced.has(`${id}@${y}`)) hit = true;
      else if (hit && blocked(id, y)) hit = false;
      if (hit) {
        const mag = s.magnitude[0] + draw.m * (s.magnitude[1] - s.magnitude[0]);
        starts.push({ id, year: y, mag });
        started.push(id);
      }
    }

    // Effective conditions: underlying + active shocks.
    const eff = { ...base };
    const active = [];
    const contrib = {};
    for (const st of starts) {
      const s = SHOCKS[st.id];
      const k = y - st.year;
      if (k < 0 || k >= s.duration) continue;
      const w = recoveryWeight(s.recovery, k, s.duration);
      active.push({ id: st.id, startYear: st.year, weight: Math.round(w * 1000) / 1000, magnitude: Math.round(st.mag * 1000) / 1000 });
      contrib[st.id] = {};
      for (const [c, v] of Object.entries(s.effects)) { eff[c] += v * st.mag * w; contrib[st.id][c] = v * st.mag * w; }
    }
    for (const k of CONDITION_KEYS) {
      const [cl, ch] = CONDITIONS[k].clamp;
      eff[k] = Math.max(cl, Math.min(ch, eff[k]));
    }
    const r4 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10000) / 10000]));
    out.push({ year: y, base: r4(base), eff: r4(eff), active, started });
    prevEff = eff;
    prevContrib = contrib;
  }
  return { years: out, delay, shocks: starts.map((s) => ({ id: s.id, year: s.year, magnitude: Math.round(s.mag * 1000) / 1000 })) };
}

/** Effective world conditions → simulateYear() conditions. */
export function toSimConditions(eff, { plan = false } = {}) {
  return {
    moneyMult: eff.economy,
    wageMult: eff.economy,
    restockAdd: eff.supply,
    cleanupAdd: eff.trust,
    mobilityMult: eff.mobility,
    stormMult: eff.climate,
    planScale: plan ? eff.delivery : 1,
  };
}

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

/** The same plan, every action starting `delay` years later. */
export function delayPlan(spec, delay) {
  if (!delay) return spec;
  return { ...spec, actions: spec.actions.map((a) => ({ ...a, startYear: a.startYear + delay })) };
}

/** Variants worth comparing against a plan, all run on the same worlds. */
export function planVariants(spec) {
  const modeled = spec.actions.filter((a) => a.simulated);
  const out = [];
  if (modeled.length > 1) {
    for (const a of modeled) {
      out.push({ id: `without:${a.proposalId}`, label: `${spec.label} without ${a.label}`, spec: { ...spec, planId: `${spec.planId}-without-${a.proposalId}`, label: `Without ${a.label}`, actions: spec.actions.filter((x) => x !== a) } });
    }
    for (const a of modeled) {
      out.push({ id: `only:${a.proposalId}`, label: `Only ${a.label}`, spec: { ...spec, planId: `${spec.planId}-only-${a.proposalId}`, label: `Only ${a.label}`, actions: [a] } });
    }
  }
  const inPlan = new Set(modeled.map((a) => a.rule));
  for (const [id, rule] of Object.entries(POLICY_RULES)) {
    if (inPlan.has(id)) continue;
    out.push({ id: `plus:${id}`, label: `${spec.label} + ${rule.label}`, spec: compilePlan({ kind: "planspec", version: 1, planId: `${spec.planId}-plus-${id}`, label: `+ ${rule.label}`, actions: [...spec.actions.map((a) => ({ ...a })), { proposalId: id, label: rule.label, startYear: 1 }] }) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Running futures                                                     */
/* ------------------------------------------------------------------ */

function pick(outcomes) {
  const out = {};
  for (const k of Object.keys(METRICS)) out[k] = Math.round(Number(outcomes?.[k] || 0) * 1000) / 1000;
  return out;
}

/** Years actually simulated: 1, 1+step, … and always the last. */
export function simYears(years, step = 1) {
  const n = Math.max(1, Math.min(MAX_YEARS, Math.floor(years)));
  const s = Math.max(1, Math.floor(step));
  const out = [];
  for (let y = 1; y <= n; y += s) out.push(y);
  if (out[out.length - 1] !== n) out.push(n);
  return out;
}

/**
 * Simulate one future: every chosen year, with no plan and with each plan, same dice.
 *  plans: PlanSpecs (index 0 is "the plan"; others are compared on the same worlds)
 *  reuse + override.fromYear: copy years before fromYear from an earlier run (a branch)
 * Returns { index, seed, delay, path, shocks, simYears, years: {y: {baseline, plans: [], storm}} }.
 */
export async function runFuture({ town, plans, index, baseSeed, years = 10, step = 1, assumptions = null, override = null, reuse = null, onYear = null, collectPeople = false }) {
  const seed = realitySeed(baseSeed, index);
  const path = worldPath(seed, years, assumptions, override);
  const ys = simYears(years, step);
  const out = {};
  const keepBefore = reuse && override?.fromYear && override?.delay == null ? Number(override.fromYear) : 0;
  const people = collectPeople ? {} : null;
  for (const year of ys) {
    if (year < keepBefore && reuse?.years?.[year]) { out[year] = reuse.years[year]; continue; }
    const p = path.years[year - 1];
    const common = { town, year, seed, runSeed: seed, yearStartMs: 0, collectPeople };
    const base = await simulateYear({ ...common, proposalIds: [], packageLabel: "No plan", conditions: toSimConditions(p.eff) });
    const planOut = [];
    const planPeople = [];
    for (const spec of plans) {
      const { proposalIds, adoptedYearByProposal } = planForYear(delayPlan(spec, path.delay), year);
      const withPlan = proposalIds.length
        ? await simulateYear({ ...common, proposalIds, adoptedYearByProposal, packageLabel: spec.label, conditions: toSimConditions(p.eff, { plan: true }) })
        : base;
      planOut.push(pick(withPlan.outcomes));
      if (people) planPeople.push(withPlan.people);
    }
    out[year] = { baseline: pick(base.outcomes), plans: planOut, storm: Math.round(base.stormSeverity * 1000) / 1000 };
    if (people) people[year] = { baseline: base.people, plans: planPeople };
    onYear?.({ year });
  }
  return { index, seed, delay: path.delay, path: path.years, shocks: path.shocks, simYears: ys, years: out, ...(people ? { people } : {}) };
}

/** Several futures in one thread (tests, scripts). Pages use futures.worker.js. */
export async function runFutures({ town, plans, runs = 20, baseSeed = "hbl", years = 10, step = 1, assumptions = null, onProgress = null }) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    out.push(await runFuture({ town, plans, index: i, baseSeed, years, step, assumptions }));
    onProgress?.({ completed: i + 1, total: runs });
  }
  return out;
}

/** Compact URL form of assumptions (only what differs from the defaults). */
export function encodeAssumptions(a) {
  const n = normalizeAssumptions(a);
  const d = defaultAssumptions();
  const diff = {};
  for (const k of CONDITION_KEYS) if (n.ranges[k][0] !== d.ranges[k][0] || n.ranges[k][1] !== d.ranges[k][1]) (diff.ranges ||= {})[k] = n.ranges[k];
  for (const k of SHOCK_KEYS) if (n.shockRates[k] !== d.shockRates[k]) (diff.shockRates ||= {})[k] = n.shockRates[k];
  if (n.volatility !== 1) diff.volatility = n.volatility;
  if (!n.delay) diff.delay = false;
  return Object.keys(diff).length ? JSON.stringify(diff) : "";
}

export function decodeAssumptions(s) {
  if (!s) return defaultAssumptions();
  try { return normalizeAssumptions(JSON.parse(s)); } catch { return defaultAssumptions(); }
}
