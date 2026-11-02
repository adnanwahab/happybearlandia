/** INTELLIGENCE CONTRACT: analyzeIntelligence(context), mineOutcomeRules,
 * proposeRuleFix, explainFuture, queryFuture and runPartialDependence are pure
 * analyses/diagnostics. context={input,results,selectedRun,previousResults,model?}.
 * results.experiment is the immutable source; input is the current editable draft.
 * Only the host's onProposeEdit callback can open approval. No apply/rerun here.
 * Rule lift and descriptive sensitivity are associations, never causal estimates.
 */
import { successfulRuns, percentile, average, isNumeric, metricDirection } from "./analysis.js";
import { classifyDecisionOutcome } from "./contracts.js";
import { getWorldRevisionId, fingerprintWorldInput } from "../ai/edit-schema.js";

export const experimentOf = context => context?.results?.experiment || context?.experiment || context?.input || null;
export const runsOf = context => successfulRuns(context?.results?.runs || context?.runs || []);
export const modelOf = context => context?.results?.model || context?.model || {};
const paramsOf = run => ({ ...run.parameters, ...run.sampledParameters });
const numberText = value => isNumeric(value) ? Number(value.toPrecision(5)).toLocaleString("en-US") : "unavailable";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function classifyOutcomes({ experiment, runs = [], model = {}, metricId, mode = "recorded" } = {}) {
  const rows = successfulRuns(runs), scenarios = experiment?.scenarios || [];
  const baseline = scenarios.find(scenario => scenario.kind === "baseline") || scenarios[0];
  const reference = new Map(rows.filter(run => run.scenarioId === baseline?.id).map(run => [run.seed, run]));
  const defaultMetric = metricId || model.metrics?.find(metric => metric.primary)?.id || model.metrics?.find(metric => metric.id === "affordability")?.id || model.metrics?.[0]?.id;
  return rows.map(run => {
    const scenario = scenarios.find(item => item.id === run.scenarioId), criterion = scenario?.successCriterion;
    const id = criterion?.metricId || defaultMetric, value = run.metrics?.[id];
    let outcome = "unclassified", definition = "No explicit recorded criterion; cloud outcomes remain unclassified. Select paired-baseline diagnostic explicitly to inspect relative outcomes.";
    if (scenario?.outcomeCriteria) {
      outcome = classifyDecisionOutcome(run.metrics, scenario);
      definition = `Recorded outcomeCriteria: failure ANY takes precedence; success ALL; otherwise mixed. ${JSON.stringify(scenario.outcomeCriteria)}`;
    } else if (criterion && isNumeric(value) && isNumeric(criterion.value) && ["gte", "lte"].includes(criterion.operator)) {
      outcome = classifyDecisionOutcome(run.metrics, scenario);
      definition = `${id} ${criterion.operator === "gte" ? "≥" : "≤"} ${criterion.value} at the recorded horizon`;
    } else if (!criterion && mode === "paired-baseline" && run.scenarioId !== baseline?.id) {
      const compared = reference.get(run.seed), direction = metricDirection(model.metrics?.find(metric => metric.id === id));
      if (compared && isNumeric(value) && isNumeric(compared.metrics?.[id]) && direction !== null) {
        const delta = (value - compared.metrics[id]) * direction;
        outcome = delta > 0 ? "success" : delta < 0 ? "failure" : "mixed";
        definition = `${id} compared with the same-seed current-policy baseline; ties are mixed`;
      }
    }
    return { run, outcome, metricId: id, value, definition };
  });
}

const matches = (row, condition) => {
  const value = paramsOf(row.run)[condition.parameterId];
  return isNumeric(value) && (condition.operator === "gte" ? value >= condition.value : value <= condition.value);
};
export function mineOutcomeRules({ classified = [], model = {}, target = "failure", minCount = 3, minSupport = 0.1, minLift = 1.05, maxRules = 12 } = {}) {
  if (!["failure", "success"].includes(target)) throw new Error("Rule target must be failure or success.");
  if (!Number.isInteger(minCount) || minCount < 2 || !isNumeric(minSupport) || minSupport <= 0 || minSupport > 1) throw new Error("Use minCount ≥2 and minSupport in (0,1].");
  const groups = new Map(), output = [];
  for (const row of classified) if (["failure", "success", "mixed"].includes(row.outcome)) { if (!groups.has(row.run.scenarioId)) groups.set(row.run.scenarioId, []); groups.get(row.run.scenarioId).push(row); }
  for (const [scenarioId, group] of groups) {
    const targetCount = group.filter(row => row.outcome === target).length, baseRate = targetCount / group.length;
    if (targetCount < minCount || group.length < minCount * 2) continue;
    const candidates = [];
    for (const parameter of model.parameters || []) {
      const values = group.map(row => paramsOf(row.run)[parameter.id]).filter(isNumeric);
      if (values.length < minCount * 2 || percentile(values, 0) === percentile(values, 1)) continue;
      for (const [operator, quantile] of [["lte", 0.25], ["gte", 0.75]]) candidates.push([{ parameterId: parameter.id, label: parameter.label || parameter.id, unit: parameter.unit || "", operator, value: percentile(values, quantile) }]);
    }
    const score = conditions => {
      const covered = group.filter(row => conditions.every(condition => matches(row, condition))), count = covered.length;
      const hits = covered.filter(row => row.outcome === target), outcomeCount = hits.length;
      const support = count / group.length, conditionalRate = count ? outcomeCount / count : null;
      if (count < minCount || outcomeCount < minCount || support < minSupport || count === group.length) return null;
      const lift = conditionalRate / baseRate;
      if (lift < minLift) return null;
      return { id: `${scenarioId}:${target}:${conditions.map(condition => `${condition.parameterId}:${condition.operator}:${condition.value}`).join("&")}`, scenarioId, target, conditions, populationCount: group.length, targetCount, count, outcomeCount, support, baseRate, conditionalRate, lift, prevalenceInTarget: outcomeCount / targetCount, runIds: hits.map(row => row.run.id), allConditionRunIds: covered.map(row => row.run.id), minCount, minSupport, method: "Exploratory within-scenario quartile association; same sample used for discovery and description; no causal or out-of-sample claim." };
    };
    const singles = candidates.map(score).filter(Boolean).sort((a, b) => b.lift - a.lift || b.outcomeCount - a.outcomeCount || a.id.localeCompare(b.id));
    const conjunctions = [];
    for (let i = 0; i < Math.min(8, singles.length); i++) for (let j = i + 1; j < Math.min(8, singles.length); j++) {
      if (singles[i].conditions[0].parameterId === singles[j].conditions[0].parameterId) continue;
      const conjunction = score([singles[i].conditions[0], singles[j].conditions[0]]);
      if (conjunction) conjunctions.push(conjunction);
    }
    output.push(...[...singles, ...conjunctions].sort((a, b) => b.lift - a.lift || b.outcomeCount - a.outcomeCount || a.conditions.length - b.conditions.length || a.id.localeCompare(b.id)).slice(0, maxRules));
  }
  return output;
}

function association(pairs) {
  if (pairs.length < 3) return null;
  const mx = average(pairs.map(pair => pair[0])), my = average(pairs.map(pair => pair[1]));
  let xy = 0, xx = 0, yy = 0;
  for (const [x, y] of pairs) { xy += (x - mx) * (y - my); xx += (x - mx) ** 2; yy += (y - my) ** 2; }
  return xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : null;
}
export function descriptiveSensitivity({ runs = [], model = {}, scenarioId, metricId } = {}) {
  const group = successfulRuns(runs).filter(run => run.scenarioId === scenarioId && isNumeric(run.metrics?.[metricId]));
  return (model.parameters || []).flatMap(parameter => {
    const pairs = group.map(run => [paramsOf(run)[parameter.id], run.metrics[metricId]]).filter(pair => pair.every(isNumeric));
    const coefficient = association(pairs);
    return coefficient === null ? [] : [{ parameterId: parameter.id, label: parameter.label || parameter.id, metricId, correlation: coefficient, magnitude: Math.abs(coefficient), count: pairs.length, confidence: parameter.confidence || parameter.source?.confidence || "unverified", source: parameter.source || null, method: "Within-scenario Pearson association; tornado length is |r|, not a causal contribution." }];
  }).sort((a, b) => b.magnitude - a.magnitude || a.parameterId.localeCompare(b.parameterId));
}

export function descriptiveBins({ runs = [], scenarioId, parameterId, metricId, count = 5 } = {}) {
  const pairs = successfulRuns(runs).filter(run => run.scenarioId === scenarioId).map(run => ({ x: paramsOf(run)[parameterId], y: run.metrics?.[metricId] })).filter(pair => isNumeric(pair.x) && isNumeric(pair.y)).sort((a, b) => a.x - b.x);
  if (!pairs.length) return [];
  const bins = [];
  // Equal-size sorted chunks, merged at ties so identical inputs do not masquerade as different values.
  for (let index = 0; index < pairs.length;) {
    let end = Math.min(pairs.length, index + Math.ceil(pairs.length / Math.max(1, count)));
    while (end < pairs.length && pairs[end].x === pairs[end - 1].x) end++;
    const rows = pairs.slice(index, end), values = rows.map(row => row.y);
    bins.push({ min: rows[0].x, max: rows.at(-1).x, count: rows.length, mean: average(values), median: percentile(values, 0.5), p10: percentile(values, 0.1), p90: percentile(values, 0.9), method: "Descriptive input bins, NOT partial dependence; other inputs can differ." });
    index = end;
  }
  return bins;
}

const LEVERS = new Set(["construction_capacity", "permitting_months", "construction_months", "zoning_density", "subsidy_amount", "voucher_funding", "adoption", "implementation_delay", "resistance", "funding_delivery", "transit_share"]);
export function proposeRuleFix({ rule, input, scenarioId = rule?.scenarioId, model = {} } = {}) {
  if (!rule || rule.target !== "failure") throw new Error("Choose an observed failure rule to propose a fix.");
  const scenario = input?.scenarios?.find(row => row.id === scenarioId);
  if (!scenario || scenarioId !== rule.scenarioId) throw new Error("Rule scenario no longer exists in the current draft.");
  const condition = rule.conditions.find(row => LEVERS.has(row.parameterId));
  if (!condition) throw new Error("This rule concerns external assumptions. No controllable policy fix is inferred.");
  const definition = model.parameters?.find(row => row.id === condition.parameterId);
  const current = scenario.parameters?.[condition.parameterId] ?? definition?.default;
  if (!definition || !isNumeric(current) || !isNumeric(definition.min) || !isNumeric(definition.max)) throw new Error("No bounded parameter definition is available.");
  const step = Math.max(definition.step || 0, (definition.max - definition.min) * 0.02);
  // Test the opposite side of an observed unfavorable range; never promise benefit.
  let value = condition.operator === "lte" ? Math.max(current + step, condition.value + step) : Math.min(current - step, condition.value - step);
  value = clamp(value, definition.min, definition.max);
  if (definition.step) value = clamp(Math.round(value / definition.step) * definition.step, definition.min, definition.max);
  if (value === current) throw new Error("The current draft is already at the bounded limit; no additional fix can be proposed.");
  return { schemaVersion: "world-edit.v1", scenarioId, baseRevision: getWorldRevisionId(input), baseInputFingerprint: fingerprintWorldInput(input), summary: `Test ${definition.label || definition.id}: ${numberText(current)} → ${numberText(value)} ${definition.unit || ""}`, operations: [{ op: "set_parameter", target: definition.id, value }], requiresSimulationRerun: true, provider: "local-analysis", model: "descriptive-rules.v1", prompt: `Test a bounded hypothesis from failure rule ${rule.id}`, warnings: [`Exploratory association only: ${rule.outcomeCount}/${rule.count} condition-matching runs failed; base rate ${(rule.baseRate * 100).toFixed(1)}%; lift ${rule.lift.toFixed(2)}×. This is not evidence that the edit will improve outcomes.`, "Explicit human approval is required. Rerun matched seeds to evaluate the hypothesis; no input was changed by this proposal.", "set_parameter fixes this effective input at the approved value, replacing any uncertainty for that input. Review that assumption and resource/fiscal feasibility."] };
}

export function compareExperiments({ current, previous, model = {} } = {}) {
  if (!current?.experiment || !previous?.experiment) return { available: false, reason: "Complete an earlier experiment and rerun to compare actual results." };
  const now = successfulRuns(current.runs), before = successfulRuns(previous.runs);
  const sameVersion = current.experiment.modelId === previous.experiment.modelId && current.experiment.modelVersion === previous.experiment.modelVersion;
  const sameHorizon = current.experiment.years === previous.experiment.years;
  const reference = new Map(before.map(run => [`${run.scenarioId}:${run.seed}`, run]));
  const pairs = now.flatMap(run => { const old = reference.get(`${run.scenarioId}:${run.seed}`); return old ? [{ run, old }] : []; });
  const metrics = [...new Set(pairs.map(pair => pair.run.scenarioId))].flatMap(scenarioId => (model.metrics || []).flatMap(metric => {
    const deltas = pairs.filter(pair => pair.run.scenarioId === scenarioId).map(({ run, old }) => isNumeric(run.metrics?.[metric.id]) && isNumeric(old.metrics?.[metric.id]) ? run.metrics[metric.id] - old.metrics[metric.id] : null).filter(isNumeric);
    return !deltas.length ? [] : [{ scenarioId, scenarioName: current.experiment.scenarios?.find(scenario => scenario.id === scenarioId)?.name || scenarioId, metricId: metric.id, label: metric.label || metric.id, unit: metric.unit || "", medianDelta: percentile(deltas, 0.5), p10: percentile(deltas, 0.1), p90: percentile(deltas, 0.9), count: deltas.length }];
  }));
  return { available: pairs.length > 0 && sameVersion && sameHorizon, sourceExperimentId: previous.experiment.id, currentExperimentId: current.experiment.id, pairs: pairs.length, sameVersion, sameHorizon, metrics: sameVersion && sameHorizon ? metrics : [], reason: !sameVersion || !sameHorizon ? "Model version or horizon changed; a paired before/after effect is not reported." : pairs.length ? "Same scenario IDs and seeds paired across stored experiments. Changes can include multiple inputs; no isolated causal attribution." : "No matched scenario/seed rows; no paired effect reported." };
}

export function analyzeIntelligence(context = {}, options = {}) {
  const experiment = experimentOf(context), model = modelOf(context), runs = runsOf(context);
  const metricId = options.metricId || model.metrics?.find(row => row.id === "affordability")?.id || model.metrics?.[0]?.id;
  const classified = classifyOutcomes({ experiment, runs, model, metricId, mode: options.classificationMode || "recorded" });
  const scenarioId = options.scenarioId || context.selectedRun?.scenarioId || experiment?.scenarios?.find(row => row.kind !== "baseline")?.id || experiment?.scenarios?.[0]?.id;
  const sensitivities = descriptiveSensitivity({ runs, model, scenarioId, metricId });
  const evidence = context.evidence || experiment?.metadata?.evidence || [];
  const verify = sensitivities.map(row => ({ ...row, lowConfidence: !/^(high|verified)$/i.test(String(row.confidence)), priority: row.magnitude * (/^(high|verified)$/i.test(String(row.confidence)) ? 0.25 : 1), evidence: Array.isArray(evidence) ? evidence.filter(item => item.parameterId === row.parameterId) : [], rationale: "Heuristic verification priority from descriptive |r| × confidence flag; not statistical confidence or evidence of causation." })).sort((a, b) => b.priority - a.priority || a.parameterId.localeCompare(b.parameterId));
  return { schemaVersion: "decision-intelligence.v1", classificationMode: options.classificationMode || "recorded", experimentId: experiment?.id || null, scenarioId, metricId, classified, failureRules: mineOutcomeRules({ classified, model, target: "failure", ...options }), successPatterns: mineOutcomeRules({ classified, model, target: "success", ...options }), sensitivities, verify, comparison: compareExperiments({ current: context.results, previous: context.previousResults, model }), varianceDecomposition: { available: false, reason: "No supported balanced crossed/factorial or Sobol design is recorded. Arbitrary scenario ensembles do not identify policy/conditions/shock variance components." }, limitations: ["Rules are exploratory within-scenario associations discovered and measured on the same sample; correlated inputs and multiple testing can produce misleading patterns.", "Support, conditional outcome rate, target base rate and lift describe the chosen sampling distribution; they do not establish causal effects or predictive accuracy.", "Sensitivity bars and descriptive bins are observational summaries. Only explicitly executed matched numerical diagnostics are labeled counterfactual/partial dependence.", "One-at-a-time numerical changes are model-local interventions, can interact, and are not an additive explanation or empirical causal proof.", "Proposed fixes are bounded hypotheses requiring approval and a new matched experiment. External conditions are not automatically treated as controllable policy."] };
}

export function decisionIntelligenceProvenance({ experiment, robustnessReport } = {}) {
  const history = Array.isArray(experiment?.metadata?.worldEditHistory) ? experiment.metadata.worldEditHistory : [];
  const select = record => {
    let optimizationSource = null;
    if (record.model === "hbl-bounded-search.v1" && record.prompt?.startsWith("Optimization provenance: ")) try {
      const raw = JSON.parse(record.prompt.slice("Optimization provenance: ".length));
      const fields = ["optimizationJobId", "candidateId", "stage", "sourceScenarioId", "sourceExperimentId", "sourceInputFingerprint", "modelId", "modelVersion", "seed", "objectives", "constraints", "screenRuns", "finalistRuns"];
      optimizationSource = Object.fromEntries(fields.filter(field => raw[field] !== undefined).map(field => [field, structuredClone(raw[field])]));
    } catch { /* Preserve the actual prompt without inventing a parsed source. */ }
    return { id: record.id, parent: record.parent, model: record.model, provider: record.provider, prompt: record.prompt, approvedAt: record.approvedAt, proposalHash: record.proposalHash, operations: structuredClone(record.operations || []), optimizationSource };
  };
  const fixes = history.filter(record => record.model === "descriptive-rules.v1").map(select);
  const optimizations = history.filter(record => record.model === "hbl-bounded-search.v1").map(select);
  const forks = (experiment?.scenarios || []).filter(scenario => scenario.timelineFork || scenario.fork).map(scenario => ({ scenarioId: scenario.id, scenarioName: scenario.name, lineage: structuredClone(scenario.timelineFork || scenario.fork) }));
  const report = robustnessReport || experiment?.metadata?.robustnessReport;
  const matches = Boolean(report?.sourceFingerprint && experiment && report.sourceFingerprint === fingerprintWorldInput(experiment));
  return { fixes, optimizations, forks, selectedFutureFork: experiment?.metadata?.timelineFork ? structuredClone(experiment.metadata.timelineFork) : null, optimizationJob: experiment?.metadata?.optimization || experiment?.metadata?.optimizationJob || null, robustness: matches ? structuredClone(report) : null, robustnessNotice: report && !matches ? "A robustness report was supplied for different inputs; its scores are not attributed to this experiment." : matches ? "Attached local robustness snapshot matches this experiment's input fingerprint. It is not a new execution; inspect cell denominators, status and preview-record retention." : "No matching measured robustness matrix attached. Configured stress presets alone are not a completed robustness assessment." };
}

export function explainFuture({ run, referenceRun, registry, attribution, metricId } = {}) {
  if (!run) return { available: false, reasons: [], text: "Select a stored successful future to inspect its mechanisms." };
  const drivers = (Array.isArray(run.drivers) ? run.drivers : Object.entries(run.drivers || {}).map(([id, value]) => ({ id, value }))).filter(row => isNumeric(row.value));
  const numericAttributions = (attribution?.topFive || attribution?.contributions || attribution?.results || attribution?.effects || []).filter(row => isNumeric(row.delta) && (!metricId || !row.metricId || row.metricId === metricId));
  const reasons = numericAttributions.length ? [...numericAttributions].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5).map(row => ({ ...row, kind: "matched OAT model response" })) : drivers.slice(0, 5).map(row => ({ ...row, kind: "stored numeric mechanism; model order, not causal rank" }));
  const metricDeltas = referenceRun ? Object.entries(run.metrics || {}).flatMap(([id, value]) => isNumeric(value) && isNumeric(referenceRun.metrics?.[id]) ? [{ metricId: id, selected: value, reference: referenceRun.metrics[id], delta: value - referenceRun.metrics[id] }] : []) : [];
  return { available: true, runId: run.id, seed: run.seed, modelVersion: run.modelVersion, reasons, events: run.events || [], registryVersion: registry?.version || registry?.modelVersion || null, metricDeltas, referenceRunId: referenceRun?.id || null, text: numericAttributions.length ? "Five largest executed one-at-a-time numerical responses for the selected outcome. Effects need not add up; not empirical causal proof." : "Up to five recorded numeric model mechanisms, shown in stored model order. No causal contribution percentages or rank were inferred." };
}

export function queryFuture({ query = "", run, referenceRun, registry, attribution, metricId } = {}) {
  const explanation = explainFuture({ run, referenceRun, registry, attribution, metricId });
  if (!explanation.available) return { ...explanation, kind: "empty" };
  if (/what.*chang|compar|differ|between/i.test(query)) return { kind: "compare", explanation, text: !referenceRun ? "Select a reference future to compare actual stored values." : `Stored future ${run.id} vs ${referenceRun.id}: ${explanation.metricDeltas.slice(0, 6).map(row => `${row.metricId} ${numberText(row.selected)} vs ${numberText(row.reference)} (Δ ${numberText(row.delta)})`).join("; ")}. These are numerical differences, not causal attribution.` };
  if (/why|reason|explain|happen/i.test(query)) return { kind: "why", explanation, text: `${explanation.text} ${explanation.reasons.map(row => `${row.label || row.id || row.parameterId}: ${numberText(row.delta ?? row.value)} ${row.unit || ""}${row.description ? ` — ${row.description}` : ""}`).join("; ")}. ${explanation.events.length} stored events are available for equation-linked inspection.` };
  return { kind: "unsupported", explanation, text: "Deterministic queries supported: ‘Why did this happen?’ and ‘What changed between these futures?’. This tool does not invent a freeform AI explanation." };
}

/** Actual numeric intervention grid. Rerun is injected from the versioned model
 * pack; never regress observed bins and call that partial dependence. */
export async function runPartialDependence({ runs = [], parameterId, metricId, values = [], rerun, signal, onProgress } = {}) {
  const source = successfulRuns(runs).slice(0, 8);
  if (!source.length || typeof rerun !== "function") throw new Error("Stored successful runs and a version-resolved numerical rerun function are required.");
  if (!values.length || values.length > 7 || values.some(value => !isNumeric(value))) throw new Error("Use 1–7 finite grid values.");
  const points = []; let completed = 0;
  for (const value of values) {
    const results = [];
    for (const run of source) {
      if (signal?.aborted) throw new Error("Numerical diagnostic cancelled.");
      const output = await rerun({ run, parameterId, value, metricId });
      if (output?.recordedMismatch?.length) throw new Error("Recorded reconstruction mismatch; numerical partial dependence blocked.");
      if (run.modelVersion && output?.modelVersion && run.modelVersion !== output.modelVersion) throw new Error("Numerical rerun changed the recorded model version.");
      const metric = output?.metrics?.[metricId] ?? output?.counterfactual?.metrics?.[metricId] ?? output?.after?.metrics?.[metricId] ?? output?.changed?.metrics?.[metricId];
      if (!isNumeric(metric)) throw new Error("Numerical rerun returned no finite requested metric; no partial-dependence claim made.");
      results.push(metric); completed++; onProgress?.({ completed, total: values.length * source.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    points.push({ value, count: results.length, mean: average(results), median: percentile(results, 0.5), p10: percentile(results, 0.1), p90: percentile(results, 0.9) });
  }
  return { method: "Numerical partial dependence from executed effective-input interventions averaged over at most eight stored seed/condition rows. Other sampled inputs, version, horizon, approved projects and scheduled interventions are held by the versioned rerun helper; not an empirical causal estimate.", parameterId, metricId, points, runIds: source.map(run => run.id), seeds: source.map(run => run.seed), executions: completed };
}
