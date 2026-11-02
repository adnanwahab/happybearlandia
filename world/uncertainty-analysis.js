import { computeSensitivities } from "./sensitivity-analysis.js";

const ALEATORY_IDS = new Set([
  "economic_growth", "population_growth", "migration_rate", "inflation_rate", "interest_rate",
  "political_turnover_probability", "external_shock_probability", "major_disruption_probability",
  "climate_stress", "media_sentiment",
]);

function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function classifyVariableUncertainty(variable) {
  if (variable?.uncertainty?.kind) return variable.uncertainty;
  const provenance = variable?.provenance?.type || variable?.source;
  const kind = ALEATORY_IDS.has(variable?.id) || variable?.category === "shocks" ? "aleatory" : "epistemic";
  const confidence = clamp01(variable?.provenance?.confidence ?? variable?.confidence, provenance === "observed" ? 0.85 : 0.5);
  return {
    kind,
    confidence,
    rationale: kind === "aleatory"
      ? "Modeled primarily as real-world variation between futures."
      : "Modeled primarily as uncertainty about the correct parameter/value or relationship.",
  };
}

export function attachUncertaintyMetadata(experiment) {
  const variables = (experiment?.worldModel?.variables || []).map((variable) => ({ ...variable, uncertainty: classifyVariableUncertainty(variable) }));
  return {
    ...experiment,
    uncertainty: {
      schemaVersion: "hbl-uncertainty.v1",
      note: "Aleatory uncertainty represents modeled variation; epistemic uncertainty represents limited knowledge. Classification is itself a modeling judgment.",
    },
    worldModel: { ...experiment.worldModel, variables },
  };
}

export function decomposeOutcomeUncertainty(simulationBatch, experiment) {
  const simulations = simulationBatch?.simulations || simulationBatch || [];
  const enriched = attachUncertaintyMetadata(experiment);
  const sensitivities = computeSensitivities(simulations, enriched);
  const byId = new Map((enriched.worldModel?.variables || []).map((row) => [row.id, row]));
  const rows = sensitivities.map((row) => {
    const variable = byId.get(row.id) || {};
    const uncertainty = variable.uncertainty || classifyVariableUncertainty(variable);
    const strength = Math.abs(Number(row.correlation || 0));
    const rawShare = strength * strength;
    return {
      ...row,
      kind: uncertainty.kind,
      confidence: uncertainty.confidence,
      rawShare,
      researchValue: uncertainty.kind === "epistemic" ? rawShare * (1 - uncertainty.confidence) : 0,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.rawShare, 0) || 1;
  for (const row of rows) row.share = row.rawShare / total;
  const totals = rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] || 0) + row.share;
    return acc;
  }, { aleatory: 0, epistemic: 0 });
  return {
    schemaVersion: "outcome-uncertainty.v1",
    totals,
    variables: rows.sort((a, b) => b.share - a.share),
    researchPriorities: rows.filter((row) => row.kind === "epistemic").sort((a, b) => b.researchValue - a.researchValue),
    method: "squared-rank-correlation-screening",
    disclaimer: "Screening decomposition is diagnostic, not a full Sobol variance decomposition and not a causal attribution.",
  };
}

export function topResearchQuestion(decomposition) {
  const row = decomposition?.researchPriorities?.[0];
  if (!row) return null;
  return {
    variableId: row.id,
    label: row.label || row.id,
    estimatedUncertaintyShare: row.share,
    researchValue: row.researchValue,
    message: `Reducing uncertainty about ${row.label || row.id} is the highest-ranked modeled research priority in this experiment.`,
  };
}
