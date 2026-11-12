import { buildUncertaintyExplorer } from './uncertainty-explorer.js';
import { buildReproducibilityManifest } from "./reproducibility.js";
import { decomposeOutcomeUncertainty, topResearchQuestion } from "./uncertainty-analysis.js";

function asArray(value) { return Array.isArray(value) ? value : []; }
function isFiniteTree(value, path = "root", errors = []) {
  if (typeof value === "number" && !Number.isFinite(value)) errors.push(`${path} is not finite`);
  else if (Array.isArray(value)) value.forEach((row, index) => isFiniteTree(row, `${path}[${index}]`, errors));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, row]) => isFiniteTree(row, `${path}.${key}`, errors));
  return errors;
}

export function auditExperiment(recordOrSnapshot = {}) {
  const record = recordOrSnapshot.snapshot || recordOrSnapshot;
  const experiment = record.experiment || record;
  const simulations = asArray(record.simulationBatch?.simulations);
  const variables = asArray(experiment?.worldModel?.variables);
  const edges = asArray(experiment?.worldModel?.causalEdges);
  const errors = [];
  const warnings = [];

  if (experiment?.schemaVersion !== "civic-experiment.v1") errors.push("Experiment schema is not civic-experiment.v1");
  if (!experiment?.plan?.id) errors.push("Plan id is missing");
  for (const variable of variables) {
    if (!variable.id) errors.push("A variable is missing id");
    if (!variable.unit) warnings.push(`Variable ${variable.id || "unknown"} has no unit`);
    if (!variable.provenance) warnings.push(`Variable ${variable.id || "unknown"} has no provenance metadata`);
  }
  errors.push(...isFiniteTree(simulations, "simulationBatch.simulations"));
  const lowConfidenceEdges = edges.filter((row) => Number(row.provenance?.confidence ?? 0.35) < 0.4);
  if (lowConfidenceEdges.length) warnings.push(`${lowConfidenceEdges.length} causal edges have low provenance confidence`);
  const heuristicVariables = variables.filter((row) => (row.provenance?.type || "heuristic") === "heuristic");
  if (heuristicVariables.length) warnings.push(`${heuristicVariables.length} variables are heuristic assumptions`);
  const calibrated = variables.filter((row) => row.calibration?.status === "calibrated");
  const reproducibility = record.reproducibility || buildReproducibilityManifest(record);
  if (!reproducibility.manifestHash) errors.push("Reproducibility manifest hash is missing");
  if (record.worldBatch && !reproducibility.worldsHash) errors.push("World batch hash is missing");
  if (record.simulationBatch && !reproducibility.resultsHash) errors.push("Simulation result hash is missing");

  let confidenceClass = "exploratory";
  if (record.validation?.outOfSample?.passed) confidenceClass = "historically-validated";
  else if (calibrated.length) confidenceClass = "partially-calibrated";

  return {
    schemaVersion: "hbl-experiment-audit.v1",
    ok: errors.length === 0,
    errors,
    warnings,
    confidenceClass,
    counts: {
      variables: variables.length,
      heuristicVariables: heuristicVariables.length,
      calibratedVariables: calibrated.length,
      causalEdges: edges.length,
      lowConfidenceEdges: lowConfidenceEdges.length,
      simulations: simulations.length,
    },
    reproducibility,
    disclaimer: "Audit health measures traceability and internal consistency. It is not evidence that the model is correct or that simulated outcomes will occur.",
  };
}

export function buildExperimentBundle(recordOrSnapshot = {}) {
  const record = recordOrSnapshot.snapshot || recordOrSnapshot;
  const audit = auditExperiment(record);
  const uncertainty = record.simulationBatch && record.experiment ? decomposeOutcomeUncertainty(record.simulationBatch, record.experiment) : null;
  return {
    schemaVersion: "hbl-experiment-bundle.v1",
    exportedAt: new Date().toISOString(),
    audit,
    reproducibility: audit.reproducibility,
    model: record.experiment?.model || null,
    uncertainty: record.simulationBatch ? buildUncertaintyExplorer(record.simulationBatch, record.experiment) : null,
    researchPriority: uncertainty ? topResearchQuestion(uncertainty) : null,
    snapshot: record,
  };
}

export function serializeExperimentBundle(bundle) {
  if (bundle?.schemaVersion !== "hbl-experiment-bundle.v1") throw new Error("Invalid HBL experiment bundle");
  return JSON.stringify(bundle, null, 2);
}

export function shareExperimentViewModel(recordOrSnapshot = {}) {
  const record = recordOrSnapshot.snapshot || recordOrSnapshot;
  const experiment = record.experiment || {};
  const summary = record.analyzedExperiment?.outcomes?.summary || record.outcomeSummary || {};
  const scenario = record.scenarioComparison || {};
  const audit = auditExperiment(record);
  const uncertainty = record.simulationBatch && experiment?.worldModel ? decomposeOutcomeUncertainty(record.simulationBatch, experiment) : null;
  const priority = uncertainty ? topResearchQuestion(uncertainty) : null;
  return {
    title: experiment.plan?.title || "Civic experiment",
    experimentId: experiment.id || null,
    runs: record.worldBatch?.runs || record.simulationBatch?.simulations?.length || 0,
    robustness: summary.robustness ?? experiment.analysis?.robustness ?? null,
    expectedScore: summary.expectedScore ?? experiment.analysis?.expectedScore ?? null,
    weakestScenario: scenario.weakestFamily?.label || scenario.weakestFamilyId || null,
    mostUncertainAssumption: priority?.label || null,
    confidenceClass: audit.confidenceClass,
    warnings: audit.warnings,
    reproducibility: audit.reproducibility,
  };
}
