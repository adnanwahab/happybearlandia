import { summarizeOutcomes } from "./outcome-analysis.js";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mean(values) {
  const rows = values.map(finite).filter((value) => value !== null);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

function round(value, digits = 3) {
  const number = finite(value);
  if (number === null) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function familyOf(simulation) {
  const family = simulation?.world?.scenarioFamily || simulation?.effectiveWorld?.scenarioFamily || {};
  return {
    id: family.id || "unclassified",
    label: family.label || family.id || "Unclassified",
    description: family.description || "No scenario-family metadata was attached to this world.",
  };
}

function variableDefinitions(experiment, simulations = []) {
  const definitions = new Map((experiment?.worldModel?.variables || []).map((variable) => [variable.id, variable]));
  for (const simulation of simulations) {
    for (const id of Object.keys(simulation?.world?.conditions || {})) {
      if (!definitions.has(id)) definitions.set(id, { id, label: id, category: "custom" });
    }
  }
  return definitions;
}

function normalizedValue(simulation, id, variable) {
  const direct = finite(simulation?.world?.normalized?.[id]);
  if (direct !== null) return direct;
  const value = finite(simulation?.world?.conditions?.[id]);
  if (value === null) return null;
  const min = finite(variable?.range?.min) ?? 0;
  const max = finite(variable?.range?.max) ?? 1;
  return max > min ? (value - min) / (max - min) : 0.5;
}

export function compareScenarioConditions(familySimulations, allSimulations, experiment, options = {}) {
  const familyIds = new Set(familySimulations.map((simulation) => simulation.id || simulation.worldId));
  const rest = allSimulations.filter((simulation) => !familyIds.has(simulation.id || simulation.worldId));
  const definitions = variableDefinitions(experiment, allSimulations);
  const limit = Math.max(1, Math.min(30, Math.round(Number(options.limit || 8))));
  const rows = [];

  for (const [id, variable] of definitions) {
    const familyMean = mean(familySimulations.map((simulation) => normalizedValue(simulation, id, variable)));
    const restMean = mean(rest.map((simulation) => normalizedValue(simulation, id, variable)));
    if (familyMean === null || restMean === null) continue;
    const delta = familyMean - restMean;
    rows.push({
      id,
      label: variable.label || id,
      category: variable.category || "custom",
      familyMean: round(familyMean),
      restMean: round(restMean),
      delta: round(delta),
      magnitude: round(Math.abs(delta)),
      pattern: delta > 0.02 ? "higher-in-family" : delta < -0.02 ? "lower-in-family" : "similar-to-rest",
    });
  }

  return rows
    .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function aggregateCausalPathways(simulations, options = {}) {
  const limit = Math.max(1, Math.min(30, Math.round(Number(options.limit || 6))));
  const byKey = new Map();
  for (const simulation of simulations) {
    for (const pathway of simulation?.explanation?.causalPathways || []) {
      const key = pathway.id || pathway.description || `${(pathway.nodes || []).join(">")}::${pathway.target || "system"}`;
      const effect = finite(pathway.effect) ?? 0;
      const row = byKey.get(key) || {
        id: pathway.id || key,
        description: pathway.description || (pathway.nodes || []).join(" → ") || key,
        target: pathway.target || "system",
        count: 0,
        totalEffect: 0,
        totalAbsoluteEffect: 0,
      };
      row.count += 1;
      row.totalEffect += effect;
      row.totalAbsoluteEffect += Math.abs(effect);
      byKey.set(key, row);
    }
  }
  return [...byKey.values()]
    .map((row) => ({
      id: row.id,
      description: row.description,
      target: row.target,
      count: row.count,
      meanEffect: round(row.totalEffect / row.count),
      meanAbsoluteEffect: round(row.totalAbsoluteEffect / row.count),
    }))
    .sort((a, b) => (b.meanAbsoluteEffect ?? 0) - (a.meanAbsoluteEffect ?? 0) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function aggregateFeedbackLoops(simulations, options = {}) {
  const limit = Math.max(1, Math.min(20, Math.round(Number(options.limit || 6))));
  const byId = new Map();
  for (const simulation of simulations) {
    for (const loop of simulation?.explanation?.feedbackLoops || []) {
      const id = loop.id || loop.label || "feedback-loop";
      const activity = finite(loop.activity) ?? 0;
      const row = byId.get(id) || {
        id,
        label: loop.label || id,
        type: loop.type || "feedback",
        description: loop.description || "",
        count: 0,
        totalActivity: 0,
      };
      row.count += 1;
      row.totalActivity += activity;
      byId.set(id, row);
    }
  }
  return [...byId.values()]
    .map((row) => ({ ...row, meanActivity: round(row.totalActivity / row.count) }))
    .sort((a, b) => (b.meanActivity ?? 0) - (a.meanActivity ?? 0) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ totalActivity, ...row }) => row);
}

export function filterSimulationBatchByScenarioFamily(simulationBatch, familyId) {
  const simulations = Array.isArray(simulationBatch) ? simulationBatch : simulationBatch?.simulations || [];
  return {
    ...(Array.isArray(simulationBatch) ? {} : simulationBatch),
    simulations: simulations.filter((simulation) => familyOf(simulation).id === familyId),
  };
}

export function summarizeScenarioFamilies(simulationBatch, experiment, options = {}) {
  const simulations = Array.isArray(simulationBatch) ? simulationBatch : simulationBatch?.simulations || [];
  const groups = new Map();
  for (const simulation of simulations) {
    const family = familyOf(simulation);
    if (!groups.has(family.id)) groups.set(family.id, { family, simulations: [] });
    groups.get(family.id).simulations.push(simulation);
  }

  const families = [...groups.values()].map(({ family, simulations: familySimulations }) => {
    const summary = summarizeOutcomes(familySimulations);
    return {
      id: family.id,
      label: family.label,
      description: family.description,
      worlds: familySimulations.length,
      share: simulations.length ? round(familySimulations.length / simulations.length, 4) : null,
      expectedScore: summary.expectedScore,
      medianScore: summary.medianScore,
      p10Score: summary.p10Score,
      worstScore: summary.worstScore,
      robustness: summary.robustness,
      adverseRate: summary.adverseRate,
      counts: summary.counts,
      distinguishingConditions: compareScenarioConditions(familySimulations, simulations, experiment, { limit: options.driverLimit || 8 }),
      causalPathways: aggregateCausalPathways(familySimulations, { limit: options.pathLimit || 5 }),
      feedbackLoops: aggregateFeedbackLoops(familySimulations, { limit: options.loopLimit || 4 }),
    };
  });

  const ranked = [...families].sort((a, b) => {
    const robustnessA = a.robustness ?? 1;
    const robustnessB = b.robustness ?? 1;
    if (robustnessA !== robustnessB) return robustnessA - robustnessB;
    const expectedA = a.expectedScore ?? Infinity;
    const expectedB = b.expectedScore ?? Infinity;
    if (expectedA !== expectedB) return expectedA - expectedB;
    return b.worlds - a.worlds;
  });
  const strongest = [...families].sort((a, b) => {
    const robustnessA = a.robustness ?? -1;
    const robustnessB = b.robustness ?? -1;
    if (robustnessA !== robustnessB) return robustnessB - robustnessA;
    return (b.expectedScore ?? -Infinity) - (a.expectedScore ?? -Infinity);
  })[0] || null;

  return {
    schemaVersion: "scenario-family-outcomes.v1",
    totalWorlds: simulations.length,
    familyCount: families.length,
    weakestFamilyId: ranked[0]?.id || null,
    weakestFamily: ranked[0] || null,
    strongestFamilyId: strongest?.id || null,
    strongestFamily: strongest,
    families: families.sort((a, b) => (a.robustness ?? 0) - (b.robustness ?? 0) || a.label.localeCompare(b.label)),
  };
}

export function scenarioTargetingAnalysis(comparison, familyId) {
  const family = comparison?.families?.find((row) => row.id === familyId);
  if (!family) return { metric: "score", sensitivities: [], failureModes: [] };
  const sensitivities = (family.distinguishingConditions || []).map((row) => {
    // If a weak scenario family has a condition above the rest, lowering it is
    // the stress-test direction; if it is below the rest, strengthening it is.
    const correlation = -(row.delta || 0);
    return {
      id: row.id,
      label: row.label,
      category: row.category,
      metric: "score",
      correlation: round(correlation),
      absoluteCorrelation: round(Math.abs(correlation)),
      direction: correlation > 0.02 ? "higher-associated-with-better" : correlation < -0.02 ? "higher-associated-with-worse" : "weak-or-nonlinear",
      sampleSize: family.worlds,
      source: "scenario-family-contrast",
    };
  });
  const failureModes = (family.distinguishingConditions || []).map((row) => ({
    id: row.id,
    label: row.label,
    category: row.category,
    delta: row.delta,
    magnitude: row.magnitude,
    pattern: row.delta > 0 ? "higher-in-weak-scenario" : row.delta < 0 ? "lower-in-weak-scenario" : "no-separation",
    source: "scenario-family-contrast",
  }));
  return { metric: "score", sensitivities, failureModes, scenarioFamilyId: family.id, scenarioFamilyLabel: family.label };
}

export const __test = { familyOf, mean, normalizedValue, variableDefinitions, round };
