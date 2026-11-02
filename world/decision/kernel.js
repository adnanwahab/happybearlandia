import { deriveSeed } from "../world-generator.js";
import { DECISION_ENGINE_VERSION, classifyDecisionOutcome } from "./contracts.js";

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Independent parameter streams preserve pairing when one distribution changes. */
export function sampleDecisionParameters(parameters, uncertainty = {}, seed = 42) {
  const sampled = { ...parameters };
  for (const [id, distribution] of Object.entries(uncertainty)) {
    const random = seededRandom(deriveSeed(seed, id));
    const { min, max, type } = distribution;
    if (type === "fixed") { sampled[id] = distribution.value; continue; }
    if (max <= min) { sampled[id] = min; continue; }
    const u = random();
    if (type === "uniform") sampled[id] = min + u * (max - min);
    else if (type === "triangular") {
      const mode = distribution.mode;
      const split = (mode - min) / (max - min);
      sampled[id] = u < split ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    } else if (type === "normal") {
      const z = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, u))) * Math.cos(2 * Math.PI * random());
      sampled[id] = Math.max(min, Math.min(max, distribution.mean + z * distribution.stddev));
    }
  }
  return sampled;
}

/** Linear interpolation between ordered observations, including endpoints. */
export function percentile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.max(0, Math.min(1, probability)) * (sorted.length - 1);
  const low = Math.floor(index);
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
}
export function summarizeValues(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return { mean: finite.reduce((sum, value) => sum + value, 0) / finite.length, median: percentile(finite, 0.5), p10: percentile(finite, 0.1), p90: percentile(finite, 0.9), min: Math.min(...finite), max: Math.max(...finite) };
}
const lowerIsBetter = (metric) => ["lower-is-better", "lower", "minimize"].includes(metric.direction || metric.better);

export function aggregateDecisionResults({ experiment, runs = [], model }) {
  const aggregates = experiment.scenarios.map((scenario) => {
    const rows = runs.filter((run) => run.scenarioId === scenario.id);
    const successful = rows.filter((run) => run.status === "completed");
    const metrics = {};
    for (const metric of model.metrics) {
      const summary = summarizeValues(successful.map((run) => run.metrics?.[metric.id]));
      if (summary) metrics[metric.id] = summary;
    }
    const criterion = scenario.successCriterion;
    const evaluated = criterion ? successful.filter((run) => Number.isFinite(run.metrics?.[criterion.metricId])) : [];
    const successes = evaluated.filter((run) => criterion.operator === "gte" ? run.metrics[criterion.metricId] >= criterion.value : run.metrics[criterion.metricId] <= criterion.value).length;
    const outcomeCounts = { success: 0, mixed: 0, failure: 0, unclassified: 0 };
    for (const run of successful) outcomeCounts[classifyDecisionOutcome(run.metrics, scenario)]++;
    return { scenarioId: scenario.id, scenarioName: scenario.name, count: successful.length, failed: rows.filter((run) => run.status === "failed").length, metrics,
      outcomeCounts, outcomeShares: Object.fromEntries(Object.entries(outcomeCounts).map(([key, count]) => [key, successful.length ? count / successful.length : null])),
      ...(scenario.outcomeCriteria ? { outcomeCriteria: scenario.outcomeCriteria, successShare: successful.length ? outcomeCounts.success / successful.length : null } : {}),
      ...(criterion ? { successCriterion: criterion, successCount: successes, evaluatedCount: evaluated.length, successShare: evaluated.length ? successes / evaluated.length : null } : {}) };
  });
  const baselineScenarioId = experiment.scenarios.find((scenario) => scenario.kind === "baseline")?.id;
  const baseline = new Map(runs.filter((run) => run.scenarioId === baselineScenarioId && run.status === "completed").map((run) => [run.seed, run]));
  const comparisons = experiment.scenarios.filter((scenario) => scenario.id !== baselineScenarioId).map((scenario) => {
    const rows = runs.filter((run) => run.scenarioId === scenario.id && run.status === "completed");
    const metrics = {};
    for (const metric of model.metrics) {
      const differences = [];
      for (const run of rows) {
        const control = baseline.get(run.seed)?.metrics?.[metric.id];
        const value = run.metrics?.[metric.id];
        if (Number.isFinite(control) && Number.isFinite(value)) differences.push(value - control);
      }
      if (!differences.length) continue;
      const summary = summarizeValues(differences);
      const directional = metric.direction || metric.better;
      const knownDirection = ["lower-is-better", "lower", "minimize", "higher-is-better", "higher", "maximize"].includes(directional);
      metrics[metric.id] = {
        meanDelta: summary.mean, medianDelta: summary.median,
        probabilityImprovement: knownDirection ? differences.filter((delta) => lowerIsBetter(metric) ? delta < 0 : delta > 0).length / differences.length : null,
        pairedCount: differences.length,
      };
    }
    return { scenarioId: scenario.id, baselineScenarioId, metrics };
  });
  return { aggregates, comparisons };
}

const yieldLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Runs round-robin by index so progressive results include matched scenarios.
 * onProgress receives {runs:[new rows only],progress,status}; never fake rows.
 * Can execute in a Worker or directly with injectable model/simulator for tests.
 * Cancellation retains completed/failed rows and stops scheduling new work.
 */
export async function executeDecisionExperiment({ experiment, model, simulateRun, simulateFork, applyStressPresets, onProgress = () => {}, shouldCancel = () => false, yieldEvery = 8, retainRuns = true, retainTraces = true }) {
  const start = performance.now();
  const total = experiment.runs * experiment.scenarios.length;
  const runs = [];
  let successful = 0;
  let failed = 0;
  let completed = 0;
  let pending = [];
  let sinceYield = performance.now();
  const progress = () => ({ completed, total, successful, failed, elapsedMs: Math.round(performance.now() - start) });
  const publish = async (status) => { await onProgress({ runs: pending, progress: progress(), status }); pending = []; };
  await publish("running");
  outer: for (let index = 0; index < experiment.runs; index++) {
    const pairedSeed = deriveSeed(experiment.seed, index);
    for (const scenario of experiment.scenarios) {
      const seed = scenario.timelineFork?.mode === "selected-future" ? scenario.timelineFork.sourceSeed : pairedSeed;
      if (shouldCancel()) break outer;
      const startedAt = new Date().toISOString();
      const preStressSampledParameters = sampleDecisionParameters(scenario.parameters, scenario.uncertainty, seed);
      const row = {
        id: `${scenario.id}_${String(index + 1).padStart(4, "0")}`, experimentId: experiment.id, scenarioId: scenario.id,
        seed, runIndex: index, modelVersion: model.version, engineVersion: DECISION_ENGINE_VERSION,
        parameters: { ...scenario.parameters }, sampledParameters: preStressSampledParameters,
        preStressSampledParameters, appliedStressPresets: [], metrics: {}, timeline: [], events: [], drivers: [],
        startedAt, completedAt: null, status: "running", error: null, outcome: "unclassified",
        ...(scenario.projects ? { inputProjects: JSON.parse(JSON.stringify(scenario.projects)) } : {}),
        ...(scenario.scheduledStress ? { scheduledStress: JSON.parse(JSON.stringify(scenario.scheduledStress)) } : {}),
        ...(scenario.timelineFork ? { timelineFork: JSON.parse(JSON.stringify(scenario.timelineFork)) } : {}),
      };
      const runStart = performance.now();
      try {
        // Stress applies ONCE after uncertainty draws so a supply-constraint or
        // financing shock cannot be silently erased by a broad distribution.
        // Store both pre-stress draws and final effective inputs for replay.
        if (scenario.stressPresets?.length) {
          if (typeof applyStressPresets !== "function") throw new Error("Model does not support stress presets");
          row.sampledParameters = applyStressPresets(preStressSampledParameters, scenario.stressPresets);
          row.appliedStressPresets = [...scenario.stressPresets];
        }
        const args = { parameters: row.sampledParameters, seed, years: experiment.years, projects: scenario.projects || [], scheduledStress: scenario.scheduledStress || [] };
        if (scenario.timelineFork && typeof simulateFork !== "function") throw new Error("This model version does not support timeline forks");
        const result = scenario.timelineFork ? await simulateFork({ ...args, fork: { month: scenario.timelineFork.month, operations: scenario.timelineFork.operations } }) : await simulateRun(args);
        if (!result || !result.metrics || !Array.isArray(result.timeline) || !result.timeline.length) throw new Error("Model returned missing metrics or yearly timeline");
        for (const metric of model.metrics) {
          if (!Number.isFinite(result.metrics[metric.id])) throw new Error(`Model returned non-finite metric ${metric.id}`);
          if (result.timeline.some((entry) => !Number.isFinite(entry.year) || !Number.isFinite(entry.metrics?.[metric.id]))) throw new Error(`Model returned invalid yearly ${metric.id}`);
        }
        row.metrics = result.metrics;
        row.outcome = classifyDecisionOutcome(result.metrics, scenario);
        row.timeline = result.timeline;
        row.events = result.events || [];
        row.drivers = result.drivers || [];
        if (result.projects) row.projects = result.projects;
        if (result.projectMetrics) row.projectMetrics = result.projectMetrics;
        if (result.accounting) row.accounting = result.accounting;
        if (result.monthlyTimeline) row.monthlyTimeline = result.monthlyTimeline;
        if (result.fork) row.fork = result.fork;
        row.status = "completed";
        successful++;
      } catch (error) {
        row.status = "failed";
        row.error = String(error?.message || error).slice(0, 2000);
        failed++;
      }
      row.completedAt = new Date().toISOString();
      if (!retainTraces) {
        // Optimization explicitly retains summaries, never accumulates full
        // monthly/project traces and then discards them after a memory spike.
        row.traceRetention = "summary-only"; row.timeline = []; row.events = []; row.drivers = [];
        delete row.monthlyTimeline; delete row.projects; delete row.projectMetrics;
      }
      row.durationMs = Math.round((performance.now() - runStart) * 100) / 100;
      if (retainRuns) runs.push(row);
      completed++;
      pending.push(row);
      if (pending.length >= yieldEvery || performance.now() - sinceYield >= 12) {
        await publish("running");
        await yieldLoop();
        sinceYield = performance.now();
      }
    }
  }
  const status = shouldCancel() ? "cancelled" : successful ? "completed" : "failed";
  await publish(status);
  return { runs, progress: progress(), status, ...(retainRuns ? aggregateDecisionResults({ experiment, runs, model }) : {}) };
}
