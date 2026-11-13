import { housingModel, simulateHousingRun, validateHousingParameters } from '../models/housing/index.js';
import { scoreBacktest } from '../decision/backtest.js';
import { normalizeEvidenceRecord } from '../evidence-registry.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
function require(condition, message) { if (!condition) throw Error(message); }

/** Origins are independent historical starting states; validation never enters fitting. */
export function validateRecipe(input) {
  const recipe = structuredClone(input);
  require(recipe?.schemaVersion === 'reality-calibration-recipe.v1', 'Unsupported recipe version.');
  require(id(recipe.id) && typeof recipe.geography === 'string' && recipe.geography.trim() && typeof recipe.dollarBasis === 'string' && recipe.dollarBasis.trim(), 'Declare dataset ID, geography and dollar basis.');
  require(date(recipe.tuningCutoff), 'A valid tuning cutoff is required.');
  require(Number.isInteger(recipe.seed) && recipe.seed >= 0 && recipe.seed <= 4294967295, 'Declare a uint32 seed.');
  require(Number.isInteger(recipe.runs) && recipe.runs >= 1 && recipe.runs <= 30, 'Use 1–30 runs per origin/horizon.');
  require(Array.isArray(recipe.origins) && recipe.origins.length >= 2 && recipe.origins.length <= 20, 'Use 2–20 historical origins.');
  const seen = new Set();
  for (const origin of recipe.origins) {
    require(id(origin.id) && !seen.has(origin.id), 'Unique origin IDs required.'); seen.add(origin.id);
    require(date(origin.startDate) && date(origin.inputsAvailableAt) && origin.inputsAvailableAt <= origin.startDate, 'Inputs must have been available by each historical start date.');
    require(['tuning','validation'].includes(origin.split), 'Declare tuning or validation for each origin.');
    require(origin.split === 'tuning' ? origin.startDate < recipe.tuningCutoff : origin.startDate >= recipe.tuningCutoff, 'Validation origins must start on/after the tuning cutoff.');
    require(typeof origin.source === 'string' && origin.source.trim(), 'Each starting state needs a source.');
    const checked = validateHousingParameters(origin.parameters);
    require(checked.valid, checked.errors.join(' '));
    require(['initial_housing','initial_households','initial_rent','initial_income'].every(key => finite(origin.parameters?.[key])), 'Supply all four initial state parameters explicitly.');
    require(['measured','synthetic'].includes(origin.label), 'Label each starting state measured or synthetic.');
    require(Array.isArray(origin.observations) && origin.observations.length >= 1 && origin.observations.length <= 10, 'Use 1–10 observations per origin.');
    const horizons = new Set();
    for (const observation of origin.observations) {
      require(date(observation.date) && date(observation.availableAt), 'Valid observation and release dates required.');
      const start = new Date(origin.startDate), end = new Date(observation.date);
      const years = end.getUTCFullYear() - start.getUTCFullYear();
      require(years >= 1 && years <= 30 && start.getUTCMonth() === end.getUTCMonth() && start.getUTCDate() === end.getUTCDate() && !horizons.has(years), 'Unique exact annual horizons of 1–30 years required.');
      horizons.add(years);
      require(observation.availableAt >= observation.date, 'Observation availability cannot precede its period end.');
      require(origin.split !== 'tuning' || observation.date <= recipe.tuningCutoff && observation.availableAt <= recipe.tuningCutoff, 'Tuning outcomes must be available by the tuning cutoff.');
      require(['measured','synthetic'].includes(observation.label) && typeof observation.source === 'string' && observation.source.trim(), 'Label and cite every observation.');
      require(observation.metrics && Object.keys(observation.metrics).length > 0, 'Declare observed metrics.');
      for (const [key, value] of Object.entries(observation.metrics)) {
        const definition = housingModel.metrics.find(row => row.id === key);
        require(definition && (value === null || finite(value)) && observation.units?.[key] === definition.unit, 'Exact registered metrics, finite values (or null) and matching units required.');
      }
    }
  }
  require(recipe.origins.some(row => row.split === 'tuning') && recipe.origins.some(row => row.split === 'validation'), 'Separate tuning and held-out validation origins required.');
  // Disallow overlapping target periods; separate origins alone do not establish a holdout.
  const trainingEnd = Math.max(...recipe.origins.filter(row => row.split === 'tuning').flatMap(row => row.observations.map(item => Date.parse(item.date))));
  require(recipe.origins.filter(row => row.split === 'validation').every(row => row.observations.every(item => Date.parse(item.date) > trainingEnd)), 'Validation targets must follow all tuning targets.');
  require(Array.isArray(recipe.evidence) && recipe.evidence.length <= 100, 'Bounded Research Library evidence array required.');
  const evidenceIds = new Set();
  for (const row of recipe.evidence) {
    require(id(row.id) && !evidenceIds.has(row.id), 'Unique evidence IDs required.'); evidenceIds.add(row.id);
    require(date(row.availableAt) && row.availableAt <= recipe.tuningCutoff && typeof row.sourceName === 'string' && row.sourceName.trim() && /^https?:\/\//.test(row.url || '') && ['measured','synthetic'].includes(row.label), 'Evidence needs a citation, label and pre-cutoff availability.');
  }
  if (recipe.tuning) {
    const tuning = recipe.tuning;
    require(tuning.parameterId === 'rent_response', 'This slice supports only rent_response tuning.');
    const definition = housingModel.parameters.find(row => row.id === tuning.parameterId);
    require(Array.isArray(tuning.values) && tuning.values.length >= 2 && tuning.values.length <= 12 && tuning.values.every(value => finite(value) && value >= definition.min && value <= definition.max), 'Use 2–12 in-bounds candidate values.');
    require(Array.isArray(tuning.evidenceIds) && tuning.evidenceIds.length > 0 && tuning.evidenceIds.every(key => recipe.evidence.some(row => row.id === key && row.parameterId === tuning.parameterId && row.geography === recipe.geography)), 'Every tuned parameter needs matching Research Library evidence.');
    require(recipe.origins.filter(row => row.split === 'tuning').some(row => row.observations.some(item => finite(item.metrics.median_rent))), 'Rent response tuning requires observed median_rent.');
  }
  const yearsOfWork = recipe.origins.reduce((sum, origin) => sum + origin.observations.reduce((total, observation) => total + Number(observation.date.slice(0,4)) - Number(origin.startDate.slice(0,4)), 0), 0) * recipe.runs * (4 + (recipe.tuning?.values.length || 0));
  require(yearsOfWork <= 20000, 'Recipe exceeds the 20,000 simulated-year work budget; reduce origins, horizons, runs or grid values.');
  return recipe;
}

export async function runCalibrationLab(input) {
  const recipe = validateRecipe(input);
  const seeds = Array.from({length:recipe.runs}, (_, index) => (recipe.seed + index) >>> 0);
  async function evaluate(origins, override) {
    const rows = [], failures = [], runRecords = [];
    for (const origin of origins) for (const observation of origin.observations) {
      const years = new Date(observation.date).getUTCFullYear() - new Date(origin.startDate).getUTCFullYear();
      const parameters = {...origin.parameters, ...override}, runs = [];
      for (const seed of seeds) {
        try {
          const run = simulateHousingRun({parameters, seed, years}); runs.push(run);
          runRecords.push({id:`${origin.id}-${years}-${seed}`, originId:origin.id, seed, horizonYears:years, label:'synthetic', parameters:validateHousingParameters(parameters).values, metrics:structuredClone(run.metrics)});
        }
        catch (error) { failures.push({originId:origin.id, years, seed, reason:error.message}); }
      }
      const scored = scoreBacktest(runs, observation.metrics);
      for (const [metricId, observed] of Object.entries(observation.metrics)) {
        const score = scored.metrics.find(item => item.metricId === metricId);
        rows.push({originId:origin.id, split:origin.split, startDate:origin.startDate, date:observation.date, horizonYears:years, metricId, unit:observation.units[metricId], observedLabel:observation.label, resultLabel:'synthetic', source:observation.source, successful:runs.length, failed:seeds.length-runs.length, ...(score || {observed, status:'unavailable', reason:'Missing observation or model value.'})});
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    // A single native-unit objective; do not combine incompatible metric scales.
    const usable = rows.filter(row => row.metricId === 'median_rent' && finite(row.squaredError));
    return {rows, failures, runRecords, objective:usable.length && !failures.length ? usable.reduce((sum,row) => sum+row.squaredError,0)/usable.length : null};
  }
  const training = recipe.origins.filter(row => row.split === 'tuning');
  const baseline = await evaluate(training, {});
  let selected = {}, fitted = baseline;
  const trials = [], parameters = [];
  if (recipe.tuning) {
    for (const value of [...new Set(recipe.tuning.values)]) {
      const fit = await evaluate(training, {rent_response:value});
      trials.push({value, meanSquaredRentError:fit.objective, label:'synthetic'});
      if (finite(fit.objective) && finite(fitted.objective) && fit.objective < fitted.objective) { selected = {rent_response:value}; fitted = fit; }
    }
    if (selected.rent_response !== undefined) parameters.push({parameterId:'rent_response', beforeByOrigin:Object.fromEntries(recipe.origins.map(row => [row.id, row.parameters.rent_response ?? housingModel.parameters.find(item => item.id === 'rent_response').default])), fitted:selected.rent_response, label:'synthetic', evidenceIds:recipe.tuning.evidenceIds, evidenceLinks:recipe.tuning.evidenceIds.map(key => `#evidence-${key}`), method:'pre-cutoff grid search; strict improvement over supplied baselines', applied:false});
  }
  // Validation is evaluated only after selection is frozen, with matched seeds.
  const validation = recipe.origins.filter(row => row.split === 'validation');
  const heldOutBaseline = await evaluate(validation, {});
  const heldOut = await evaluate(validation, selected);
  return {schemaVersion:'reality-calibration-report.v1', label:'synthetic', model:{id:housingModel.id, version:housingModel.version, rulesVersion:'reality-calibration.v1'}, recipe, seeds, parameters, trials, tuning:{baseline, fitted}, validation:{baseline:heldOutBaseline, fitted:heldOut}, researchLibrary:recipe.evidence.map(row => ({...normalizeEvidenceRecord(row), availableAt:row.availableAt, label:row.label})), answers:{verification:'Versioned housing model, explicit inputs, annual horizon alignment and seed-matched baseline/fitted runs. Deterministic replay verifies computation, not real-world accuracy.', validation:heldOut.rows.some(row => row.observedLabel === 'measured' && finite(row.absoluteError)) ? 'Held-out comparisons use user-declared measured observations. Source authenticity and model applicability require independent review.' : 'Synthetic holdout only: no empirical predictive validation established.', uncertainty:'P10–P90 describes seed variation only; it excludes observation error, parameter uncertainty and structural uncertainty. Grid trials are not confidence intervals. Inspect missing outcomes and failures.'}, limitations:['Input/source availability dates and measured labels are user assertions, not independently verified.', 'Unspecified housing coefficients retain synthetic defaults. A measured starting state does not make the simulation measured.', 'Smaller tuning error does not establish causality, identification, or future predictive accuracy.', 'Only rent_response is supported; changes remain a reviewable recipe and do not mutate active worlds.']};
}
