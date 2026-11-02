import { resolveHousingModel, createHousingScenarios } from "./index.js";
import { housingCausalRegistry } from "./causal-registry.js";

/** Browser-safe deterministic OAT reruns. These quantify this model's behavior,
 * not real-world causal effects. Reuse recorded effective sampledParameters,
 * exact seed, projects, schedules and fork operations; never resample uncertainty.
 */
function runInput(run, scenario = {}, years) {
  if (!run || !Number.isInteger(run.seed)) throw new Error("A recorded run and its integer seed are required.");
  const version = run.modelVersion || scenario.modelVersion || "1.2.0";
  const resolved = resolveHousingModel(version);
  const horizon = years ?? Math.max(0, ...(run.timeline || []).map((row) => row.year));
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 50) throw new Error("Provide the recorded simulation horizon in years.");
  const projects = run.inputProjects ?? scenario.projects ?? run.projects?.map((row) => row.proposal) ?? [];
  const input = { parameters: structuredClone(run.sampledParameters || run.parameters || scenario.parameters || {}), seed: run.seed, years: horizon,
    projects: structuredClone(projects), scheduledStress: structuredClone(run.scheduledStress || scenario.scheduledStress || []) };
  const fork = run.fork || scenario.timelineFork || scenario.fork;
  if (fork && !run.inputProjects && !scenario.projects && run.projects?.length) throw new Error("Fork attribution requires original inputProjects or the source scenario; final project rows cannot reconstruct a branch's original inputs safely.");
  if (fork) input.fork = structuredClone(fork);
  return { input, resolved, version };
}
const difference = (a, b) => Object.fromEntries(Object.keys(a).filter((id) => Number.isFinite(a[id]) && Number.isFinite(b[id])).map((id) => [id, a[id] - b[id]]));

export function runHousingCounterfactual({ run, scenario, years, parameterId, value, metricId = "median_rent" } = {}) {
  const { input, resolved, version } = runInput(run, scenario, years);
  const definition = resolved.model.parameters.find((row) => row.id === parameterId);
  if (!definition || typeof value !== "number" || !Number.isFinite(value) || value < definition.min || value > definition.max) throw new Error("Counterfactual requires a registered parameter and bounded finite value.");
  if (!resolved.model.metrics.some((row) => row.id === metricId)) throw new Error(`Unknown counterfactual metric ${metricId}.`);
  const baseline = resolved.simulateRun(input);
  const counterfactual = resolved.simulateRun({ ...input, parameters: { ...input.parameters, [parameterId]: value } });
  const deltas = difference(counterfactual.metrics, baseline.metrics);
  const recordedMismatch = run.metrics ? Object.keys(baseline.metrics).filter((id) => Number.isFinite(run.metrics[id]) && run.metrics[id] !== baseline.metrics[id]) : [];
  return { parameterId, value, metricId, delta: deltas[metricId], deltas, metrics: counterfactual.metrics,
    baseline, counterfactual, events: counterfactual.events, seed: input.seed, modelVersion: version, recordedMismatch,
    method: "matched-seed one-at-a-time numerical rerun; effective inputs retained", causalClaim: "within-model intervention only",
    warnings: ["Nonlinear interactions and stochastic paths are not uniquely attributable to one assumption.",
      ...(recordedMismatch.length ? ["Reconstructed inputs do not reproduce some recorded metrics; inspect the retained manifest before interpreting attribution."] : [])] };
}

/** Analysis entry point. Revert each changed assumption to a paired baseline,
 * retain the five largest absolute within-model deltas, and expose the residual.
 * Individual reversions are not additive/Shapley contributions; interactions,
 * project differences and omitted drivers remain in the explicit residual.
 */
export function explainHousingRun({ run, scenario, baselineRun, baselineScenario, years, metricId = "median_rent", limit = 5 } = {}) {
  const { input, resolved, version } = runInput(run, scenario, years);
  if (!resolved.model.metrics.some((row) => row.id === metricId)) throw new Error(`Unknown explanation metric ${metricId}.`);
  const selected = resolved.simulateRun(input);
  const defaults = createHousingScenarios()[0].parameters;
  let baselineParameters = { ...defaults, ...(baselineRun?.sampledParameters || baselineRun?.parameters || baselineScenario?.parameters || {}) };
  if (!baselineRun?.sampledParameters && baselineScenario?.stressPresets?.length) baselineParameters = resolved.applyStressPresets(baselineParameters, baselineScenario.stressPresets);
  const baselineProjects = baselineRun?.inputProjects || baselineScenario?.projects || baselineRun?.projects?.map((row) => row.proposal) || [];
  if (baselineRun?.modelVersion && baselineRun.modelVersion !== version) throw new Error("Attribution requires the same recorded model version for selected and baseline runs.");
  const baseline = resolved.simulateRun({ parameters: baselineParameters, seed: input.seed, years: input.years, projects: baselineProjects,
    scheduledStress: baselineRun?.scheduledStress || baselineScenario?.scheduledStress || [], ...((baselineRun?.fork || baselineScenario?.timelineFork || baselineScenario?.fork) ? { fork: baselineRun?.fork || baselineScenario?.timelineFork || baselineScenario?.fork } : {}) });
  const contributions = [];
  for (const definition of resolved.model.parameters) {
    const from = input.parameters[definition.id] ?? definition.default;
    const to = baselineParameters[definition.id];
    if (from === to) continue;
    const reverted = resolved.simulateRun({ ...input, parameters: { ...input.parameters, [definition.id]: to } });
    const delta = selected.metrics[metricId] - reverted.metrics[metricId];
    contributions.push({ parameterId: definition.id, id: definition.id, label: definition.label, value: from, baselineValue: to, delta,
      metricId, unit: resolved.model.metrics.find((metric) => metric.id === metricId).unit, counterfactualMetric: reverted.metrics[metricId],
      equationIds: housingCausalRegistry.edges.filter((edge) => edge.from === definition.id).map((edge) => edge.equationId) });
  }
  contributions.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.parameterId.localeCompare(b.parameterId));
  const topFive = contributions.slice(0, Math.max(1, Math.min(5, Math.floor(limit) || 5)));
  const totalDelta = selected.metrics[metricId] - baseline.metrics[metricId];
  const sumOfReversions = contributions.reduce((sum, row) => sum + row.delta, 0);
  return { metricId, modelVersion: version, seed: input.seed, selected, baseline, totalDelta, contributions, topFive, reasons: topFive,
    sumOfReversions, residual: totalDelta - sumOfReversions,
    topFiveResidual: totalDelta - topFive.reduce((sum, row) => sum + row.delta, 0),
    method: "same-seed single-parameter reversions to baseline; nonlinear, nonadditive model diagnostics",
    baselineSource: baselineRun ? "recorded baseline parameters, rerun with selected seed" : baselineScenario ? "supplied baseline scenario" : "illustrative current-policy defaults",
    events: selected.events, equations: housingCausalRegistry.equations,
    caveat: "Reversion deltas are not causal percentages or an additive decomposition. Residual includes interactions, project/schedule/fork differences and unexamined effects; observational association is not causation.",
    empirical: false };
}
