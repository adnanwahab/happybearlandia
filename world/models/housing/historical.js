import { simulateHousingRun, validateHousingParameters } from "./index.js";

/** Official series definitions only. No observed values are bundled or invented.
 * Download the selected ACS vintage/geography, retain its actual publication date,
 * and import it. ACS medians use each vintage's dollars: supply dollarFactor when
 * comparing different years to the model's base-year-dollar rent/income.
 */
export const housingHistoricalSources = [
  { id: "census-acs-rent", agency: "US Census Bureau", dataset: "ACS 1-year estimates", variable: "B25064_001E", metricId: "median_rent", parameterId: "initial_rent", unit: "USD/month",
    url: "https://api.census.gov/data/2024/acs/acs1/variables/B25064_001E.html", verifiedAt: "2026-11-02", confidence: "official-series-definition", notes: "Median gross rent. Survey estimate, not an exact observation; retain margin of error externally." },
  { id: "census-acs-stock", agency: "US Census Bureau", dataset: "ACS 1-year estimates", variable: "B25001_001E", metricId: "housing_supply", parameterId: "initial_housing", unit: "homes",
    url: "https://api.census.gov/data/2024/acs/acs1/groups.html", verifiedAt: "2026-11-02", confidence: "official-series-definition", notes: "Total housing units; broader than usable market inventory. Inspect vacancy/seasonal-use coverage before applying." },
  { id: "census-acs-income", agency: "US Census Bureau", dataset: "ACS 1-year estimates", variable: "B19013_001E", parameterId: "initial_income", unit: "USD/year",
    url: "https://api.census.gov/data/2023/acs/acs1/groups.html", verifiedAt: "2026-11-02", confidence: "official-series-definition", notes: "Median household income in the vintage's inflation-adjusted dollars; does not isolate renter income." },
  { id: "census-hvs", agency: "US Census Bureau", dataset: "Housing Vacancies and Homeownership", metricId: "vacancy_rate", unit: "percent",
    url: "https://www.census.gov/housing/hvs/data/histtabs.html", verifiedAt: "2026-11-02", confidence: "official-series-definition", notes: "Rental vacancy differs from this model's all-home vacancy. Do not directly calibrate without a matched housing-stock definition." },
];

function csvRows(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const content = String(text).replace(/^\uFEFF/, "");
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (quoted && content[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      row.push(cell); cell = "";
      if (char !== ",") {
        if (char === "\r" && content[i + 1] === "\n") i++;
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
      }
    } else cell += char;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function objects(input) {
  let parsed = input;
  if (typeof input === "string") {
    const text = input.trim();
    parsed = text.startsWith("[") || text.startsWith("{") ? JSON.parse(text) : csvRows(text);
  }
  if (parsed && !Array.isArray(parsed)) parsed = parsed.rows || parsed.observations;
  if (!Array.isArray(parsed)) throw new Error("Historical data must be CSV, an array, or {rows:[...]} JSON.");
  if (Array.isArray(parsed[0])) {
    const [headers, ...rows] = parsed;
    return rows.map((row) => Object.fromEntries(headers.map((key, index) => [key, row[index]])));
  }
  return parsed;
}
const finiteValue = (value) => (typeof value === "number" || typeof value === "string") && String(value).trim() !== "" && Number.isFinite(Number(value));
const isoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** User-supplied historical observations. Every row must declare when it became
 * available. cutoffDate filters availability, not just observation year, to prevent
 * a historical run from silently seeing revised or subsequently published data.
 * Input may be long form {year,metricId,value,unit,availableAt} or wide-form CSV.
 * mapping is {[metricId]: columnName}; no unit inference/conversion occurs silently.
 */
export function importHousingHistory(input, options = {}) {
  const rows = objects(input);
  const observations = [];
  const warnings = [];
  const errors = [];
  const allowed = { median_rent: "USD/month", housing_supply: "homes", initial_income: "USD/year", initial_households: "households", vacancy_rate: "percent" };
  const { mapping = {}, cutoffDate = null } = options;
  if (cutoffDate && !isoDate(cutoffDate)) throw new Error("cutoffDate must be a valid YYYY-MM-DD date.");
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") { errors.push(`Row ${index + 1}: expected an object.`); return; }
    const year = Number(row.year ?? options.year);
    const availableAt = row.availableAt ?? options.availableAt;
    const geography = row.geography ?? options.geography;
    const sourceUrl = row.sourceUrl ?? options.sourceUrl;
    const sourceName = row.sourceName ?? options.sourceName ?? "User-supplied historical data";
    if (!Number.isInteger(year) || year < 1900 || year > 2200) { errors.push(`Row ${index + 1}: invalid observation year.`); return; }
    if (!isoDate(availableAt)) { errors.push(`Row ${index + 1}: actual publication/availability date is required.`); return; }
    if (Number(availableAt.slice(0, 4)) < year) { errors.push(`Row ${index + 1}: annual observation cannot be available before its observation year.`); return; }
    if (!geography) { errors.push(`Row ${index + 1}: geography is required.`); return; }
    if (cutoffDate && availableAt > cutoffDate) { warnings.push(`Row ${index + 1}: excluded; available ${availableAt}, after cutoff ${cutoffDate}.`); return; }
    const entries = row.metricId ? [[row.metricId, row.value]] : Object.entries(mapping).map(([id, column]) => [id, row[column]]);
    for (const [metricId, raw] of entries) {
      if (!allowed[metricId]) { errors.push(`Row ${index + 1}: unsupported historical metric ${metricId}.`); continue; }
      if (!finiteValue(raw) || Number(raw) < 0) { warnings.push(`Row ${index + 1}: ${metricId} is missing, nonnumeric, or a negative Census sentinel; omitted.`); continue; }
      const unit = row.unit ?? options.units?.[metricId];
      if (unit !== allowed[metricId]) { errors.push(`Row ${index + 1}: ${metricId} requires explicit ${allowed[metricId]} units.`); continue; }
      const monetary = unit.startsWith("USD");
      const dollarYear = Number(row.dollarYear ?? options.dollarYear ?? year);
      const baseYear = Number(options.baseYear ?? dollarYear);
      const factor = Number(row.dollarFactor ?? options.dollarFactors?.[year] ?? (dollarYear === baseYear ? 1 : NaN));
      if (monetary && (!Number.isInteger(dollarYear) || !Number.isFinite(factor) || factor <= 0)) { errors.push(`Row ${index + 1}: explicit positive dollarFactor required to convert ${dollarYear} dollars to ${baseYear} dollars.`); continue; }
      if (!sourceUrl) warnings.push(`Row ${index + 1}: source URL absent; provenance remains user-supplied and unverified.`);
      observations.push({ year, metricId, value: Number(raw) * (monetary ? factor : 1), rawValue: Number(raw), unit,
        dollarYear: monetary ? baseYear : null, geography, availableAt, source: { name: sourceName, url: sourceUrl || null,
          type: sourceUrl ? "user-supplied-cited" : "user-supplied-unverified", retrievedAt: options.retrievedAt || null }, cutoffDate });
    }
  });
  if (!observations.length) warnings.push("No usable historical observations; no empirical validation or calibration has occurred.");
  return { valid: errors.length === 0 && observations.length > 0, observations, warnings, errors, cutoffDate,
    provenance: { type: "user-supplied", importedAt: options.retrievedAt || null, empiricalCalibrationClaimed: false } };
}

/** Adapter for an actual downloaded Census API array with a single geography.
 * Stock and rent metadata links are preserved in each imported observation.
 * Requires caller-selected vintage, geography, actual publication date, and dollar basis.
 */
export function importCensusHousingHistory(input, options = {}) {
  return importHousingHistory(input, { ...options, sourceName: "US Census Bureau · ACS 1-year estimates",
    sourceUrl: options.sourceUrl || `https://api.census.gov/data/${options.year}/acs/acs1`,
    mapping: { housing_supply: "B25001_001E", median_rent: "B25064_001E", initial_income: "B19013_001E", initial_households: "B11001_001E" },
    units: { housing_supply: "homes", median_rent: "USD/month", initial_income: "USD/year", initial_households: "households" } });
}

export function historicalInitialParameters(observations, { cutoffDate, geography } = {}) {
  if (!isoDate(cutoffDate)) throw new Error("A valid information cutoffDate is required.");
  const eligible = observations.filter((row) => row.availableAt <= cutoffDate && (!geography || row.geography === geography));
  const geographies = new Set(eligible.map((row) => row.geography));
  if (geographies.size > 1) throw new Error("Choose a single geography before initializing the model.");
  const latest = new Map();
  for (const row of eligible) if (!latest.has(row.metricId) || latest.get(row.metricId).year < row.year) latest.set(row.metricId, row);
  const mapping = { housing_supply: "initial_housing", median_rent: "initial_rent", initial_income: "initial_income", initial_households: "initial_households" };
  const parameters = {};
  const evidence = [];
  for (const [metric, id] of Object.entries(mapping)) if (latest.has(metric)) { parameters[id] = latest.get(metric).value; evidence.push(latest.get(metric)); }
  const years = new Set(evidence.map((row) => row.year));
  const dollarYears = new Set(evidence.filter((row) => row.unit.startsWith("USD")).map((row) => row.dollarYear));
  if (years.size > 1) throw new Error("Initial housing, households, income, and rent must describe one consistent observation year.");
  if (dollarYears.size > 1) throw new Error("Initial monetary data must share a constant-dollar base year.");
  const validation = validateHousingParameters(parameters);
  return { parameters, evidence, year: evidence[0]?.year ?? null, cutoffDate, valid: validation.valid && evidence.length > 0, errors: validation.errors,
    warnings: Object.values(mapping).filter((id) => !(id in parameters)).map((id) => `${id} unavailable at cutoff; model default remains synthetic.`) };
}

/** Compare actual held-out observations against stored ensemble timelines.
 * Error measures are descriptive and do not establish future predictive accuracy.
 */
export function validateHousingHistory({ observations = [], runs = [], baseYear, cutoffDate, geography } = {}) {
  if (!Number.isInteger(baseYear) || !isoDate(cutoffDate)) throw new Error("Historical validation requires baseYear and a valid information cutoffDate.");
  const points = [];
  const warnings = [];
  const comparable = new Set(["median_rent", "housing_supply"]);
  const geographies = new Set(observations.filter((row) => !geography || row.geography === geography).map((row) => row.geography));
  if (geographies.size > 1) throw new Error("Choose a single geography for historical validation.");
  for (const observation of observations) {
    if (geography && observation.geography !== geography) continue;
    if (!comparable.has(observation.metricId) || observation.year <= baseYear) continue;
    if (!isoDate(observation.availableAt) || !Number.isFinite(observation.value) || observation.value < 0) {
      warnings.push(`Excluded invalid ${observation.year} ${observation.metricId} observation or missing availability date.`); continue;
    }
    if (observation.metricId === "median_rent" && observation.dollarYear != null && observation.dollarYear !== baseYear) {
      warnings.push(`Excluded ${observation.year} rent: convert dollar basis to model base year ${baseYear} before comparing.`); continue;
    }
    const samples = runs.filter((run) => !run.status || run.status === "completed")
      .map((run) => run.timeline?.find((row) => row.year === observation.year - baseYear)?.metrics?.[observation.metricId]).filter(Number.isFinite).sort((a, b) => a - b);
    if (!samples.length) continue;
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const percentile = (q) => { const index = q * (samples.length - 1), low = Math.floor(index); return samples[low] + (samples[Math.ceil(index)] - samples[low]) * (index - low); };
    const error = mean - observation.value;
    const below = samples.filter((value) => value < observation.value).length;
    const tied = samples.filter((value) => value === observation.value).length;
    points.push({ ...observation, predicted: mean, mean, median: percentile(0.5), p10: percentile(0.1), p90: percentile(0.9), observed: observation.value,
      error, absoluteError: Math.abs(error), squaredError: error ** 2,
      observedPercentile: (below + tied / 2) / samples.length * 100, count: samples.length,
      heldOut: observation.availableAt > cutoffDate });
  }
  const metrics = {};
  for (const id of new Set(points.map((point) => point.metricId))) {
    const rows = points.filter((point) => point.metricId === id);
    const nonzero = rows.filter((point) => point.observed !== 0);
    metrics[id] = { count: rows.length, mae: rows.reduce((sum, row) => sum + row.absoluteError, 0) / rows.length,
      rmse: Math.sqrt(rows.reduce((sum, row) => sum + row.squaredError, 0) / rows.length),
      mape: nonzero.length ? nonzero.reduce((sum, row) => sum + row.absoluteError / Math.abs(row.observed), 0) / nonzero.length * 100 : null,
      intervalCoverage: rows.filter((row) => row.observed >= row.p10 && row.observed <= row.p90).length / rows.length };
  }
  if (!points.length) warnings.push("No comparable observed/model years; no validation score is available.");
  if (points.some((point) => !point.heldOut)) warnings.push("Some observations were available at cutoff; those points are in-sample diagnostics, not a held-out backtest.");
  return { points, metrics, warnings, cutoffDate, baseYear, calibrated: false, predictiveAccuracyClaimed: false,
    limitation: "Descriptive historical fit only. Imported series definitions, geography, dollar basis, and vintage must match; historical fit does not prove future predictive accuracy." };
}

/** Transparent one-parameter grid fit. Caller supplies only training observations;
 * any observation published after the cutoff is excluded before choosing a value.
 * Fits rent_response against rent only, and retains a candidate/error audit trail.
 */
export function calibrateHousingModel({ observations = [], parameters = {}, baseYear, cutoffDate, geography, candidates = [0.2, 0.4, 0.6, 0.8, 1, 1.2], seeds = [42, 43, 44], years = 10 } = {}) {
  if (!Number.isInteger(baseYear) || !isoDate(cutoffDate)) throw new Error("Calibration requires baseYear and a valid information cutoffDate.");
  const training = observations.filter((row) => row.metricId === "median_rent" && row.year > baseYear && row.availableAt <= cutoffDate && (!geography || row.geography === geography));
  if (!training.length) return { calibrated: false, parameters: { ...parameters }, candidates: [], warnings: ["No pre-cutoff rent observations; defaults remain synthetic. No calibration performed."] };
  if (!candidates.length || candidates.length > 100 || !seeds.length || seeds.length > 100) throw new Error("Calibration requires 1–100 candidates and seeds.");
  const results = candidates.map((value) => {
    const fitted = { ...parameters, rent_response: value };
    const validation = validateHousingParameters(fitted);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    const runs = seeds.map((seed) => simulateHousingRun({ parameters: fitted, seed, years }));
    const score = validateHousingHistory({ observations: training, runs, baseYear, cutoffDate, geography });
    return { value, rmse: score.metrics.median_rent?.rmse ?? null, count: score.points.length };
  });
  const scored = results.filter((row) => Number.isFinite(row.rmse)).sort((a, b) => a.rmse - b.rmse || a.value - b.value);
  return { calibrated: scored.length > 0, parameters: { ...parameters, ...(scored.length ? { rent_response: scored[0].value } : {}) }, candidates: results,
    trainingObservations: training, cutoffDate, baseYear, method: "rent_response grid search minimizing ensemble-mean rent RMSE", empiricalCalibrationClaimed: false,
    warnings: ["A fit to user-supplied data, not independent verification of provenance or causal validity. Validate on subsequent observations separately."] };
}
