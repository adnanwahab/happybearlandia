function finiteNumbers(values) {
  return values.map(Number).filter(Number.isFinite);
}

function mean(values) {
  const rows = finiteNumbers(values);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

function quantile(values, q) {
  const rows = finiteNumbers(values).sort((a, b) => a - b);
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const position = Math.max(0, Math.min(1, q)) * (rows.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return rows[lower] * (1 - weight) + rows[upper] * weight;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function metricKeys(simulations) {
  const keys = new Set();
  for (const simulation of simulations) {
    for (const [key, value] of Object.entries(simulation?.metrics || {})) {
      if (Number.isFinite(Number(value))) keys.add(key);
    }
  }
  return [...keys].sort();
}

export function summarizeOutcomes(simulationBatch) {
  const simulations = Array.isArray(simulationBatch) ? simulationBatch : simulationBatch?.simulations || [];
  const scores = simulations.map((row) => row.score);
  const counts = { positive: 0, mixed: 0, negative: 0, unknown: 0 };
  for (const simulation of simulations) {
    const status = Object.prototype.hasOwnProperty.call(counts, simulation.status) ? simulation.status : "unknown";
    counts[status] += 1;
  }

  const metrics = {};
  for (const key of metricKeys(simulations)) {
    const values = simulations.map((row) => row.metrics?.[key]);
    metrics[key] = {
      mean: round(mean(values)),
      p10: round(quantile(values, 0.10)),
      median: round(quantile(values, 0.50)),
      p90: round(quantile(values, 0.90)),
      min: round(quantile(values, 0)),
      max: round(quantile(values, 1)),
    };
  }

  const total = simulations.length;
  const tailCount = total ? Math.max(1, Math.ceil(total * 0.05)) : 0;
  const worst = [...simulations]
    .sort((a, b) => Number(a.score ?? Infinity) - Number(b.score ?? Infinity))
    .slice(0, tailCount)
    .map((row) => ({ worldId: row.worldId, score: round(Number(row.score)), status: row.status, metrics: row.metrics }));

  return {
    total,
    counts,
    expectedScore: round(mean(scores)),
    medianScore: round(quantile(scores, 0.5)),
    p10Score: round(quantile(scores, 0.1)),
    p90Score: round(quantile(scores, 0.9)),
    worstScore: round(quantile(scores, 0)),
    bestScore: round(quantile(scores, 1)),
    robustness: total ? round(counts.positive / total, 4) : null,
    adverseRate: total ? round(counts.negative / total, 4) : null,
    metrics,
    tailRisks: worst,
  };
}

export function attachOutcomeAnalysis(experiment, simulationBatch) {
  const summary = summarizeOutcomes(simulationBatch);
  const simulations = Array.isArray(simulationBatch) ? simulationBatch : simulationBatch?.simulations || [];
  return {
    ...experiment,
    outcomes: {
      ...(experiment?.outcomes || {}),
      worlds: simulations,
      summary,
      metrics: Object.keys(summary.metrics),
    },
    analysis: {
      ...(experiment?.analysis || {}),
      robustness: summary.robustness,
      tailRisks: summary.tailRisks,
      expectedScore: summary.expectedScore,
      adverseRate: summary.adverseRate,
      adapter: simulationBatch?.adapter || null,
    },
  };
}

export const __test = { mean, quantile, metricKeys, round };
