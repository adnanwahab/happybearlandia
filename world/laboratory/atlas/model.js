import { VERSION, sum } from '../../city/contracts.js';
import { cityMetrics, createEngine } from '../../city/engine.js';
import { createCity } from '../../city/seed.js';

export const ATLAS_VERSION = 'tipping-point-atlas.v1';
export const ATLAS_MODEL_VERSION = VERSION;
export const ATLAS_DEFAULTS = Object.freeze({
  seed: 42,
  horizonMonths: 60,
  households: 90,
  constructionSpeed: 1,
  populationGrowth: 0.02,
});
export const ATLAS_LIMITS = Object.freeze({
  constructionSpeed: Object.freeze([0.25, 2.5]),
  populationGrowth: Object.freeze([-0.02, 0.05]),
});
export const ATLAS_SWEEPS = Object.freeze({
  quick: Object.freeze({ resolution: 5, seedCount: 3 }),
  detailed: Object.freeze({ resolution: 9, seedCount: 5 }),
  extended: Object.freeze({ resolution: 17, seedCount: 7 }),
});
export const ATLAS_THRESHOLDS = Object.freeze({ severeUnhousedShare: 0.05, tightVacancyShare: 0.05 });

const constructionResources = Object.freeze({ contractors: 4, labor: 3, materials: 4, equipment: 4 });

function bounded(value, label, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`Choose ${label} from ${min} to ${max}.`);
  }
  return value;
}

export function normalizeAtlasRecipe(input = {}) {
  if (input.version !== undefined && input.version !== ATLAS_VERSION) throw new Error('Unsupported Atlas recipe version.');
  if (input.modelVersion !== undefined && input.modelVersion !== VERSION) throw new Error('Unsupported City model version.');
  const values = { ...ATLAS_DEFAULTS, ...input };
  return {
    version: ATLAS_VERSION,
    modelVersion: VERSION,
    seed: bounded(values.seed, 'a whole-number seed', 0, 0xffffffff, true),
    horizonMonths: bounded(values.horizonMonths, 'a whole-number duration in months', 12, 72, true),
    households: bounded(values.households, 'a whole-number starting household count', 30, 120, true),
    constructionSpeed: bounded(values.constructionSpeed, 'a construction capacity multiplier', ...ATLAS_LIMITS.constructionSpeed),
    populationGrowth: bounded(values.populationGrowth, 'a baseline annual growth fraction', ...ATLAS_LIMITS.populationGrowth),
  };
}

const engine = createEngine();

export function createAtlasStart(input) {
  const { seed, households, constructionSpeed, populationGrowth } = normalizeAtlasRecipe(input);
  const state = createCity({ seed, households });
  state.provenance = { ...state.provenance, datasetVersion: ATLAS_VERSION, worldRevision: ATLAS_VERSION };
  state.parameters.annualGrowth = populationGrowth;
  for (const [resource, capacity] of Object.entries(constructionResources)) {
    state.parameters[resource] = capacity * constructionSpeed;
  }
  for (const parcel of state.parcels) {
    const districtId = parcel.districtId;
    parcel.capacity = state.units.filter(unit => unit.districtId === districtId).length;
    for (const phase of [1, 2]) {
      // All runs inherit the same two already-financed projects per district.
      state.projects.push({
        id: `atlas-${districtId}-${phase}`, districtId, type: 'housing',
        units: 9, amount: 9, stage: 'construction', progress: 0, duration: 8,
        cost: 0, costOverrun: 0, displacedUnits: [], displacedBusinesses: [],
      });
    }
  }
  return engine.initialize(state);
}

export function summarizeAtlasMonth(state) {
  return {
    month: state.month,
    ...cityMetrics(state),
    districts: state.districts.map(({ id, name }) => {
      const households = state.households.filter(row => row.districtId === id);
      const units = state.units.filter(row => row.districtId === id);
      return {
        id, name, households: households.length, housingUnits: units.length,
        availableUnits: units.filter(unit => unit.status === 'available').length,
        unhoused: households.filter(household => !household.unitId).length,
        meanRent: units.length ? sum(units, unit => unit.rent) / units.length : null,
        employed: state.workers.filter(worker => worker.districtId === id && worker.jobId).length,
      };
    }),
  };
}

export function classifyAtlasHousing({ households, unhoused, availableUnits, housingUnits }) {
  if (households > 0 && unhoused / households >= ATLAS_THRESHOLDS.severeUnhousedShare) return 'severe';
  if (unhoused > 0 || housingUnits === 0 || availableUnits / housingUnits < ATLAS_THRESHOLDS.tightVacancyShare) return 'tight';
  return 'adequate';
}

function simulate(recipe, retainMonths) {
  let state = createAtlasStart(recipe);
  const series = retainMonths ? [summarizeAtlasMonth(state)] : null;
  for (let i = 0; i < recipe.horizonMonths; i++) {
    state = engine.step(state).state;
    if (series) series.push(summarizeAtlasMonth(state));
  }
  return series ?? cityMetrics(state);
}

export function runAtlasSample(input) {
  const recipe = normalizeAtlasRecipe(input);
  const series = simulate(recipe, true);
  return { recipe, modelVersion: VERSION, initial: series[0], final: series.at(-1), series };
}

function axis([min, max], count) {
  return Array.from({ length: count }, (_, i) => Number((min + (max - min) * i / (count - 1)).toFixed(5)));
}

export function createAtlasSweep({ preset = 'quick', ...input } = {}) {
  const settings = ATLAS_SWEEPS[preset];
  if (!Object.hasOwn(ATLAS_SWEEPS, preset)) throw new Error('Choose an available sweep size.');
  const recipe = normalizeAtlasRecipe(input);
  const { resolution, seedCount } = settings;
  const speeds = axis(ATLAS_LIMITS.constructionSpeed, resolution);
  const growthRates = axis(ATLAS_LIMITS.populationGrowth, resolution).reverse();
  const seeds = Array.from({ length: seedCount }, (_, i) => (recipe.seed + i) >>> 0);
  const cells = growthRates.flatMap((populationGrowth, row) =>
    speeds.map((constructionSpeed, column) => ({ row, column, constructionSpeed, populationGrowth })));
  return { preset, recipe, speeds, growthRates, seeds, cells, sampleCount: cells.length * seedCount };
}

export function runAtlasCell(sweep, cell) {
  const counts = { adequate: 0, tight: 0, severe: 0 };
  const samples = sweep.seeds.map(seed => {
    const recipe = normalizeAtlasRecipe({
      ...sweep.recipe, seed, constructionSpeed: cell.constructionSpeed, populationGrowth: cell.populationGrowth,
    });
    const metrics = simulate(recipe, false);
    const classification = classifyAtlasHousing(metrics);
    counts[classification]++;
    return { seed, classification, ...metrics };
  });
  const classification = Object.keys(counts).find(key => counts[key] > samples.length / 2) ?? 'mixed';
  const meanUnhousedShare = sum(samples, row => row.households ? row.unhoused / row.households : 0) / samples.length;
  return { ...cell, samples, counts, classification, meanUnhousedShare };
}

export function atlasSampleURL(input, month) {
  const recipe = normalizeAtlasRecipe(input);
  const query = new URLSearchParams(Object.entries(recipe).map(([key, value]) => [key, String(value)]));
  if (month !== undefined) query.set('month', String(bounded(month, 'a snapshot month', 0, recipe.horizonMonths, true)));
  return '/world/laboratory/atlas/?' + query;
}

export function readAtlasSampleURL(query) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  if (!params.has('version')) return null;
  if (!params.has('modelVersion')) throw new Error('The sample link needs a City model version.');
  const input = { version: params.get('version'), modelVersion: params.get('modelVersion') };
  for (const key of Object.keys(ATLAS_DEFAULTS)) {
    if (!params.has(key) || !params.get(key).trim()) throw new Error('The sample link is missing a scenario parameter.');
    input[key] = Number(params.get(key));
  }
  const recipe = normalizeAtlasRecipe(input);
  const month = params.has('month') ? bounded(Number(params.get('month')), 'a snapshot month', 0, recipe.horizonMonths, true)
    : recipe.horizonMonths;
  return { recipe, month };
}
