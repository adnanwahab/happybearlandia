import { analyzeBuildingProjects } from "../buildings/project-analysis.js";
/** Deterministic descriptive analysis of stored successful runs. No causal attribution. */
export const isNumeric = value => typeof value === "number" && Number.isFinite(value);
export const successfulRuns = runs => (runs || []).filter(run => ["completed", "successful", "succeeded"].includes(run.status) && run.metrics && Object.values(run.metrics).some(isNumeric));
export function percentile(values, probability) {
  const sorted = values.filter(isNumeric).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = Math.max(0, Math.min(1, probability)) * (sorted.length - 1);
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}
export const average = values => { const rows = values.filter(isNumeric); return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null; };
export function metricDirection(metric = {}) {
  const direction = metric.direction ?? metric.preferredDirection ?? metric.better ?? metric.optimize;
  if (metric.higherIsBetter === false || metric.lowerIsBetter === true || ["lower", "minimize", "decrease", "lower-is-better"].includes(direction)) return -1;
  if (metric.higherIsBetter === true || metric.lowerIsBetter === false || ["higher", "maximize", "increase", "higher-is-better"].includes(direction)) return 1;
  return null;
}
function correlation(pairs) {
  if (pairs.length < 3) return null;
  const mx = average(pairs.map(row => row[0])), my = average(pairs.map(row => row[1]));
  let xy = 0, xx = 0, yy = 0;
  for (const [x, y] of pairs) { xy += (x - mx) * (y - my); xx += (x - mx) ** 2; yy += (y - my) ** 2; }
  return xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : null;
}
const parametersOf = run => ({ ...run.parameters, ...run.sampledParameters });
export function analyzeDecision({ experiment, runs = [], aggregates = [], comparisons = [], model = {}, evidence = [] } = {}) {
  const rows = successfulRuns(runs);
  const scenarios = experiment?.scenarios || [];
  const metricDefinitions = model.metrics || [];
  const primaryMetric = metricDefinitions.find(metric => metric.primary) || metricDefinitions.find(metric => /affordability/i.test(metric.id)) || metricDefinitions[0];
  const metricId = primaryMetric?.id || Object.keys(rows[0]?.metrics || {})[0] || null;
  const baseline = scenarios.find(scenario => scenario.kind === "baseline") || scenarios[0];
  const baselineBySeed = new Map(rows.filter(run => run.scenarioId === baseline?.id).map(run => [run.seed, run]));
  const sensitivities = [], failureClusters = [];
  const parameterDefinitions = model.parameters || [];
  for (const scenario of scenarios) {
    const group = rows.filter(run => run.scenarioId === scenario.id);
    for (const parameter of parameterDefinitions) {
      const pairs = group.map(run => [parametersOf(run)[parameter.id], run.metrics[metricId]]).filter(pair => pair.every(isNumeric));
      const coefficient = correlation(pairs);
      if (coefficient !== null) sensitivities.push({ scenarioId: scenario.id, scenarioName: scenario.name, parameterId: parameter.id, label: parameter.label || parameter.id, metricId, correlation: coefficient, magnitude: Math.abs(coefficient), count: pairs.length, method: "Within-scenario Pearson association; not causal importance" });
    }
    if (scenario.id === baseline?.id || !metricId) continue;
    const direction = metricDirection(primaryMetric);
    const paired = group.map(run => ({ run, baseline: baselineBySeed.get(run.seed) })).filter(pair => pair.baseline && isNumeric(pair.run.metrics[metricId]) && isNumeric(pair.baseline.metrics[metricId]));
    const unfavorable = direction === null ? [] : paired.filter(pair => direction * (pair.run.metrics[metricId] - pair.baseline.metrics[metricId]) < 0).map(pair => pair.run);
    const conditions = [];
    for (const parameter of parameterDefinitions) {
      const values = group.map(run => parametersOf(run)[parameter.id]).filter(isNumeric);
      if (values.length < 3 || percentile(values, 0) === percentile(values, 1)) continue;
      for (const [tail, q] of [["high", 0.75], ["low", 0.25]]) {
        const threshold = percentile(values, q);
        const matches = run => { const value = parametersOf(run)[parameter.id]; return isNumeric(value) && (tail === "high" ? value >= threshold : value <= threshold); };
        const observed = unfavorable.filter(run => isNumeric(parametersOf(run)[parameter.id]));
        if (!observed.length) continue;
        const count = observed.filter(matches).length, prevalence = count / observed.length;
        const baseCount = paired.filter(pair => isNumeric(parametersOf(pair.run)[parameter.id]));
        const referencePrevalence = baseCount.length ? baseCount.filter(pair => matches(pair.run)).length / baseCount.length : 0;
        if (count) conditions.push({ parameterId: parameter.id, label: parameter.label || parameter.id, unit: parameter.unit || "", tail, threshold, count, denominator: observed.length, prevalence, referencePrevalence, enrichment: prevalence - referencePrevalence });
      }
    }
    failureClusters.push({ scenarioId: scenario.id, scenarioName: scenario.name, metricId, baselineScenarioId: baseline?.id, pairedCount: paired.length, count: unfavorable.length, fraction: paired.length && direction !== null ? unfavorable.length / paired.length : null, runIds: unfavorable.map(run => run.id), conditions: conditions.sort((a, b) => b.enrichment - a.enrichment || b.prevalence - a.prevalence).slice(0, 8), definition: direction === null ? "Metric direction unspecified; unfavorable outcomes are not classified." : "Strictly worse than the same-seed current-policy baseline on the primary metric; ties are excluded." });
  }
  sensitivities.sort((a, b) => b.magnitude - a.magnitude || String(a.scenarioId).localeCompare(String(b.scenarioId)) || a.parameterId.localeCompare(b.parameterId));
  const explanations = rows.map(run => ({ runId: run.id, scenarioId: run.scenarioId, seed: run.seed, drivers: run.drivers ?? [], events: run.events ?? [], provenance: "Stored model drivers and events; no causal contribution percentages inferred." }));
  const assumptions = scenarios.flatMap(scenario => parameterDefinitions.map(parameter => ({ id: `${scenario.id}:${parameter.id}`, scenarioId: scenario.id, scenarioName: scenario.name, parameterId: parameter.id, assumption: parameter.label || parameter.id, value: scenario.parameters?.[parameter.id] ?? parameter.default ?? null, unit: parameter.unit || "", uncertainty: scenario.uncertainty?.[parameter.id] || { type: "fixed" }, source: parameter.source || "Model default / user scenario", confidence: parameter.confidence || "Unvalidated", notes: parameter.description || "", date: experiment?.createdAt || "Not recorded", component: model.id || experiment?.modelId || "Unspecified" })));
  const limitations = [...new Set([...(model.limitations || []).map(item => typeof item === "string" ? item : JSON.stringify(item)), "Exploratory scenario model; simulated intervals are not forecast confidence intervals.", "Associations can reflect correlated inputs and do not establish causal effects.", "Failure frequencies describe the chosen scenarios and uncertainty distributions only.", "Evidence attachments are user-provided metadata; attaching a source does not validate a model.", "Unavailable observations and omitted mechanisms cannot be recovered from simulation results."] )];
  const projectAnalysis = analyzeBuildingProjects({ experiment, runs, model, baselineScenarioId: baseline?.id });
  return { projectAnalysis, successCriteria: projectAnalysis.successCriteria, worldEditAudit: projectAnalysis.editAudit, schemaVersion: "decision-analysis.v1", metricId, primaryMetric, baselineScenarioId: baseline?.id ?? null, successful: rows.length, failed: Math.max(runs.filter(run => run.status === "failed").length, experiment?.progress?.failed || 0), sensitivities, failureClusters, explanations, assumptions, evidence: Array.isArray(evidence) ? evidence : [], aggregates, comparisons, limitations, empty: rows.length === 0 };
}
