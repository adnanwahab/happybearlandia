function finite(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mean(values) {
  const rows = values.map(finite).filter((value) => value !== null);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

function pearson(xs, ys) {
  const pairs = xs.map((x, index) => [finite(x), finite(ys[index])]).filter(([x, y]) => x !== null && y !== null);
  if (pairs.length < 3) return 0;
  const mx = mean(pairs.map(([x]) => x));
  const my = mean(pairs.map(([, y]) => y));
  let numerator = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx;
    const dy = y - my;
    numerator += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denominator = Math.sqrt(dx2 * dy2);
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function round(value, digits = 3) {
  const number = finite(value);
  if (number === null) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function outputValue(simulation, metric) {
  if (!metric || metric === "score") return finite(simulation?.score);
  return finite(simulation?.metrics?.[metric]);
}

function variableDefinitions(experiment, simulations) {
  const definitions = new Map((experiment?.worldModel?.variables || []).map((variable) => [variable.id, variable]));
  for (const simulation of simulations) {
    for (const id of Object.keys(simulation?.world?.conditions || {})) {
      if (!definitions.has(id)) definitions.set(id, { id, label: id, category: "custom", range: { min: 0, max: 1 } });
    }
  }
  return definitions;
}

export function computeSensitivities(simulationBatch, experiment, options = {}) {
  const simulations = Array.isArray(simulationBatch) ? simulationBatch : simulationBatch?.simulations || [];
  const metric = options.metric || "score";
  const outputs = simulations.map((simulation) => outputValue(simulation, metric));
  const definitions = variableDefinitions(experiment, simulations);
  const sensitivities = [];

  for (const [id, variable] of definitions) {
    const inputs = simulations.map((simulation) => simulation?.world?.conditions?.[id]);
    const correlation = pearson(inputs, outputs);
    sensitivities.push({
      id,
      label: variable.label || id,
      category: variable.category || "custom",
      metric,
      correlation: round(correlation),
      absoluteCorrelation: round(Math.abs(correlation)),
      direction: correlation > 0.05 ? "higher-associated-with-better" : correlation < -0.05 ? "higher-associated-with-worse" : "weak-or-nonlinear",
      sampleSize: inputs.filter((value, index) => finite(value) !== null && outputs[index] !== null).length,
    });
  }

  return sensitivities.sort((a, b) => b.absoluteCorrelation - a.absoluteCorrelation || a.id.localeCompare(b.id));
}

function normalizedCondition(simulation, id, variable) {
  const direct = finite(simulation?.world?.normalized?.[id]);
  if (direct !== null) return direct;
  const value = finite(simulation?.world?.conditions?.[id]);
  if (value === null) return null;
  const min = finite(variable?.range?.min) ?? 0;
  const max = finite(variable?.range?.max) ?? 1;
  return max > min ? (value - min) / (max - min) : 0.5;
}

export function computeFailureModes(simulationBatch, experiment, options = {}) {
  const simulations = Array.isArray(simulationBatch) ? simulationBatch : simulationBatch?.simulations || [];
  const negative = simulations.filter((simulation) => simulation.status === "negative");
  const positive = simulations.filter((simulation) => simulation.status === "positive");
  const definitions = variableDefinitions(experiment, simulations);
  const minimumGroup = Math.max(1, Math.round(Number(options.minimumGroup || 2)));
  if (negative.length < minimumGroup || positive.length < minimumGroup) return [];

  const rows = [];
  for (const [id, variable] of definitions) {
    const negativeMean = mean(negative.map((simulation) => normalizedCondition(simulation, id, variable)));
    const positiveMean = mean(positive.map((simulation) => normalizedCondition(simulation, id, variable)));
    if (negativeMean === null || positiveMean === null) continue;
    const delta = negativeMean - positiveMean;
    rows.push({
      id,
      label: variable.label || id,
      category: variable.category || "custom",
      negativeMean: round(negativeMean),
      positiveMean: round(positiveMean),
      delta: round(delta),
      magnitude: round(Math.abs(delta)),
      pattern: delta > 0 ? "higher-in-failures" : delta < 0 ? "lower-in-failures" : "no-separation",
    });
  }
  return rows.sort((a, b) => b.magnitude - a.magnitude || a.id.localeCompare(b.id));
}

export function analyzeSensitivity(simulationBatch, experiment, options = {}) {
  return {
    metric: options.metric || "score",
    sensitivities: computeSensitivities(simulationBatch, experiment, options),
    failureModes: computeFailureModes(simulationBatch, experiment, options),
  };
}

export const __test = { mean, pearson, outputValue, normalizedCondition };
