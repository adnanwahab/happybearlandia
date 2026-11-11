import { expect, test } from 'bun:test';
import { ATLAS_DEFAULTS, ATLAS_MODEL_VERSION, runAtlasSample } from '../world/laboratory/atlas/model.js';
import { compareGenome, normalizeGenomeRecipe, runGenomeVariant } from '../world/laboratory/genome/model.js';

test('the default genome uses the same seed, inputs and outcomes as the Atlas', () => {
  const recipe = normalizeGenomeRecipe();
  expect(recipe).toMatchObject({
    seed: ATLAS_DEFAULTS.seed, constructionSpeed: ATLAS_DEFAULTS.constructionSpeed,
    populationGrowth: ATLAS_DEFAULTS.populationGrowth, modelVersion: ATLAS_MODEL_VERSION,
  });
  const result = compareGenome(recipe);
  expect(result.baseline).toEqual(runAtlasSample(ATLAS_DEFAULTS).final);
  expect(result.edited).toEqual(result.baseline);
  expect(result.sensitivity).toEqual([]);
});

test('Jenga removes each change independently and keeps the remaining recipe reproducible', () => {
  const selected = normalizeGenomeRecipe({
    seed: 51, constructionSpeed: 0.65, populationGrowth: 0.04, shocks: ['materials', 'flood'],
  });
  expect(selected.shocks).toEqual(['flood', 'materials']);
  const result = compareGenome(selected);
  expect(result.sensitivity.map(row => row.label)).toEqual([
    'Construction capacity', 'Population growth', 'Riverside flood', 'Materials shortage',
  ]);
  expect(result.sensitivity[0].metrics).toEqual(runGenomeVariant({
    ...selected, constructionSpeed: ATLAS_DEFAULTS.constructionSpeed,
  }).metrics);
  expect(result.sensitivity[2].metrics).toEqual(runGenomeVariant({
    ...selected, shocks: ['materials'],
  }).metrics);
  expect(compareGenome(JSON.parse(JSON.stringify(selected)))).toEqual(result);
  expect(() => normalizeGenomeRecipe({ shocks: ['flood', 'flood'] })).toThrow('repeated');
  expect(() => normalizeGenomeRecipe({ modelVersion: 'old' })).toThrow('unsupported version');
  expect(() => normalizeGenomeRecipe({ populationGrowth: 0.5 })).toThrow('growth');
}, 20000);
