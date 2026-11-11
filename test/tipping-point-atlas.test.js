import { expect, test } from 'bun:test';
import { createEngine, cityMetrics } from '../world/city/engine.js';
import {
  atlasSampleURL, ATLAS_LIMITS, ATLAS_VERSION, classifyAtlasHousing, createAtlasStart,
  createAtlasSweep, normalizeAtlasRecipe, readAtlasSampleURL, runAtlasCell, runAtlasSample,
} from '../world/laboratory/atlas/model.js';

test('atlas cells are real City runs with matched seeds and an exact reproducible snapshot', () => {
  const sweep = createAtlasSweep({ seed: 0xffffffff, horizonMonths: 12, households: 30 });
  expect(sweep.sampleCount).toBe(75);
  expect(sweep.seeds).toEqual([0xffffffff, 0, 1]);
  expect([sweep.speeds[0], sweep.speeds.at(-1)]).toEqual(ATLAS_LIMITS.constructionSpeed);
  expect([sweep.growthRates.at(-1), sweep.growthRates[0]]).toEqual(ATLAS_LIMITS.populationGrowth);
  const position = sweep.cells[4];
  const cell = runAtlasCell(sweep, position);
  expect(cell.samples.map(sample => sample.seed)).toEqual(sweep.seeds);
  expect(Object.values(cell.counts).reduce((a, b) => a + b, 0)).toBe(3);

  const recipe = normalizeAtlasRecipe({
    ...sweep.recipe, seed: cell.samples[0].seed,
    constructionSpeed: cell.constructionSpeed, populationGrowth: cell.populationGrowth,
  });
  const link = atlasSampleURL(recipe, 7);
  const request = readAtlasSampleURL(new URL(link, 'http://localhost').searchParams);
  expect(request).toEqual({ recipe, month: 7 });
  const exact = runAtlasSample(request.recipe);
  const start = createAtlasStart(recipe);
  expect(start.parameters).toMatchObject({ annualGrowth: recipe.populationGrowth, labor: 3 * recipe.constructionSpeed });
  expect(start.projects).toHaveLength(6);
  const independentlyRun = createEngine().run(start, 12).state;
  expect(exact.final).toMatchObject(cityMetrics(independentlyRun));
  expect(exact.series).toHaveLength(13);
  expect(exact.series[7].month).toBe(request.month);
  expect(cell.samples[0]).toMatchObject(cityMetrics(independentlyRun));
  expect(cell.samples[0].classification).toBe(classifyAtlasHousing(exact.final));
  expect(runAtlasSample(recipe)).toEqual(exact);
});

test('the default fixture responds to construction capacity and growth through the engine', () => {
  const lowSpeed = runAtlasSample({ constructionSpeed: 0.25, populationGrowth: -0.02 });
  const highSpeed = runAtlasSample({ constructionSpeed: 2.5, populationGrowth: -0.02 });
  const highGrowth = runAtlasSample({ constructionSpeed: 2.5, populationGrowth: 0.05 });
  expect(lowSpeed.initial).toEqual(highSpeed.initial);
  expect(lowSpeed.final.completedProjects).toBeLessThan(highSpeed.final.completedProjects);
  expect(highSpeed.final.households).toBeLessThan(highGrowth.final.households);
  expect(classifyAtlasHousing(highSpeed.final)).toBe('adequate');
  expect(classifyAtlasHousing(highGrowth.final)).toBe('severe');
});

test('classification boundaries, large sweep budget and malformed recipes are explicit', () => {
  expect(classifyAtlasHousing({ households: 20, unhoused: 1, availableUnits: 2, housingUnits: 25 })).toBe('severe');
  expect(classifyAtlasHousing({ households: 20, unhoused: 0, availableUnits: 1, housingUnits: 21 })).toBe('tight');
  expect(classifyAtlasHousing({ households: 19, unhoused: 0, availableUnits: 1, housingUnits: 20 })).toBe('adequate');
  expect(createAtlasSweep({ preset: 'extended' }).sampleCount).toBe(2023);
  expect(() => createAtlasSweep({ preset: 'unlimited' })).toThrow('sweep size');
  expect(() => normalizeAtlasRecipe({ constructionSpeed: 0 })).toThrow('construction capacity');
  expect(() => normalizeAtlasRecipe({ populationGrowth: Infinity })).toThrow('annual growth');
  expect(() => atlasSampleURL({}, 90)).toThrow('snapshot month');
  expect(() => readAtlasSampleURL('version=' + ATLAS_VERSION)).toThrow('City model version');
  expect(readAtlasSampleURL('')).toBeNull();
});
