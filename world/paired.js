// Paired counterfactual experiments: never run just one future.
//
// For every seed we simulate the same town twice per checkpoint year, once with no plan
// and once with the plan, using the same random draws (runSeed) and the same storm. The
// per-seed difference is the plan's simulated effect in that future; across seeds we get
// a distribution instead of a single number.
//
// Outcomes are illustrative counterfactuals from synthetic residents, not forecasts.

import { simulateYear } from "./experiment.js";
import { compilePlan, planForYear } from "./planspec.js";

export const METRICS = Object.freeze({
  avgMood: { label: "Well-being (avg needs)", better: "higher", unit: "pts" },
  avgWalkMinutes: { label: "Walking time", better: "lower", unit: "min/day" },
  overWalkComplaint: { label: "Residents with long commutes", better: "lower", unit: "people" },
  displacedResidents: { label: "Displaced by the storm", better: "lower", unit: "people" },
  soldOutEvents: { label: "Sold-out shops", better: "lower", unit: "per week" },
  avgParkLitter: { label: "Park litter", better: "lower", unit: "0–100" },
});

export const DISCLAIMER = "Simulated outcomes with synthetic residents — illustrative counterfactuals, not a forecast.";

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function quantile(xs, q) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

/** +1 if the change is an improvement for this metric, -1 if worse, 0 if none. */
export function improvementSign(metric, delta) {
  if (!delta) return 0;
  const better = METRICS[metric]?.better === "lower" ? -1 : 1;
  return Math.sign(delta) * better;
}

function pickMetrics(outcomes) {
  const out = {};
  for (const k of Object.keys(METRICS)) out[k] = Number(outcomes?.[k] || 0);
  return out;
}

function defaultCheckpoints(years) {
  return Array.from({ length: years }, (_, i) => i + 1);
}

function summarize(metric, baseline, plan) {
  const deltas = plan.map((p, i) => p - baseline[i]);
  return {
    baseline: { mean: round(mean(baseline)), sd: round(sd(baseline)) },
    plan: { mean: round(mean(plan)), sd: round(sd(plan)) },
    delta: {
      mean: round(mean(deltas)),
      p10: round(quantile(deltas, 0.1)),
      p50: round(quantile(deltas, 0.5)),
      p90: round(quantile(deltas, 0.9)),
    },
    improvedShare: round(deltas.filter((d) => improvementSign(metric, d) > 0).length / (deltas.length || 1)),
  };
}

/**
 * runPairedExperiment({ town, plan, seeds, years, checkpoints, baseSeed, primaryMetric, neutralBand, onProgress })
 *  town: from buildTown(); plan: anything compilePlan() accepts.
 *  Returns { meta, final, series, futures, runs }.
 */
export async function runPairedExperiment({
  town,
  plan,
  seeds = 8,
  years = 5,
  checkpoints = null,
  baseSeed = "hbl",
  primaryMetric = "avgMood",
  neutralBand = 0.25,
  onProgress = null,
  shouldStop = null,
}) {
  const t0 = Date.now();
  const spec = compilePlan(plan);
  const nSeeds = Math.max(1, Math.floor(seeds));
  const cps = (checkpoints?.length ? checkpoints : defaultCheckpoints(years))
    .map(Number).filter((y) => Number.isFinite(y) && y >= 0).sort((a, b) => a - b);
  if (!cps.length) throw new Error("no checkpoint years");
  if (!METRICS[primaryMetric]) throw new Error(`unknown primaryMetric ${primaryMetric}`);

  const runs = [];
  const totalSteps = nSeeds * cps.length;
  let step = 0;

  for (let i = 0; i < nSeeds; i++) {
    const runSeed = `${baseSeed}:${i}`;
    const byYear = {};
    for (const year of cps) {
      if (shouldStop?.()) throw new Error("experiment cancelled");
      const common = { town, year, seed: runSeed, runSeed, yearStartMs: 0 };
      const base = await simulateYear({ ...common, proposalIds: [], packageLabel: "No plan" });
      const { proposalIds, adoptedYearByProposal } = planForYear(spec, year);
      // Nothing started yet → the plan world is the baseline world, same draws.
      const withPlan = proposalIds.length
        ? await simulateYear({ ...common, proposalIds, adoptedYearByProposal, packageLabel: spec.label })
        : base;
      byYear[year] = {
        baseline: pickMetrics(base.outcomes),
        plan: pickMetrics(withPlan.outcomes),
        stormSeverity: round(base.stormSeverity),
        proposalIds,
      };
      step++;
      onProgress?.({ step, totalSteps, seed: i, year });
      await new Promise((r) => setTimeout(r, 0)); // keep the server responsive
    }
    runs.push({ seed: runSeed, years: byYear });
  }

  const series = cps.map((year) => {
    const metrics = {};
    for (const m of Object.keys(METRICS)) {
      metrics[m] = summarize(m, runs.map((r) => r.years[year].baseline[m]), runs.map((r) => r.years[year].plan[m]));
    }
    return { year, activeProposals: runs[0].years[year].proposalIds, metrics };
  });

  const lastYear = cps[cps.length - 1];
  const final = series[series.length - 1].metrics;

  const primaryDeltas = runs.map((r) => r.years[lastYear].plan[primaryMetric] - r.years[lastYear].baseline[primaryMetric]);
  const verdicts = primaryDeltas.map((d) => (Math.abs(d) <= neutralBand ? 0 : improvementSign(primaryMetric, d)));
  const futures = {
    metric: primaryMetric,
    year: lastYear,
    neutralBand,
    positive: verdicts.filter((v) => v > 0).length,
    neutral: verdicts.filter((v) => v === 0).length,
    negative: verdicts.filter((v) => v < 0).length,
    deltas: primaryDeltas.map((d) => round(d)),
  };

  return {
    meta: {
      plan: spec,
      seeds: nSeeds,
      checkpoints: cps,
      population: town.people?.length || 0,
      townSource: town.source || "unknown",
      origin: town.origin || null,
      metrics: METRICS,
      disclaimer: DISCLAIMER,
      elapsedMs: Date.now() - t0,
    },
    final,
    series,
    futures,
    runs,
  };
}
