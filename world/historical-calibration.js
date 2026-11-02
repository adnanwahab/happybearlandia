function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function finite(value, fallback = null) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

export function normalizeHistoricalDataset(dataset = {}) {
  const cases = Array.isArray(dataset.cases) ? dataset.cases : [];
  return {
    schemaVersion: "hbl-historical-dataset.v1",
    id: dataset.id || "historical_dataset",
    title: dataset.title || dataset.id || "Historical calibration dataset",
    geography: dataset.geography || "unspecified",
    period: dataset.period || null,
    cases: cases.map((row, index) => ({
      id: row.id || `case_${index + 1}`,
      inputs: row.inputs || row.world || {},
      observed: row.observed || row.targets || {},
      weight: Math.max(0, finite(row.weight, 1)),
      metadata: row.metadata || {},
    })),
  };
}

function setParameterBaseline(experiment, parameterId, value) {
  const next = clone(experiment);
  const variable = next.worldModel?.variables?.find((row) => row.id === parameterId);
  if (!variable) throw new Error(`Calibration parameter not found: ${parameterId}`);
  const min = finite(variable.range?.min, value);
  const max = finite(variable.range?.max, value);
  variable.baseline = Math.max(min, Math.min(max, value));
  if (variable.distribution?.type === "triangular") variable.distribution.mode = variable.baseline;
  return next;
}

function metricError(predicted, observed, metricId) {
  const p = finite(predicted?.[metricId]);
  const o = finite(observed?.[metricId]);
  if (p == null || o == null) return null;
  const scale = Math.max(1e-9, Math.abs(o));
  const delta = (p - o) / scale;
  return delta * delta;
}

export async function evaluateHistoricalFit(experiment, dataset, options = {}) {
  const normalized = normalizeHistoricalDataset(dataset);
  const metrics = options.metrics || [...new Set(normalized.cases.flatMap((row) => Object.keys(row.observed || {})))];
  if (typeof options.simulateCase !== "function") throw new Error("evaluateHistoricalFit requires simulateCase");
  let weightedError = 0;
  let totalWeight = 0;
  const cases = [];
  for (const row of normalized.cases) {
    const predicted = await options.simulateCase({ experiment, historicalCase: row });
    const errors = metrics.map((metricId) => metricError(predicted?.metrics || predicted, row.observed, metricId)).filter(Number.isFinite);
    const error = errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null;
    if (error != null) {
      weightedError += error * row.weight;
      totalWeight += row.weight;
    }
    cases.push({ id: row.id, predicted: predicted?.metrics || predicted || {}, observed: row.observed, error });
  }
  return { error: totalWeight ? weightedError / totalWeight : Infinity, cases, metrics };
}

function candidateGrid(variable, points = 9) {
  const min = finite(variable.range?.min, variable.baseline);
  const max = finite(variable.range?.max, variable.baseline);
  if (max <= min) return [finite(variable.baseline, min)];
  return Array.from({ length: Math.max(3, points) }, (_, index) => min + (index / (Math.max(3, points) - 1)) * (max - min));
}

export async function calibrateParameters({ experiment, dataset, parameterIds = [], simulateCase, metrics, passes = 2, gridPoints = 9 }) {
  let fitted = clone(experiment);
  const baselineFit = await evaluateHistoricalFit(fitted, dataset, { simulateCase, metrics });
  const parameterResults = [];

  for (let pass = 0; pass < Math.max(1, passes); pass += 1) {
    for (const parameterId of parameterIds) {
      const variable = fitted.worldModel?.variables?.find((row) => row.id === parameterId);
      if (!variable) continue;
      const before = finite(variable.baseline, 0);
      const trials = [];
      for (const value of candidateGrid(variable, gridPoints)) {
        const trialExperiment = setParameterBaseline(fitted, parameterId, value);
        const fit = await evaluateHistoricalFit(trialExperiment, dataset, { simulateCase, metrics });
        trials.push({ value, error: fit.error });
      }
      trials.sort((a, b) => a.error - b.error);
      const best = trials[0];
      fitted = setParameterBaseline(fitted, parameterId, best.value);
      if (pass === Math.max(1, passes) - 1) {
        const threshold = best.error * 1.25 + 1e-9;
        const plausible = trials.filter((row) => row.error <= threshold).map((row) => row.value);
        parameterResults.push({
          parameterId,
          before,
          fitted: best.value,
          confidenceInterval: plausible.length ? [Math.min(...plausible), Math.max(...plausible)] : [best.value, best.value],
          objective: best.error,
          trials,
        });
      }
    }
  }

  const fittedFit = await evaluateHistoricalFit(fitted, dataset, { simulateCase, metrics });
  return {
    schemaVersion: "hbl-calibration-result.v1",
    dataset: normalizeHistoricalDataset(dataset),
    parameters: parameterResults,
    baselineError: baselineFit.error,
    fittedError: fittedFit.error,
    fitImprovement: Number.isFinite(baselineFit.error) && baselineFit.error > 0 ? (baselineFit.error - fittedFit.error) / baselineFit.error : 0,
    fittedExperiment: applyCalibrationToExperiment(fitted, parameterResults, dataset),
    disclaimer: "Historical fit improves reproduction of supplied observations; it does not prove the fitted relationships are causal or guarantee out-of-sample accuracy.",
  };
}

export function applyCalibrationToExperiment(experiment, parameterResults = [], dataset = {}) {
  const byId = new Map(parameterResults.map((row) => [row.parameterId, row]));
  return {
    ...experiment,
    worldModel: {
      ...experiment.worldModel,
      variables: (experiment.worldModel?.variables || []).map((variable) => {
        const result = byId.get(variable.id);
        if (!result) return variable;
        return {
          ...variable,
          baseline: result.fitted,
          calibration: {
            status: "calibrated",
            method: "historical-grid-coordinate-descent",
            datasetId: dataset.id || null,
            fittedValue: result.fitted,
            confidenceInterval: result.confidenceInterval,
            objective: result.objective,
          },
        };
      }),
    },
  };
}
