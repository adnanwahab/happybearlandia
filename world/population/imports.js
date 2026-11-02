/** Aggregate-only data workspace. Parsing/preview never mutates model/runtime.
 * Canonical envelope {schemaVersion:'population-data.v1',kind,datasetId,
 * source:{name,date,url?,status?,confidence?},units:{field:unit},rows:[...] }.
 * CSV maps columns explicitly; units/source/district mapping are user metadata.
 */
export const POPULATION_IMPORT_LIMITS = Object.freeze({ maxBytes: 2_000_000, maxRows: 10000, maxColumns: 48, maxDistricts: 128 });
export const MOBILITY_MODES = ["walk", "bike", "car", "bus", "rail"];
export const IMPORT_KINDS = ["population", "employment", "od", "transit", "observed_mobility", "observed_moves"];
const numeric = value => typeof value === "number" && Number.isFinite(value);
const object = value => value && typeof value === "object" && !Array.isArray(value);
const identifier = value => typeof value === "string" && !["__proto__", "constructor", "prototype"].includes(value) && /^[\w .:-]{1,100}$/.test(value);
const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const DEFINITIONS = {
  population: { ids: ["districtId"], required: ["population"], numeric: { population: [0, 100000000, "people", true], medianIncome: [0, 10000000, "USD/year"], meanHouseholdSize: [1, 12, "people/household"], employmentRate: [0, 1, "fraction"] }, distributions: ["householdSizeShares", "ageShares", "incomeShares"] },
  employment: { ids: ["districtId"], required: ["jobs"], numeric: { jobs: [0, 100000000, "jobs", true], meanWage: [0, 10000000, "USD/year"] }, optional: ["industry"] },
  od: { ids: ["originDistrict", "destinationDistrict"], required: ["trips"], numeric: { trips: [0, 1000000000, "trips/day"], meanMinutes: [0, 1440, "minutes/trip"] }, optional: ["mode"] },
  transit: { ids: ["routeId", "originDistrict", "destinationDistrict"], required: ["headwayMinutes", "capacity"], numeric: { headwayMinutes: [0.5, 1440, "minutes"], capacity: [1, 100000, "passengers/vehicle", true], serviceHours: [0, 24, "hours/day"] }, optional: ["mode"] },
  observed_mobility: { ids: ["districtId", "mode"], required: ["share"], numeric: { share: [0, 1, "fraction"], meanMinutes: [0, 1440, "minutes/trip"], tripsPerDay: [0, 1000000000, "trips/day"] } },
  observed_moves: { ids: ["districtId"], required: ["moveRate", "periodDays"], numeric: { moveRate: [0, 1, "fraction/period"], displacementRate: [0, 1, "fraction/period"], periodDays: [1, 3660, "days", true] } },
};
export const populationImportDefinitions = structuredClone(DEFINITIONS);

export function parseAggregateCSV(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > POPULATION_IMPORT_LIMITS.maxBytes) throw new Error("Aggregate input must be ≤2 MB.");
  const rows = [], row = []; let cell = "", quoted = false;
  const value = () => { row.push(cell); cell = ""; };
  const end = () => { value(); if (row.some(item => item.trim())) rows.push(row.splice(0)); else row.splice(0); if (rows.length > POPULATION_IMPORT_LIMITS.maxRows + 1) throw new Error("Aggregate input exceeds 10,000 rows."); };
  text = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else if (!cell || quoted) quoted = !quoted; else throw new Error("Malformed CSV quote."); }
    else if (char === "," && !quoted) value();
    else if ((char === "\n" || char === "\r") && !quoted) { end(); if (char === "\r" && text[index + 1] === "\n") index++; }
    else cell += char;
  }
  if (quoted) throw new Error("Unclosed CSV quote."); if (cell || row.length) end();
  const headers = rows.shift()?.map(header => header.trim());
  if (!headers?.length || headers.length > POPULATION_IMPORT_LIMITS.maxColumns || new Set(headers).size !== headers.length || headers.some(header => !header || ["__proto__", "constructor", "prototype"].includes(header))) throw new Error("Use 1–48 unique safe column headers.");
  return rows.map((cells, index) => { if (cells.length !== headers.length) throw new Error(`CSV row ${index + 2}: column count differs from header.`); return Object.fromEntries(headers.map((header, i) => [header, cells[i]])); });
}

function numberValue(value) {
  if (numeric(value)) return value;
  if (typeof value === "string" && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value.trim())) return Number(value);
  return NaN;
}
function distribution(value, field, errors, prefix) {
  if (typeof value === "string") try { value = JSON.parse(value); } catch { errors.push(`${prefix}: ${field} must be a JSON object of category shares.`); return null; }
  if (!object(value) || !Object.keys(value).length || Object.keys(value).length > 32) { errors.push(`${prefix}: ${field} needs 1–32 categories.`); return null; }
  const pairs = Object.entries(value).map(([key, share]) => [key, numberValue(share)]);
  if (pairs.some(([key, share]) => !identifier(key) || !numeric(share) || share < 0 || share > 1) || Math.abs(pairs.reduce((sum, [, share]) => sum + share, 0) - 1) > 1e-6) { errors.push(`${prefix}: ${field} shares must be finite fractions summing to 1; percentages are not silently converted.`); return null; }
  return Object.fromEntries(pairs);
}

export function validatePopulationDataset(input, { districtIds = [], districtMapping = {}, requireCompleteCoverage = false } = {}) {
  const errors = [], warnings = [], kind = input?.kind, definition = DEFINITIONS[kind];
  if (!object(input) || !definition) return { valid: false, errors: ["Choose a supported aggregate dataset kind."], warnings, dataset: null, coverage: [] };
  if (input.schemaVersion && input.schemaVersion !== "population-data.v1") errors.push("Unsupported aggregate dataset schemaVersion.");
  if (!identifier(input.datasetId)) errors.push("datasetId must be a nonempty safe identifier.");
  if (!object(input.source) || typeof input.source.name !== "string" || !input.source.name.trim() || input.source.name.length > 500 || !validDate(input.source.date)) errors.push("Provide source.name and a valid source.date (YYYY-MM-DD); no date is invented.");
  if (input.source?.url && (typeof input.source.url !== "string" || input.source.url.length > 2000 || !/^https?:\/\//i.test(input.source.url))) errors.push("Source URL must be an http(s) citation, never executable text.");
  if (input.source?.status && !["observed", "estimated", "synthetic"].includes(input.source.status)) errors.push("Source status must be observed, estimated or synthetic.");
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > POPULATION_IMPORT_LIMITS.maxRows) errors.push("Provide 1–10,000 aggregate rows.");
  if (!object(input.units)) errors.push("Explicit field units are required.");
  if (districtIds.length > POPULATION_IMPORT_LIMITS.maxDistricts || new Set(districtIds).size !== districtIds.length) errors.push("District registry must have ≤128 unique IDs.");
  const known = new Set(districtIds), seen = new Set(), covered = new Set(), mappedRows = [];
  const allowed = new Set([...definition.ids, ...definition.required, ...Object.keys(definition.numeric), ...(definition.distributions || []), ...(definition.optional || [])]);
  for (const [index, raw] of (Array.isArray(input.rows) ? input.rows.slice(0, POPULATION_IMPORT_LIMITS.maxRows) : []).entries()) {
    const prefix = `Row ${index + 1}`, row = {};
    if (!object(raw)) { errors.push(`${prefix}: expected an aggregate object.`); continue; }
    if (Object.keys(raw).some(key => !allowed.has(key))) errors.push(`${prefix}: unsupported fields. Personal names/addresses/agent records must not be imported.`);
    for (const id of definition.ids) {
      let value = raw[id]; if (typeof value === "string") value = value.trim();
      if (["districtId", "originDistrict", "destinationDistrict"].includes(id)) { value = Object.hasOwn(districtMapping, value) ? districtMapping[value] : value; if (value === "__all__" && id === "districtId") { /* explicit city aggregate; no district coverage implied */ } else if (known.size && !known.has(value)) errors.push(`${prefix}: district ${value || "(missing)"} has no current geography mapping.`); else if (identifier(value)) covered.add(value); }
      if (!identifier(value)) errors.push(`${prefix}: ${id} is required.`); row[id] = value;
    }
    for (const [field, [min, max, unit, integer]] of Object.entries(definition.numeric)) {
      if (raw[field] === undefined || raw[field] === "") { if (definition.required.includes(field)) errors.push(`${prefix}: ${field} is required.`); continue; }
      const value = numberValue(raw[field]);
      if (!numeric(value) || value < min || value > max || integer && !Number.isInteger(value)) errors.push(`${prefix}: ${field} must be ${integer ? "a whole number" : "finite"} in [${min}, ${max}].`);
      if (input.units?.[field] !== unit) errors.push(`${prefix}: ${field} requires explicit units '${unit}'.`); row[field] = value;
    }
    for (const field of definition.distributions || []) if (raw[field] !== undefined && raw[field] !== "") { if (input.units?.[field] !== "fraction") errors.push(`${prefix}: ${field} units must be fraction.`); row[field] = distribution(raw[field], field, errors, prefix); }
    for (const field of definition.optional || []) if (raw[field] !== undefined && raw[field] !== "") row[field] = String(raw[field]).trim();
    if (row.mode && !(kind === "transit" ? ["bus", "rail"] : MOBILITY_MODES).includes(row.mode)) errors.push(`${prefix}: unsupported mode ${row.mode}.`);
    if (kind === "transit" && !row.mode) errors.push(`${prefix}: transit mode bus or rail is required.`);
    if (kind === "observed_moves" && numeric(row.displacementRate) && row.displacementRate > row.moveRate) errors.push(`${prefix}: displacementRate cannot exceed moveRate under the stated household-move definition.`);
    const key = kind === "od" ? `${row.originDistrict}|${row.destinationDistrict}|${row.mode || "all"}` : kind === "transit" ? row.routeId : kind === "observed_mobility" ? `${row.districtId}|${row.mode}` : kind === "employment" ? `${row.districtId}|${row.industry || "all"}` : row.districtId;
    if (seen.has(key)) errors.push(`${prefix}: duplicate aggregate key ${key}; resolve duplicates explicitly.`); seen.add(key); mappedRows.push(row);
  }
  if (mappedRows.some(row => row.districtId === "__all__") && mappedRows.some(row => row.districtId && row.districtId !== "__all__")) errors.push("Do not mix city totals with district rows in one dataset.");
  if (kind === "observed_mobility") for (const district of new Set(mappedRows.map(row => row.districtId))) {
    const rows = mappedRows.filter(row => row.districtId === district), sum = rows.reduce((total, row) => total + (row.share || 0), 0);
    if (sum > 1 + 1e-6 || rows.length === MOBILITY_MODES.length && Math.abs(sum - 1) > 1e-6) errors.push(`District ${district}: mode shares must sum to 1 when all five modes are supplied, and never exceed 1.`);
    if (rows.length < MOBILITY_MODES.length) warnings.push(`District ${district}: partial mode coverage; unreported modes are not assumed zero.`);
  }
  const coverage = districtIds.map(districtId => ({ districtId, covered: covered.has(districtId), status: covered.has(districtId) ? input.source?.status || "unverified" : "missing", confidence: covered.has(districtId) ? input.source?.confidence || "unverified" : "missing", sourceDate: covered.has(districtId) ? input.source?.date : null }));
  const missing = coverage.filter(row => !row.covered);
  if (missing.length) (requireCompleteCoverage ? errors : warnings).push(`Missing district coverage: ${missing.map(row => row.districtId).join(", ")}. Model defaults must not be labeled observed.`);
  if (!known.size) warnings.push("No runtime district registry supplied; geographic compatibility is not yet established.");
  warnings.push("Source metadata is user supplied, not independently verified; importing a citation does not calibrate or validate behavior.");
  return { valid: errors.length === 0, errors: [...new Set(errors)].slice(0, 100), warnings: [...new Set(warnings)].slice(0, 100), dataset: errors.length ? null : { schemaVersion: "population-data.v1", datasetId: input.datasetId, kind, source: structuredClone(input.source), units: structuredClone(input.units), rows: mappedRows }, coverage };
}

export function parsePopulationImport(text, { filename = "data.json", kind, source, units, datasetId = filename, columns = {}, ...validation } = {}) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > POPULATION_IMPORT_LIMITS.maxBytes) throw new Error("Aggregate input must be ≤2 MB.");
  let payload;
  if (/\.csv$/i.test(filename)) {
    const rows = parseAggregateCSV(text), definition = DEFINITIONS[kind]; if (!definition) throw new Error("Choose the CSV dataset kind before mapping columns.");
    const fields = [...new Set([...definition.ids, ...Object.keys(definition.numeric), ...(definition.distributions || []), ...(definition.optional || [])])];
    payload = { schemaVersion: "population-data.v1", datasetId, kind, source, units, rows: rows.map(row => Object.fromEntries(fields.filter(field => columns[field] ? row[columns[field]] !== undefined : row[field] !== undefined).map(field => [field, row[columns[field] || field]]))) };
  } else { payload = JSON.parse(text); if (Array.isArray(payload)) payload = { schemaVersion: "population-data.v1", datasetId, kind, source, units, rows: payload }; }
  return validatePopulationDataset(payload, validation);
}

export function aggregateDatasetPreview(dataset, limit = 6) {
  if (!dataset) return null;
  return { kind: dataset.kind, datasetId: dataset.datasetId, source: dataset.source, units: dataset.units, rowCount: dataset.rows.length, rows: structuredClone(dataset.rows.slice(0, Math.max(1, Math.min(20, limit)))), applied: false, note: "Preview only. No live population, district, job, trip or model parameter has changed." };
}
