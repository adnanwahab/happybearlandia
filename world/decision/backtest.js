import { average, isNumeric, percentile } from "./analysis.js";

const timestamp = value => { const result = Date.parse(value); return Number.isFinite(result) ? result : null; };
export function observedPercentile(values, observed) {
  const sorted = values.filter(isNumeric);
  if (!sorted.length || !isNumeric(observed)) return null;
  return 100 * (sorted.filter(value => value < observed).length + sorted.filter(value => value === observed).length / 2) / sorted.length;
}
/** Split by both measurement date and availability date. Undated records are excluded. */
export function splitHistoricalData(observations, cutoff, targetDate) {
  const cut = timestamp(cutoff), target = timestamp(targetDate);
  if (cut === null || target === null || target <= cut) throw new Error("Target date must be after a valid historical cutoff.");
  const training = [], evaluation = [], excluded = [];
  for (const observation of observations || []) {
    const date = timestamp(observation.date), available = timestamp(observation.availableAt);
    if (date === null || available === null) { excluded.push(observation); continue; }
    if (date <= cut && available <= cut) training.push(observation);
    else if (date > cut && date <= target) evaluation.push(observation);
    else excluded.push(observation);
  }
  return { training: training.sort((a, b) => timestamp(a.date) - timestamp(b.date)), evaluation: evaluation.sort((a, b) => timestamp(a.date) - timestamp(b.date)), excluded };
}
export function scoreBacktest(simulations, observedMetrics) {
  const rows = [];
  for (const [metricId, observed] of Object.entries(observedMetrics || {})) {
    if (!isNumeric(observed)) continue;
    const values = simulations.map(run => run.metrics?.[metricId]).filter(isNumeric);
    if (!values.length) continue;
    const predictedMean = average(values), median = percentile(values, 0.5), p10 = percentile(values, 0.1), p90 = percentile(values, 0.9);
    rows.push({ metricId, observed, predictedMean, median, p10, p90, observedPercentile: observedPercentile(values, observed), signedError: predictedMean - observed, absoluteError: Math.abs(predictedMean - observed), squaredError: (predictedMean - observed) ** 2, absolutePercentageError: observed !== 0 ? 100 * Math.abs((predictedMean - observed) / observed) : null, covered80: observed >= p10 && observed <= p90, count: values.length });
  }
  // Do not average incompatible metric units into a misleading overall RMSE.
  return { metrics: rows, notice: "Errors are per metric in its own units. One holdout does not establish predictive accuracy." };
}
/** Adapter calibrate receives ONLY pre-cutoff data. Evaluation is used after simulation. */
export async function runHistoricalBacktest({ adapter, cutoff, targetDate, simulate, runs = 100, seed = 42, years, onProgress } = {}) {
  if (!adapter || typeof simulate !== "function") throw new Error("A dataset adapter and simulator are required.");
  if (!Number.isInteger(runs) || runs < 1 || runs > 1000) throw new Error("Backtest runs must be 1–1000.");
  const observations = typeof adapter.load === "function" ? await adapter.load() : adapter.observations;
  const split = splitHistoricalData(observations, cutoff, targetDate);
  if (!split.training.length) throw new Error("No dated inputs were available at the cutoff; backtest blocked to prevent leakage.");
  if (!split.evaluation.length) throw new Error("No later observations available for evaluation.");
  const calibrated = typeof adapter.calibrate === "function" ? await adapter.calibrate(structuredClone(split.training), { cutoff }) : { parameters: split.training.at(-1).parameters };
  const parameters = calibrated?.parameters || calibrated?.values || calibrated;
  if (!parameters || !Object.keys(parameters).length) throw new Error("No pre-cutoff model parameters available.");
  const startDate = calibrated?.baseDate || split.training.at(-1).date;
  const start = new Date(startDate), end = new Date(targetDate);
  const calendarYears = end.getUTCFullYear() - start.getUTCFullYear();
  const aligned = start.getUTCMonth() === end.getUTCMonth() && start.getUTCDate() === end.getUTCDate();
  const horizon = years ?? calendarYears;
  if (!isNumeric(horizon) || !Number.isInteger(horizon) || horizon <= 0 || !aligned || horizon !== calendarYears) throw new Error("Use cutoff and target dates an exact whole number of years apart; the model uses annual horizons.");
  const simulated = [], failures = [];
  for (let index = 0; index < runs; index++) {
    try { const run = await simulate({ parameters: structuredClone(parameters), seed: (seed + index) >>> 0, years: horizon }); if (!run?.metrics) throw new Error("Run has no metrics"); simulated.push(run); }
    catch (error) { failures.push(String(error?.message || error)); }
    onProgress?.({ completed: index + 1, total: runs });
    if (index % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const heldOut = split.evaluation.at(-1);
  if (heldOut.date !== targetDate) throw new Error("The latest held-out observation must match the target date; mismatched horizons cannot be scored.");
  return { schemaVersion: "decision-backtest.v1", dataset: { id: adapter.id || "user-data", label: adapter.label || "User-provided data", synthetic: adapter.synthetic !== false, source: adapter.source || "Unverified user-provided data" }, cutoff, startDate, targetDate, observedDate: heldOut.date, seed, runs, years: horizon, parameters, trainingCount: split.training.length, evaluationCount: split.evaluation.length, excludedCount: split.excluded.length, trainingDates: split.training.map(row => ({ date: row.date, availableAt: row.availableAt })), calibration: calibrated?.notes || "Latest available pre-cutoff inputs; no parameter fitting claimed.", calibrationAudit: calibrated?.audit || null, successful: simulated.length, failed: failures.length, errors: failures, ...scoreBacktest(simulated, heldOut.metrics), limitations: ["Only inputs available on or before the cutoff were passed to calibration.", adapter.synthetic !== false ? "SYNTHETIC observations demonstrate the evaluation workflow; this is not empirical validation." : "Source metadata is user supplied; verify provenance and historical revisions independently.", "Observed percentile uses an empirical midrank; small ensembles have coarse resolution.", "This evaluation does not prove future predictive accuracy."] };
}

/** Bridge the housing pack's unit/geography/vintage-checked long-form dataset adapter.
 * Historical rows are grouped without exposing held-out metrics to calibration.
 */
export async function createHousingHistoryAdapter(input, options = {}) {
  const pack = await import("../models/housing/historical.js");
  const imported = pack.importHousingHistory(input, options);
  if (!imported.valid) throw new Error(imported.errors.join(" ") || imported.warnings.join(" "));
  const geographies = new Set(imported.observations.map(row => row.geography));
  if (geographies.size !== 1) throw new Error("Select exactly one geography for the historical backtest.");
  const grouped = new Map();
  for (const row of imported.observations) {
    const key = `${row.year}:${row.availableAt}`;
    if (!grouped.has(key)) grouped.set(key, { date: `${row.year}-01-01`, availableAt: row.availableAt, metrics: {}, housingObservations: [] });
    const record = grouped.get(key); record.metrics[row.metricId] = row.value; record.housingObservations.push(row);
  }
  return { id: "housing-imported-history", label: options.label || "Imported housing history", source: options.source || "User-supplied source; verify geography, units, dollar basis, and release vintage", synthetic: options.synthetic !== false, observations: [...grouped.values()], calibrate(training, { cutoff }) {
    const rows = training.flatMap(row => row.housingObservations);
    const baseYear = Math.min(...rows.map(row => row.year));
    const initialized = pack.historicalInitialParameters(rows.filter(row => row.year === baseYear), { cutoffDate: cutoff, geography: [...geographies][0] });
    if (!initialized.valid) throw new Error(initialized.errors.join(" ") || "No usable historical initial state.");
    const latestYear = Math.max(...rows.map(row => row.year));
    const fitted = latestYear > baseYear ? pack.calibrateHousingModel({ observations: rows, parameters: initialized.parameters, baseYear, cutoffDate: cutoff, years: latestYear - baseYear }) : { parameters: initialized.parameters, calibrated: false, candidates: [] };
    return { parameters: fitted.parameters, baseDate: `${baseYear}-01-01`, notes: `${fitted.calibrated ? "rent_response fitted by grid search using pre-cutoff observations only." : "Historical initialization only; no pre-cutoff follow-up observations for coefficient fitting."} ${initialized.warnings.join(" ")} User-supplied provenance remains unverified.`, audit: { method: fitted.method || "initialization", candidates: fitted.candidates, warnings: fitted.warnings || [] } };
  } };
}

/** Normalize the model pack's source-backed Houston diagnostic for the trust UI.
 * The housing pack owns observations, provenance, actual runs and limitations.
 */
export async function runPublishedHousingDiagnostic({ runs = 100, seed = 42 } = {}) {
  const { createHoustonHistoricalDiagnostic } = await import("../models/housing/houston-history.js");
  const result = createHoustonHistoricalDiagnostic({ runs, seed });
  const observed = result.observations.find(row => row.year === result.baseYear + result.years && row.metricId === "housing_supply");
  const sources = result.sources.map((source, index) => {
    const year = result.baseYear + index;
    return { ...source, year, title: source.name, housing_supply: result.observations.find(row => row.year === year && row.metricId === "housing_supply")?.value, occupied: result.observations.find(row => row.year === year && row.metricId === "initial_households")?.value, availableAt: result.observations.find(row => row.year === year)?.availableAt };
  });
  return { schemaVersion: "decision-published-diagnostic.v1", diagnostic: true,
    dataset: { id: result.id, label: result.name, synthetic: false, source: "City of Houston Planning & Development · ACS five-year survey estimates" },
    sources, cutoff: result.cutoffDate, startDate: `${result.baseYear}-01-01`, targetDate: `${observed.year}-01-01`, observedDate: `${observed.year}-01-01`,
    years: result.years, seed, runs, runSeeds: result.runs.map(run => run.seed), modelVersion: result.runs[0]?.modelVersion,
    parameters: result.parameters, sourceBackedParameters: result.sourceBackedParameters, syntheticParameters: result.syntheticParameters,
    trainingCount: 1, successful: result.runs.length, failed: 0, errors: [], calibration: result.summary,
    ...scoreBacktest(result.runs, { housing_supply: observed.value }), limitations: result.limitations };
}
