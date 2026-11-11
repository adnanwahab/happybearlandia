import { createEngine, scheduleShock } from '../../city/engine.js';
import { ATLAS_DEFAULTS, ATLAS_VERSION, ATLAS_MODEL_VERSION, createAtlasStart, normalizeAtlasRecipe, summarizeAtlasMonth } from '../atlas/model.js';

export const genomeVersion = 'city-genome.v1';
export const ingredients = Object.freeze({
  flood: Object.freeze({ label: 'Riverside flood', type: 'flood', districtId: 'd1', start: 6, duration: 3, severity: 0.8 }),
  materials: Object.freeze({ label: 'Materials shortage', type: 'materials', districtId: 'd0', start: 7, duration: 8, severity: 0.9 }),
  rate: Object.freeze({ label: 'Interest-rate shock', type: 'rate', districtId: 'd0', start: 5, duration: 12, severity: 0.9 }),
});
export const inputs = Object.freeze({
  constructionSpeed: 'Construction capacity',
  populationGrowth: 'Population growth',
  land: 'Developable land capacity',
  energy: 'Electric capacity',
  transport: 'Road and transit capacity',
  constructionCost: 'Construction cost per unit',
});

export function normalizeGenomeRecipe(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (input.version !== undefined && input.version !== genomeVersion) ||
      (input.atlasVersion !== undefined && input.atlasVersion !== ATLAS_VERSION) ||
      (input.modelVersion !== undefined && input.modelVersion !== ATLAS_MODEL_VERSION)) {
    throw new Error('This genome recipe uses an unsupported version.');
  }
  const { seed, constructionSpeed, populationGrowth } = normalizeAtlasRecipe({
    seed: input.seed ?? ATLAS_DEFAULTS.seed,
    constructionSpeed: input.constructionSpeed ?? ATLAS_DEFAULTS.constructionSpeed,
    populationGrowth: input.populationGrowth ?? ATLAS_DEFAULTS.populationGrowth,
  });
  const land = input.land ?? 1;
  const energy = input.energy ?? 1;
  const transport = input.transport ?? 1;
  const constructionCost = input.constructionCost ?? 1;
  if (![0.25, 1, 2].includes(land) || ![0.5, 1, 2].includes(energy) || ![0.5, 1, 2].includes(transport) ||
      ![0.5, 1, 2].includes(constructionCost)) {
    throw new Error('This recipe contains an unsupported capacity multiplier.');
  }
  const shocks = input.shocks ?? [];
  if (!Array.isArray(shocks) || shocks.length > Object.keys(ingredients).length ||
      shocks.some(shock => typeof shock !== 'string' || !Object.hasOwn(ingredients, shock)) || new Set(shocks).size !== shocks.length) {
    throw new Error('This recipe contains unsupported or repeated scenario ingredients.');
  }
  return {
    version: genomeVersion, atlasVersion: ATLAS_VERSION, modelVersion: ATLAS_MODEL_VERSION,
    seed, constructionSpeed, populationGrowth, land, energy, transport, constructionCost, shocks: [...shocks].sort(),
  };
}

const engine = createEngine();

export function runGenomeVariant(recipe, retainMonths = false) {
  const { seed, constructionSpeed, populationGrowth, land, energy, transport, constructionCost, shocks } = normalizeGenomeRecipe(recipe);
  const atlas = normalizeAtlasRecipe({ seed, constructionSpeed, populationGrowth });
  let state = createAtlasStart(atlas);
  state.parameters.constructionCost *= constructionCost;
  for (const parcel of state.parcels) parcel.capacity = Math.floor(parcel.capacity * land);
  for (const utility of state.utilities) {
    if (utility.type === 'electric') utility.capacity = Math.round(utility.capacity * energy);
  }
  for (const link of state.links) link.capacity = Math.max(1, Math.round(link.capacity * transport));
  for (const key of shocks) {
    const { label, ...shock } = ingredients[key];
    state = scheduleShock(state, shock);
  }
  const series = retainMonths ? [summarizeAtlasMonth(state)] : null;
  for (let month = 0; month < atlas.horizonMonths; month++) {
    state = engine.step(state).state;
    if (series) series.push(summarizeAtlasMonth(state));
  }
  return { modelVersion: state.version, metrics: series?.at(-1) ?? summarizeAtlasMonth(state), series };
}

export function compareGenome(input) {
  const recipe = normalizeGenomeRecipe(input);
  const baseline = normalizeGenomeRecipe({ ...ATLAS_DEFAULTS, seed: recipe.seed });
  const before = runGenomeVariant(baseline, true);
  const after = runGenomeVariant(recipe, true);
  const sensitivity = Object.keys(inputs).filter(key => recipe[key] !== baseline[key]).map(key => ({
    label: inputs[key],
    metrics: runGenomeVariant({ ...recipe, [key]: baseline[key] }).metrics,
  }));
  for (const key of recipe.shocks) {
    sensitivity.push({
      label: ingredients[key].label,
      metrics: runGenomeVariant({ ...recipe, shocks: recipe.shocks.filter(shock => shock !== key) }).metrics,
    });
  }
  return {
    recipe, modelVersion: after.modelVersion, baseline: before.metrics, edited: after.metrics,
    series: { baseline: before.series, edited: after.series }, sensitivity,
  };
}
