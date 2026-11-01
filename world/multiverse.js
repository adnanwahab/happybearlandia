// Fixed-plan Monte Carlo: one frozen Dear Congress plan, many possible realities.
//
// Every reality shares the starting town, population, plan, and model. Each one gets its
// own random draws (resident choices, storm strength) from seed `${baseSeed}:reality:${i}`,
// and is simulated twice with those same draws: once without the plan and once with it.
// The per-reality difference is that reality's simulated effect of the plan.
//
// Unlike runExperiment(), this never calls Dear Congress again: the plan is synthesized
// once (the snapshot) and then held fixed. Pure module: runs in workers, browsers and Bun.

import { simulateYear } from "./experiment.js";
import { METRICS, quantile, improvementSign } from "./paired.js";
import { compilePlan, planForYear } from "./planspec.js";

/** Bump when simulation logic changes, so old links can say they may not replay exactly. */
export const SIM_VERSION = "multiverse-1";

export const MAX_RUNS = 1000;
export const MAX_YEARS = 10;

export function realitySeed(baseSeed, index) {
  return `${baseSeed}:reality:${index}`;
}

/** Years we actually simulate: start, middle, end. Each is a full simulated week. */
export function defaultCheckpoints(years) {
  const y = Math.max(1, Math.min(MAX_YEARS, Math.floor(years)));
  return [...new Set([1, Math.ceil(y / 2), y])].sort((a, b) => a - b);
}

/** Dear Congress snapshot → PlanSpec (every proposal starts in year 1). */
export function snapshotToPlan(snapshot) {
  const plan = snapshot?.plan;
  if (!plan || !Array.isArray(plan.proposalIds)) throw new Error("snapshot has no plan");
  const items = Array.isArray(plan.items) && plan.items.length
    ? plan.items
    : plan.proposalIds.map((id) => ({ id }));
  return compilePlan({
    kind: "planspec",
    version: 1,
    planId: snapshot.id || plan.id || "snapshot",
    label: plan.label || "Dear Congress plan",
    source: "dear-congress",
    actions: items.map((it) => ({ proposalId: it.id, label: it.title, costB: it.costB, startYear: 1 })),
  });
}

/** How much of the plan the simulator actually models. Shown before any run. */
export function coverage(spec) {
  const modeled = spec.actions.filter((a) => a.simulated);
  const notModeled = spec.actions.filter((a) => !a.simulated);
  return {
    total: spec.actions.length,
    modeled: modeled.length,
    notModeled: notModeled.length,
    share: spec.actions.length ? modeled.length / spec.actions.length : 0,
    modeledItems: modeled.map((a) => ({ id: a.proposalId, label: a.label })),
    notModeledItems: notModeled.map((a) => ({ id: a.proposalId, label: a.label })),
  };
}

// Which simulated outcomes speak to which Dear Congress needs. A journal that leans on a
// need weights these metrics more when ranking realities. Needs with no metric are skipped.
export const NEED_METRICS = Object.freeze({
  transit: ["avgWalkMinutes", "overWalkComplaint"],
  flooding: ["displacedResidents"],
  insurance: ["displacedResidents"],
  streets: ["avgParkLitter"],
  food_access: ["soldOutEvents"],
  small_business: ["soldOutEvents"],
  mental_health: ["avgMood"],
  housing: ["avgMood"],
});

/**
 * Weight per metric for ranking realities. Equal weights by default; with journal needs,
 * each need's weight is split across the metrics it maps to (plus a small floor for all).
 */
export function metricWeights(needs = []) {
  const keys = Object.keys(METRICS);
  const w = Object.fromEntries(keys.map((k) => [k, 1 / keys.length]));
  const mapped = (needs || []).filter((n) => NEED_METRICS[n.id] && n.weight > 0);
  if (!mapped.length) return { weights: w, source: "equal" };
  const floor = 0.1 / keys.length;
  const out = Object.fromEntries(keys.map((k) => [k, floor]));
  const total = mapped.reduce((s, n) => s + n.weight, 0);
  for (const n of mapped) {
    const ms = NEED_METRICS[n.id];
    for (const m of ms) out[m] += (0.9 * n.weight) / total / ms.length;
  }
  return { weights: out, source: "journal" };
}

function pick(outcomes) {
  const out = {};
  for (const k of Object.keys(METRICS)) out[k] = Number(outcomes?.[k] || 0);
  return out;
}

/** Simulate one reality: same draws with and without the plan, at each checkpoint year. */
export async function runReality({ town, spec, index, baseSeed, checkpoints }) {
  const seed = realitySeed(baseSeed, index);
  const years = {};
  let storm = 0;
  for (const year of checkpoints) {
    const common = { town, year, seed, runSeed: seed, yearStartMs: 0 };
    const base = await simulateYear({ ...common, proposalIds: [], packageLabel: "No plan" });
    const { proposalIds, adoptedYearByProposal } = planForYear(spec, year);
    const withPlan = proposalIds.length
      ? await simulateYear({ ...common, proposalIds, adoptedYearByProposal, packageLabel: spec.label })
      : base;
    years[year] = { baseline: pick(base.outcomes), plan: pick(withPlan.outcomes) };
    storm = base.stormSeverity;
  }
  const last = checkpoints[checkpoints.length - 1];
  const delta = {};
  for (const k of Object.keys(METRICS)) delta[k] = years[last].plan[k] - years[last].baseline[k];
  return { index, seed, stormSeverity: Math.round(storm * 1000) / 1000, years, delta };
}

function histogram(values, bins = 24) {
  if (!values.length) return { lo: 0, hi: 0, counts: [] };
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  return { lo, hi, counts };
}

const r3 = (x) => Math.round(x * 1000) / 1000;

/**
 * Summarize realities into an outcome landscape.
 *  - per metric: realities improved / worse / unchanged, delta percentiles, histogram
 *  - per reality: a score (weighted share of improvement, by journal needs when given)
 *    and a verdict: improved (> +1%), worse (< −1%), otherwise mixed/about the same
 *  - best / median / worst reality by that score, for "enter a reality"
 */
export function summarizeRealities(realities, { needs = [], scoreBand = 0.01 } = {}) {
  const list = [...realities].sort((a, b) => a.index - b.index);
  const { weights, source } = metricWeights(needs);
  const keys = Object.keys(METRICS);

  // Scale each metric's change by how big that metric is without the plan, so minutes
  // and people and litter points can be added up. Capped at ±100% per metric.
  const lastYearBaseline = (r) => r.years[Math.max(...Object.keys(r.years).map(Number))].baseline;
  const scale = {};
  for (const k of keys) {
    const base = list.map((r) => Math.abs(lastYearBaseline(r)[k]));
    scale[k] = Math.max(1, base.reduce((a, b) => a + b, 0) / (base.length || 1));
  }

  const scored = list.map((r) => {
    let score = 0;
    for (const k of keys) {
      const rel = Math.max(-1, Math.min(1, Math.abs(r.delta[k]) / scale[k]));
      score += weights[k] * improvementSign(k, r.delta[k]) * rel;
    }
    const verdict = score > scoreBand ? "improved" : score < -scoreBand ? "worse" : "mixed";
    return { index: r.index, score: r3(score), verdict };
  });

  const metrics = {};
  for (const k of keys) {
    const deltas = list.map((r) => r.delta[k]);
    const signs = list.map((r) => improvementSign(k, r.delta[k]));
    metrics[k] = {
      ...METRICS[k],
      weight: r3(weights[k]),
      improved: signs.filter((s) => s > 0).length,
      worse: signs.filter((s) => s < 0).length,
      unchanged: signs.filter((s) => s === 0).length,
      delta: {
        mean: r3(deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1)),
        p10: r3(quantile(deltas, 0.1)),
        p50: r3(quantile(deltas, 0.5)),
        p90: r3(quantile(deltas, 0.9)),
      },
      baselineMean: r3(list.reduce((s, r) => s + lastYearBaseline(r)[k], 0) / (list.length || 1)),
      histogram: histogram(deltas),
    };
  }

  const byScore = [...scored].sort((a, b) => a.score - b.score || a.index - b.index);
  return {
    count: list.length,
    verdicts: {
      improved: scored.filter((s) => s.verdict === "improved").length,
      mixed: scored.filter((s) => s.verdict === "mixed").length,
      worse: scored.filter((s) => s.verdict === "worse").length,
    },
    weightsSource: source,
    scoreBand,
    metrics,
    realities: scored,
    best: byScore.length ? byScore[byScore.length - 1].index : null,
    median: byScore.length ? byScore[Math.floor((byScore.length - 1) / 2)].index : null,
    worst: byScore.length ? byScore[0].index : null,
  };
}

/** Run many realities in one thread (tests, Bun scripts). The page uses a worker pool. */
export async function runMonteCarlo({ town, snapshot, runs = 100, years = 10, checkpoints = null, baseSeed = "hbl", onProgress = null }) {
  const spec = snapshotToPlan(snapshot);
  const cps = checkpoints?.length ? checkpoints : defaultCheckpoints(years);
  const n = Math.max(1, Math.min(MAX_RUNS, Math.floor(runs)));
  const realities = [];
  for (let i = 0; i < n; i++) {
    realities.push(await runReality({ town, spec, index: i, baseSeed, checkpoints: cps }));
    onProgress?.({ completed: i + 1, total: n });
  }
  return { spec, coverage: coverage(spec), checkpoints: cps, realities, summary: summarizeRealities(realities, { needs: snapshot.needs }) };
}
