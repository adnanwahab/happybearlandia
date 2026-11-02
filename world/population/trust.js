import { populationParameters, populationConfigSchema, POPULATION_VERSION, validatePopulationConfig } from "./contracts.js";
import { BEHAVIOR_COEFFICIENTS } from "../behavior/coefficients/registry.js";

export const finiteNumber = value => typeof value === "number" && Number.isFinite(value);
export function behaviorRangeWarnings(config = {}, calibratedRanges = null) {
  const warnings = [];
  for (const parameter of populationParameters) {
    const value = config[parameter.id]; if (value === undefined) continue;
    if (!finiteNumber(value) || value < parameter.min || value > parameter.max) warnings.push({ parameterId: parameter.id, kind: "engineering-invalid", value, min: parameter.min, max: parameter.max, message: `${parameter.label} is outside the implemented engineering range ${parameter.min}–${parameter.max} ${parameter.unit}. This is not a calibrated validity range.` });
    const calibrated = calibratedRanges?.[parameter.id];
    if (calibrated && finiteNumber(value) && (value < calibrated.min || value > calibrated.max)) warnings.push({ parameterId: parameter.id, kind: "outside-supplied-calibration-range", value, min: calibrated.min, max: calibrated.max, message: "Outside the user-supplied calibration range; provenance must be reviewed. No empirical calibration is inferred from its presence." });
  }
  if (!calibratedRanges || !Object.keys(calibratedRanges).length) warnings.push({ kind: "calibration-unavailable", message: "No empirically established behavioral calibration ranges are supplied. In-range engineering inputs remain exploratory; no calibrated OOD guarantee is claimed." });
  return warnings;
}

export function validatePopulationTargets(snapshot = {}, tolerances = {}) {
  const validation = snapshot.validation || {}, actual = validation.actual || {}, targets = validation.targets || snapshot.config?.targets || {};
  const defaults = { population: { absolute: 0 }, householdSize: { absolute: 0.05 }, medianIncome: { relative: 0.001 }, employmentRate: { absolute: 0.05 } };
  const checks = ["population", "householdSize", "medianIncome", "employmentRate"].map(id => {
    const value = actual[id], target = targets[id], tolerance = tolerances[id] || defaults[id];
    if (!finiteNumber(value) || !finiteNumber(target)) return { id, status: "unavailable", actual: value ?? null, target: target ?? null, signedError: null, absoluteError: null, relativeError: null };
    const error = value - target, relativeError = target !== 0 ? error / target : null;
    const passed = tolerance.absolute !== undefined ? Math.abs(error) <= tolerance.absolute : relativeError !== null && Math.abs(relativeError) <= tolerance.relative;
    return { id, status: passed ? "within-tolerance" : "outside-tolerance", actual: value, target, signedError: error, absoluteError: Math.abs(error), relativeError, tolerance: structuredClone(tolerance) };
  });
  return { checks, available: checks.some(check => check.status !== "unavailable"), passed: checks.every(check => check.status === "within-tolerance"), source: validation.source || snapshot.provenance || null, notes: [...(validation.notes || []), "These checks compare synthetic generation with explicit targets. Default tolerances are engineering review thresholds, not empirical calibration or statistical confidence intervals.", "Income refers to household annual income; employment rate refers to eligible adults. Different denominators must not be mixed."] };
}

export function buildBehaviorModelCard(snapshot = {}) {
  return { schemaVersion: "behavior-model-card.v1", modelVersion: snapshot.modelVersion || POPULATION_VERSION, label: "Exploratory synthetic population behavior", synthetic: true, empiricallyCalibrated: false, inputProvenance: structuredClone(snapshot.provenance || {}), configValidation: validatePopulationConfig(snapshot.config || {}), coefficients: Object.values(BEHAVIOR_COEFFICIENTS).map(record => structuredClone(record)), activeCoefficientReferences: structuredClone(snapshot.coefficientModels || snapshot.provenance?.coefficients || []), engineeringParameters: structuredClone(populationParameters), calibratedRanges: null, boundary: "Bounded synthetic persons/households and district-level housing, jobs and mobility. Coordinates can come from the map; default demographics, preferences, capacities and behavioral coefficients are assumptions.", behaviors: [
    { id: "activity", decision: "Daily activity and destination", inputs: "Clock, age/employment, district availability and deterministic seed streams", source: "world/population/behavior.js", limitation: "Simplified schedules and district destinations; not an empirically validated activity diary or microscopic route network." },
    { id: "mode-choice", decision: "Feasible travel mode", inputs: "Mode availability, modeled time/cost/reliability, access and stored preference/memory where implemented", source: "world/population/behavior.js", limitation: "Inspect recorded alternatives and constraints. A low-cost mode is not necessarily available; illustrative coefficients and district congestion do not establish observed elasticities." },
    { id: "housing-choice", decision: "Stay/search/move or modeled displacement risk", inputs: "Income, rent burden, savings, vacancies, commute, services, moving cost and utility threshold", source: "world/population/behavior.js", limitation: "District household-capacity matching, not real parcels/leases. A model risk state is not an observed displaced household." },
    { id: "employment-economy", decision: "Employment and business viability", inputs: "District job capacity, wage assumptions, events and household/customer demand", source: "world/population/model.js and local-economy model", limitation: "A simplified modeled economy, not a calibrated labor market or business forecast. No protected personal characteristics are inferred." },
  ], limitations: [...populationConfigSchema.limitations, "Registry values are labeled analyst assumptions. A registry entry alone does not prove that a particular runtime equation used it; inspect the active snapshot's coefficient references and decision components.", "Visible-agent frames are bounded samples for rendering. Cohort and population statistics must come from authoritative full-state aggregates, never extrapolated from the visible set.", "No independent worker-sharding or 100,000-agent interactive performance claim follows from a configured population limit.", "Selected trace buffers are bounded and may omit older decisions. A missing record is not evidence that a behavior did not occur.", "Historical fit and target matching do not demonstrate policy causality or predictive validity."] };
}

const districtRows = snapshot => Array.isArray(snapshot?.districts) ? snapshot.districts : Object.entries(snapshot?.districts || {}).map(([id, row]) => ({ id, ...row }));
export function scoreObservedPopulation(snapshot, dataset) {
  if (!snapshot || !dataset) return { available: false, rows: [], metrics: [], warnings: ["Supply an actual model snapshot and validated observed dataset."] };
  const districts = new Map(districtRows(snapshot).map(row => [String(row.id ?? row.districtId), row])), rows = [], warnings = [];
  const metrics = snapshot.metrics || {}, elapsedDays = finiteNumber(snapshot.minute) ? snapshot.minute / 1440 : null;
  const add = (districtId, metricId, observed, simulated, unit, note, comparable = true) => {
    const valid = finiteNumber(observed) && finiteNumber(simulated) && comparable;
    rows.push({ districtId, metricId, observed, simulated: finiteNumber(simulated) ? simulated : null, unit, comparable: valid, signedError: valid ? simulated - observed : null, absoluteError: valid ? Math.abs(simulated - observed) : null, squaredError: valid ? (simulated - observed) ** 2 : null, absolutePercentageError: valid && observed !== 0 ? Math.abs((simulated - observed) / observed) * 100 : null, note });
  };
  for (const observed of dataset.rows || []) {
    const global = observed.districtId === "__all__", district = global ? metrics : districts.get(observed.districtId);
    if (!district) { warnings.push(`No model geography for ${observed.districtId}; no value was imputed.`); continue; }
    if (dataset.kind === "population") add(observed.districtId, "population", observed.population, district.representedPopulation ?? district.population, "people", "Compare only if source and model district definitions and population weights are compatible; coordinate overlap alone does not establish that.");
    if (dataset.kind === "employment") add(observed.districtId, "jobs", observed.jobs, district.jobs, "jobs", "Modeled district job capacity, not automatically observed jobs or employed residents.");
    if (dataset.kind === "observed_mobility") {
      const shares = global ? snapshot.tripModeShares : district.tripModeShares;
      add(observed.districtId, `modeShare:${observed.mode}`, observed.share, shares?.[observed.mode], "fraction", "Compare the same trip/person denominator and time window. Missing district-mode output is unavailable; no city share is copied into a district.");
      if (observed.meanMinutes !== undefined) add(observed.districtId, `tripMinutes:${observed.mode}`, observed.meanMinutes, district.modeMeanMinutes?.[observed.mode], "minutes/trip", "Mode-specific trip time is scored only when the model supplies that exact statistic; overall commute time is not substituted.");
    }
    if (dataset.kind === "observed_moves") {
      const sameWindow = elapsedDays !== null && Math.abs(elapsedDays - observed.periodDays) < 1e-6;
      add(observed.districtId, "moveRate", observed.moveRate, district.moveRate, "fraction/period", sameWindow ? "Cumulative model moves and supplied observation use the same period length; verify move-event vs unique-household denominator." : `Period mismatch: modeled elapsed ${elapsedDays ?? "unknown"} days, observed ${observed.periodDays}. No annualizing or rescaling performed.`, sameWindow);
      if (observed.displacementRate !== undefined) add(observed.districtId, "displacementRate", observed.displacementRate, district.displacementRate, "fraction/period", "Model displacement definition must match the observation; same period required.", sameWindow);
    }
  }
  if (["od", "transit"].includes(dataset.kind)) warnings.push("This dataset is validated for geography/units/coverage, but no compatible OD-flow or transit-schedule observation statistic is supplied by this scorecard. No routing/calibration effect is claimed.");
  const summaries = [...new Set(rows.filter(row => row.comparable).map(row => row.metricId))].map(metricId => { const values = rows.filter(row => row.metricId === metricId && row.comparable); return { metricId, count: values.length, unit: values[0].unit, mae: values.reduce((sum, row) => sum + row.absoluteError, 0) / values.length, rmse: Math.sqrt(values.reduce((sum, row) => sum + row.squaredError, 0) / values.length), weighting: "Unweighted across supplied comparable geography rows; no missing observations imputed." }; });
  return { available: rows.some(row => row.comparable), schemaVersion: "population-observed-scorecard.v1", datasetId: dataset.datasetId, source: structuredClone(dataset.source), rows, metrics: summaries, modelVersion: snapshot.modelVersion, minute: snapshot.minute, warnings: [...new Set(warnings)], interpretation: "Descriptive fit to user-supplied aggregate data, not an independent historical backtest or causal/forecast validation. Source dates/units and partial geographic coverage remain visible." };
}

export function proposeBehaviorCalibration({ snapshot, scorecard, parameterId, candidateValue } = {}) {
  const definition = populationParameters.find(row => row.id === parameterId), config = snapshot?.config;
  if (!definition || !config || !scorecard?.available) throw new Error("A comparable observed scorecard, current config and registered parameter are required.");
  if (!finiteNumber(candidateValue) || candidateValue < definition.min || candidateValue > definition.max || ["population", "seed", "maxLogEntries"].includes(parameterId)) throw new Error("Choose a bounded behavioral parameter candidate; no seed/population retuning is inferred.");
  return { schemaVersion: "population-calibration-proposal.v1", parameterId, currentValue: config[parameterId], candidateValue, sourceDatasetId: scorecard.datasetId, sourceDate: scorecard.source?.date, modelVersion: snapshot.modelVersion, summary: `Review ${definition.label}: ${config[parameterId]} → ${candidateValue} ${definition.unit}`, suggestedConfig: { [parameterId]: candidateValue }, approved: false, applied: false, warnings: ["This is a hypothesis for a bounded fit experiment, not an automatically fitted or validated coefficient.", "Explicit review/approval is required. Applying settings resets/reseeds the model; keep the baseline and compare actual results using matched seeds.", "No recommendation is applied to the live runtime by the intelligence module."] };
}
