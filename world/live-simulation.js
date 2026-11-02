import { generateWorlds } from "./world-generator.js";
import { createHblCivicDynamicsAdapter, simulateExperiment } from "./simulation-adapter.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const boundedInteger = (value, fallback, max) => Number.isFinite(Number(value))
  ? clamp(Math.round(Number(value)), 1, max) : fallback;
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Normalize controls expressed in native parameter units, never normalized units.
 * Numeric values (or {value}/{baseline}) fix that parameter in every current run.
 * Original ranges remain intact so model normalization retains its meaning.
 * Unknown IDs and invalid values are ignored and reported in warnings.
 */
export function normalizeLiveOverrides(experiment, overrides = {}) {
  const definitions = new Map((experiment?.worldModel?.variables || []).map((variable) => [variable.id, variable]));
  const values = {};
  const generatorOverrides = {};
  const warnings = [];
  for (const [id, override] of Object.entries(overrides && typeof overrides === "object" ? overrides : {})) {
    const variable = definitions.get(id);
    const raw = override && typeof override === "object" ? override.value ?? override.baseline : override;
    const value = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
    if (!variable || !Number.isFinite(value)) {
      warnings.push(`Ignored ${id}: ${variable ? "expected a finite numeric value" : "unknown parameter"}.`);
      continue;
    }
    const rawMin = Number(variable.range?.min ?? 0);
    const rawMax = Number(variable.range?.max ?? 1);
    const min = Number.isFinite(rawMin) ? rawMin : 0;
    const max = Number.isFinite(rawMax) ? Math.max(min, rawMax) : Math.max(min, 1);
    values[id] = clamp(value, min, max);
    generatorOverrides[id] = { baseline: values[id], locked: true };
    if (values[id] !== value) warnings.push(`Clamped ${id} to its supported range.`);
  }
  return { values, generatorOverrides, warnings };
}

/** Aggregate real simulator rows; ranges describe ensemble spread, not confidence. */
export function normalizeLiveTimeline(simulations = []) {
  const byYear = new Map();
  for (const simulation of simulations) {
    for (const row of simulation.timeline || []) {
      if (!Number.isFinite(row.year)) continue;
      if (!byYear.has(row.year)) byYear.set(row.year, []);
      byYear.get(row.year).push(row);
    }
  }
  return [...byYear].sort(([a], [b]) => a - b).map(([year, rows]) => {
    const scores = rows.map((row) => row.score).filter(Number.isFinite);
    const ids = new Set(rows.flatMap((row) => Object.keys(row.metrics || {})));
    const metrics = {};
    const metricRanges = {};
    for (const id of ids) {
      const values = rows.map((row) => row.metrics?.[id]).filter(Number.isFinite);
      if (!values.length) continue;
      metrics[id] = average(values);
      metricRanges[id] = { min: Math.min(...values), max: Math.max(...values) };
    }
    return {
      year, score: scores.length ? average(scores) : null, metrics, metricRanges,
      scoreRange: scores.length ? { min: Math.min(...scores), max: Math.max(...scores) } : null,
      sampleCount: rows.length,
    };
  });
}

function summarize(batch) {
  const timeline = normalizeLiveTimeline(batch.simulations);
  const final = timeline.at(-1);
  return { ...batch, timeline, metrics: final?.metrics || {}, score: final?.score ?? null };
}

/**
 * Paired, exploratory HBL runtime. Baseline is the supplied experiment without
 * live overrides (not a no-policy counterfactual); current changes only controls.
 * Returns {baseline,current,seed,years,runs,overrides,metricRegistry,warnings,...}.
 * Each branch: {timeline,simulations,metrics,score,adapter,...}; timeline rows:
 * {year,score,metrics:{[metricId]:mean},metricRanges:{[metricId]:{min,max}},
 *  scoreRange:{min,max},sampleCount}. Years start at 1; units/directions come
 * from metricRegistry. simulations retain full world/effectiveWorld, events,
 * causal explanations and per-run yearly rows. No synthetic chart data.
 */
export async function runLiveSimulation({ experiment, overrides = {}, seed = 42, years = 10, runs = 12 } = {}) {
  if (!experiment || !Array.isArray(experiment.worldModel?.variables) || !experiment.worldModel.variables.length) {
    throw new Error("Live simulation requires an experiment with world model variables.");
  }
  const horizon = boundedInteger(years, 10, 50);
  const count = boundedInteger(runs, 12, 64);
  const safeSeed = Number.isFinite(Number(seed)) ? Math.floor(Number(seed)) >>> 0 : 42;
  const configured = { ...experiment, experiment: { ...experiment.experiment, horizonYears: horizon, runs: count, seed: safeSeed } };
  const normalized = normalizeLiveOverrides(configured, overrides);
  const adapter = createHblCivicDynamicsAdapter();
  const createBatch = (parameterOverrides) => {
    const batch = generateWorlds(configured, { runs: count, seed: safeSeed, overrides: parameterOverrides });
    // HBL's event draws use world.id. Include its seed so changing the seed also
    // changes event draws, while baseline/current preserve paired event draws.
    return { ...batch, worlds: batch.worlds.map((world) => ({ ...world, id: `${world.id}_${world.seed}` })) };
  };
  const baseline = summarize(await simulateExperiment(configured, createBatch({}), adapter));
  const current = summarize(await simulateExperiment(configured, createBatch(normalized.generatorOverrides), adapter));
  return {
    schemaVersion: "live-simulation.v1", baseline, current,
    seed: safeSeed, years: horizon, runs: count, overrides: normalized.values,
    metricRegistry: configured.outcomes?.metricRegistry || [], warnings: normalized.warnings,
    predictive: false,
    disclaimer: "Exploratory systems model; ensemble ranges are scenario spread, not forecast confidence intervals.",
  };
}
