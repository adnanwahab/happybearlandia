/** OptimizationJob.v1: {input,scenarioId,levers:[{parameterId,min,max}],
 * objectives:[{metricId,direction:'minimize'|'maximize'}],
 * constraints:[{metricId,operator:'gte'|'lte',value}],candidateCount<=6,
 * finalists<=2}. Screen=100 matched runs/candidate+current; finalists=500.
 * Hard total <=3200 evaluations; all candidates use the existing runner. No
 * candidate is applied here; candidateProposal opens existing approval preview.
 * Summaries retain seed/model/full candidate inputs, statistics, failures and
 * paired comparisons. Full monthly arrays are discarded AFTER aggregation,
 * explicitly, to keep the bounded optimization job inside demo memory budgets.
 */
import { normalizeDecisionInput, clone, DecisionValidationError } from "./contracts.js";
import { executeDecisionExperiment, seededRandom } from "./kernel.js";
import { getWorldRevisionId, fingerprintWorldInput } from "../ai/edit-schema.js";
export const OPTIMIZATION_LIMITS = Object.freeze({ candidates: 6, finalists: 2, screenRuns: 100, finalistRuns: 500, maxEvaluations: 3200, maxLevers: 4, maxJobs: 30 });
export function normalizeOptimizationInput(value, model) {
  const errors = [];
  const input = normalizeDecisionInput(value?.input, model);
  const scenarioId = value.scenarioId;
  if (!input.scenarios.some((scenario) => scenario.id === scenarioId)) errors.push("Choose an existing scenario");
  const levers = value.levers;
  if (!Array.isArray(levers) || !levers.length || levers.length > 4) errors.push("Select 1–4 policy levers");
  const seen = new Set();
  for (const lever of Array.isArray(levers) ? levers : []) {
    const parameter = model.parameters.find((row) => row.id === lever?.parameterId);
    if (!parameter || !Number.isFinite(lever.min) || !Number.isFinite(lever.max) || lever.min > lever.max || lever.min < parameter.min || lever.max > parameter.max || seen.has(lever.parameterId)) errors.push("Lever ranges must be unique finite bounds inside the model schema");
    seen.add(lever?.parameterId);
  }
  const objectives = value.objectives;
  if (!Array.isArray(objectives) || !objectives.length || objectives.length > 3 || objectives.some((row) => !model.metrics.some((metric) => metric.id === row?.metricId) || !["minimize", "maximize"].includes(row.direction))) errors.push("Choose 1–3 valid objectives");
  const constraints = value.constraints || [];
  if (!Array.isArray(constraints) || constraints.length > 6 || constraints.some((row) => !model.metrics.some((metric) => metric.id === row?.metricId) || !["gte", "lte"].includes(row.operator) || !Number.isFinite(row.value))) errors.push("Constraints require metric, gte/lte and finite threshold");
  const candidateCount = value.candidateCount ?? 4, finalists = value.finalists ?? 2;
  if (!Number.isInteger(candidateCount) || candidateCount < 1 || candidateCount > 6 || !Number.isInteger(finalists) || finalists < 1 || finalists > Math.min(2, candidateCount)) errors.push("Use 1–6 candidates and 1–2 finalists");
  if (errors.length) throw new DecisionValidationError(errors);
  const scenario = input.scenarios.find((row) => row.id === scenarioId);
  const evaluations = candidateCount * 200 + finalists * 1000;
  const projectCount = (scenario.projects?.length || 0) + (scenario.timelineFork?.operations || []).filter((operation) => operation.op === "add_building").length;
  if (evaluations * Math.max(1, projectCount) * (input.years * 12 + 1) > 2000000) throw new DecisionValidationError(["Search exceeds 2000000 monthly work items; reduce candidate/finalist count, projects, or horizon before starting"]);
  return { schemaVersion: "optimization-job.v1", input, scenarioId, levers: clone(levers), objectives: clone(objectives), constraints: clone(constraints), candidateCount, finalists, screenRuns: 100, finalistRuns: 500, sourceInputFingerprint: fingerprintWorldInput(input), ...(typeof value.sourceExperimentId === "string" && /^[A-Za-z0-9_-]{1,96}$/.test(value.sourceExperimentId) ? { sourceExperimentId: value.sourceExperimentId } : {}) };
}
export function generateOptimizationCandidates(config) {
  const source = config.input.scenarios.find((scenario) => scenario.id === config.scenarioId);
  const random = seededRandom(config.input.seed);
  return Array.from({ length: config.candidateCount }, (_, index) => {
    const scenario = clone(source);
    delete scenario.inheritsFrom; delete scenario.overrides;
    scenario.id = `candidate_${index + 1}`; scenario.name = `Candidate ${index + 1}`; scenario.kind = "alternative";
    for (const lever of config.levers) {
      const fraction = index === 0 ? 0 : index === 1 ? 1 : random();
      const value = lever.min + fraction * (lever.max - lever.min);
      scenario.parameters[lever.parameterId] = value;
      scenario.uncertainty[lever.parameterId] = { type: "fixed", value };
    }
    return { id: scenario.id, name: scenario.name, scenario, stage: "pending", feasible: false, aggregates: null, comparisons: null };
  });
}
export function paretoCandidates(candidates, objectives) {
  const eligible = candidates.filter((candidate) => candidate.feasible && objectives.every((objective) => Number.isFinite(candidate.aggregates?.metrics?.[objective.metricId]?.mean)));
  return eligible.filter((a) => !eligible.some((b) => b !== a && objectives.every((objective) => objective.direction === "minimize" ? b.aggregates.metrics[objective.metricId].mean <= a.aggregates.metrics[objective.metricId].mean : b.aggregates.metrics[objective.metricId].mean >= a.aggregates.metrics[objective.metricId].mean) && objectives.some((objective) => b.aggregates.metrics[objective.metricId].mean !== a.aggregates.metrics[objective.metricId].mean))).map((candidate) => candidate.id);
}
export function optimizationCandidateProposal({ input, candidate, sourceScenarioId, job }) {
  const scenario = clone(candidate.scenario);
  scenario.id = `optimized_${crypto.randomUUID().slice(0, 8)}`; scenario.name = `${candidate.name} · optimized alternative`; scenario.kind = "alternative";
  // This JSON provenance is retained verbatim in immutable revision.prompt and
  // worldEditHistory[].prompt; analysis/brief can parse after the named prefix.
  const provenance = { optimizationJobId: job?.id || null, candidateId: candidate.id, stage: candidate.stage, sourceScenarioId, sourceExperimentId: job?.config?.sourceExperimentId || null, sourceInputFingerprint: job?.config?.sourceInputFingerprint || null, modelId: job?.config?.input?.modelId || input.modelId, modelVersion: job?.config?.input?.modelVersion || input.modelVersion, seed: job?.config?.input?.seed ?? input.seed, objectives: job?.config?.objectives || [], constraints: job?.config?.constraints || [], screenRuns: 100, finalistRuns: candidate.runs || 0 };
  return { schemaVersion: "world-edit.v1", summary: `Add ${scenario.name} as a new scenario`, scenarioId: sourceScenarioId, prompt: `Optimization provenance: ${JSON.stringify(provenance)}`, operations: [{ op: "add_scenario", target: "scenarios", value: scenario }], warnings: ["Search is bounded and exploratory; no global optimum or empirical guarantee. Constraints apply to sampled means, not every future."], requiresSimulationRerun: true, baseRevision: getWorldRevisionId(input), baseInputFingerprint: fingerprintWorldInput(input), provider: "user", model: "hbl-bounded-search.v1" };
}
export async function executeOptimizationJob({ config, model, simulateRun, simulateFork, applyStressPresets, shouldCancel = () => false, onProgress = () => {} }) {
  const candidates = generateOptimizationCandidates(config);
  const source = config.input.scenarios.find((scenario) => scenario.id === config.scenarioId);
  const total = config.candidateCount * 200 + config.finalists * 1000;
  let completed = 0, successful = 0, failed = 0;
  const started = performance.now();
  const progress = (phase, currentCandidate) => ({ completed, total, successful, failed, phase, currentCandidate, elapsedMs: Math.round(performance.now() - started) });
  const publish = (phase, currentCandidate) => onProgress({ progress: progress(phase, currentCandidate), candidates: clone(candidates), pareto: paretoCandidates(candidates, config.objectives) });
  async function evaluate(candidate, runs, stage) {
    const baseline = { ...clone(source), id: "current", name: "Current plan", kind: "baseline" }; delete baseline.inheritsFrom; delete baseline.overrides;
    const experiment = normalizeDecisionInput({ ...config.input, runs, scenarios: [baseline, { ...candidate.scenario, kind: "alternative" }] }, model, { retainTraces: false });
    const offset = completed, successOffset = successful, failOffset = failed;
    const result = await executeDecisionExperiment({ experiment, model, simulateRun, simulateFork, applyStressPresets, shouldCancel, retainTraces: false,
      onProgress: async (update) => { completed = offset + update.progress.completed; successful = successOffset + update.progress.successful; failed = failOffset + update.progress.failed; if (update.progress.completed % 40 === 0 || update.status !== "running") await publish(stage, candidate.id); } });
    if (result.status === "cancelled") return false;
    candidate.stage = stage; candidate.runs = runs;
    candidate.aggregates = result.aggregates.find((row) => row.scenarioId === candidate.id);
    candidate.currentAggregates = result.aggregates.find((row) => row.scenarioId === "current");
    candidate.comparisons = result.comparisons.find((row) => row.scenarioId === candidate.id);
    candidate.feasible = candidate.aggregates.count > 0 && config.constraints.every((constraint) => { const value = candidate.aggregates.metrics[constraint.metricId]?.mean; return Number.isFinite(value) && (constraint.operator === "gte" ? value >= constraint.value : value <= constraint.value); });
    await publish(stage, candidate.id); return true;
  }
  for (const candidate of candidates) { if (shouldCancel() || !await evaluate(candidate, 100, "screen")) break; }
  if (!shouldCancel()) {
    const front = paretoCandidates(candidates, config.objectives);
    const primary = config.objectives[0];
    const finalists = candidates.filter((candidate) => candidate.stage === "screen" && candidate.feasible).sort((a, b) => Number(front.includes(b.id)) - Number(front.includes(a.id)) || (primary.direction === "minimize" ? 1 : -1) * (a.aggregates.metrics[primary.metricId].mean - b.aggregates.metrics[primary.metricId].mean)).slice(0, config.finalists);
    for (const candidate of finalists) { if (shouldCancel() || !await evaluate(candidate, 500, "finalist")) break; }
  }
  const status = shouldCancel() ? "cancelled" : candidates.some((candidate) => candidate.aggregates?.count) ? "completed" : "failed";
  const finalProgress = progress("done"); if (status === "completed") finalProgress.total = completed;
  return { status, progress: finalProgress, plannedEvaluationBudget: total, candidates, pareto: paretoCandidates(candidates.filter((candidate) => candidate.stage === "finalist"), config.objectives), sampling: "100-run paired screen; up to two 500-run paired finalists; distributions are exploratory scenario spread; constraints apply to means", fullRunRetention: false };
}
