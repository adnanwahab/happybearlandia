import { expect, test } from 'bun:test';
import { stableSoftmax, weightedUtility } from '../world/behavior/core/utility.js';
import { seededChoice } from '../world/behavior/core/choice.js';
import { createBehaviorModel } from '../world/behavior/core/behavior-model.js';
import { getBehaviorCoefficients } from '../world/behavior/coefficients/registry.js';

test('stable utility probabilities tolerate extreme scores and prefer higher utility', () => {
  for (const scores of [[10000, 10001], [-10000, -9999], [0, 1]]) {
    const p = stableSoftmax(scores);
    expect(p[1]).toBeGreaterThan(p[0]);
    expect(p.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
  }
  expect(stableSoftmax([])).toEqual([]);
  expect(() => stableSoftmax([NaN])).toThrow();
  expect(() => stableSoftmax([1], 0)).toThrow();
});

test('unavailable alternatives cannot win, even with arbitrarily attractive scores', () => {
  const alternatives = [{ id: 'full', available: false, utility: 1e12, rejectionReason: 'CAPACITY_FULL' }, { id: 'rail', utility: 2 }, { id: 'car', utility: 1 }];
  let rail = 0;
  for (let n = 0; n < 1000; n++) {
    const result = seededChoice(alternatives, { draw: n / 1000 });
    expect(result.chosen).not.toBe('full');
    if (result.chosen === 'rail') rail++;
  }
  expect(rail).toBeGreaterThan(700);
  expect(rail).toBeLessThan(760);
  const choice = seededChoice(alternatives, { draw: 0.25 });
  expect(seededChoice(alternatives, { draw: 0.25 })).toEqual(choice);
  expect(choice.alternatives[0].probability).toBe(0);
  expect(choice.alternatives[0].rejectionReason).toBe('CAPACITY_FULL');
  expect(seededChoice([{ id: 'none', available: false }], { draw: 0 })).toMatchObject({ chosen: null });
  for (const draw of [-1, 1, NaN]) expect(() => seededChoice(alternatives, { draw })).toThrow();
});

test('behavior interface applies eligibility before invoking the scoring function', () => {
  const evaluated = [];
  const model = createBehaviorModel({ id: 'fixture', version: '1', getAlternatives: () => [{ id: 'full' }, { id: 'open' }],
    filterEligible: (_actor, rows) => rows.filter(row => row.id === 'open'),
    score: (_actor, row) => { evaluated.push(row.id); return { utility: 1 }; },
  });
  const result = model.evaluate({}, {}, { draw: 0.99 });
  expect(evaluated).toEqual(['open']);
  expect(result.chosen).toBe('open');
  expect(result.alternatives[0]).toMatchObject({ available: false, rejectionReason: 'HARD_CONSTRAINT' });
});

test('coefficient sources remain assumptions and numerical components sum to utility', () => {
  const registry = getBehaviorCoefficients('mode-choice-v1');
  expect(registry.source).toBe('analyst-assumption');
  expect(registry.calibrationDataset).toBeNull();
  const result = weightedUtility({ travelTime: 25, monetaryCost: 3 }, registry.coefficients);
  const worse = weightedUtility({ travelTime: 45, monetaryCost: 12 }, registry.coefficients);
  expect(result.utility).toBeGreaterThan(worse.utility);
  expect(result.utility).toBe(Object.values(result.components).reduce((a, b) => a + b));
  expect(() => getBehaviorCoefficients('missing')).toThrow();
});
