import { summarizeOutcomes } from "./outcome-analysis.js";
import { simulateExperiment } from "./simulation-adapter.js";

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function finite(value, fallback = null) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

export function createPlanVariantExperiment(baseExperiment, variant, index = 0) {
  const basePlan = baseExperiment?.plan || {};
  const plan = variant?.plan || variant || {};
  const id = variant?.id || plan?.id || `variant_${index + 1}`;
  return {
    ...baseExperiment,
    id: `${baseExperiment?.id || "experiment"}__${id}`,
    plan: {
      ...clone(basePlan),
      ...clone(plan),
      id,
      title: plan.title || variant?.title || basePlan.title || `Plan ${index + 1}`,
    },
    lineage: {
      ...(baseExperiment?.lineage || {}),
      parentExperimentId: baseExperiment?.id || null,
      comparisonVariantId: id,
    },
  };
}

export async function comparePlanVariants({ experiment, variants = [], worldBatch, adapter, options = {} }) {
  if (!experiment || !worldBatch || !adapter) throw new Error("comparePlanVariants requires experiment, worldBatch, and adapter");
  const normalized = variants.length ? variants : [{ id: experiment.plan?.id || "baseline", plan: experiment.plan }];
  const results = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const variant = normalized[index];
    const variantExperiment = createPlanVariantExperiment(experiment, variant, index);
    const batch = await simulateExperiment(variantExperiment, worldBatch, adapter, options);
    results.push({
      variantId: variantExperiment.plan.id,
      title: variantExperiment.plan.title,
      experiment: variantExperiment,
      simulationBatch: batch,
      summary: summarizeOutcomes(batch),
    });
  }
  const byWorld = worldBatch.worlds.map((world) => ({
    worldId: world.id,
    results: Object.fromEntries(results.map((result) => {
      const simulation = result.simulationBatch.simulations.find((row) => row.worldId === world.id);
      return [result.variantId, { score: simulation?.score ?? null, status: simulation?.status ?? null, metrics: simulation?.metrics || {} }];
    })),
  }));
  return { schemaVersion: "multi-plan-comparison.v1", experimentId: experiment.id || null, worldBatchSeed: worldBatch.seed ?? null, worldCount: worldBatch.worlds.length, variants: results, pairedWorlds: byWorld };
}

function objectiveValue(variant, objective) {
  if (objective.path === "summary.expectedScore") return finite(variant.summary?.expectedScore, -Infinity);
  if (objective.path === "summary.robustness") return finite(variant.summary?.robustness, -Infinity);
  if (objective.metric) return finite(variant.summary?.metrics?.[objective.metric]?.mean, objective.direction === "lower-is-better" ? Infinity : -Infinity);
  return finite(variant?.[objective.key], objective.direction === "lower-is-better" ? Infinity : -Infinity);
}

function dominates(a, b, objectives) {
  let strictlyBetter = false;
  for (const objective of objectives) {
    const av = objectiveValue(a, objective);
    const bv = objectiveValue(b, objective);
    if (objective.direction === "lower-is-better") {
      if (av > bv) return false;
      if (av < bv) strictlyBetter = true;
    } else {
      if (av < bv) return false;
      if (av > bv) strictlyBetter = true;
    }
  }
  return strictlyBetter;
}

export function paretoFrontier(comparison, objectives = [
  { path: "summary.expectedScore", direction: "higher-is-better" },
  { path: "summary.robustness", direction: "higher-is-better" },
]) {
  const variants = comparison?.variants || [];
  return variants.map((variant) => ({
    variantId: variant.variantId,
    title: variant.title,
    dominatedBy: variants.filter((other) => other !== variant && dominates(other, variant, objectives)).map((row) => row.variantId),
  })).map((row) => ({ ...row, paretoOptimal: row.dominatedBy.length === 0 }));
}

export function summarizePlanComparison(comparison) {
  const rows = (comparison?.variants || []).map((row) => ({
    variantId: row.variantId,
    title: row.title,
    expectedScore: row.summary?.expectedScore ?? null,
    robustness: row.summary?.robustness ?? null,
    adverseRate: row.summary?.adverseRate ?? null,
  }));
  const ranked = [...rows].sort((a, b) => (Number(b.robustness) - Number(a.robustness)) || (Number(b.expectedScore) - Number(a.expectedScore)));
  return { schemaVersion: "multi-plan-summary.v1", rows, bestByRobustness: ranked[0] || null };
}
