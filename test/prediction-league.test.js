import { expect, test } from 'bun:test';
import { encodePlan, normalizePlan, PLAN_START_MONTH, runPlan } from '../world/invention/model.js';
import { createPrediction, PREDICTION_VERSION, resolvePrediction } from '../world/learning/prediction.js';

const plan = normalizePlan({ seed: 2911, months: 12, policies: ['transit-d1-8'] });
const now = '2026-11-10T00:00:00.000Z';

test('commitment pins a plan, display unit, time, and the actual City result scores without mutating it', () => {
  const prediction = createPrediction(plan, { metric: 'meanCommuteMinutes', expected: -2.25 }, now);
  expect(prediction).toMatchObject({
    version: PREDICTION_VERSION,
    planKey: encodePlan(plan),
    expected: -2.25,
    month: PLAN_START_MONTH + plan.months,
    createdAt: now,
  });
  expect(Object.isFrozen(prediction.plan.policies)).toBe(true);
  const baseline = runPlan({ ...plan, policies: [] });
  const adjusted = runPlan(plan);
  const resolution = resolvePrediction(prediction, baseline, adjusted);
  expect(resolution.state).toBe('scored');
  expect(resolution.actual).toBeCloseTo(adjusted.final.meanCommuteMinutes - baseline.final.meanCommuteMinutes);
  expect(resolution.absoluteError).toBeCloseTo(Math.abs(resolution.actual - prediction.expected));
  expect(resolution.score).toBeCloseTo(Math.max(0, 100 * (1 - resolution.absoluteError / 10)));
  expect(prediction).not.toHaveProperty('actual');
});

test('point scale, signed percentage-point delta, and missing observation behavior', () => {
  const month = PLAN_START_MONTH + plan.months;
  const baseline = { recipe: { ...plan, policies: [] }, final: { month, unemploymentRate: .18 } };
  const adjusted = { recipe: plan, final: { month, unemploymentRate: .15 } };
  const exact = createPrediction(plan, { metric: 'unemploymentRate', expected: -3 }, now);
  expect(resolvePrediction(exact, baseline, adjusted)).toMatchObject({
    state: 'scored', baseline: 18, adjusted: 15, actual: -3, absoluteError: 0, score: 100,
  });
  const off = createPrediction(plan, { metric: 'unemploymentRate', expected: 2 }, now);
  expect(resolvePrediction(off, baseline, adjusted).score).toBe(50);
  const far = createPrediction(plan, { metric: 'unemploymentRate', expected: 10 }, now);
  expect(resolvePrediction(far, baseline, adjusted).score).toBe(0);
  expect(resolvePrediction(exact, baseline, { ...adjusted, final: { month, unemploymentRate: null } })).toMatchObject({
    state: 'unavailable', baseline: 18, adjusted: null, actual: null, absoluteError: null, score: null,
  });

  const commute = createPrediction(plan, { metric: 'meanCommuteMinutes', expected: 0 }, now);
  const emptyTrips = { month, meanCommuteMinutes: 0, commuteCount: 0 };
  expect(resolvePrediction(commute, { ...baseline, final: emptyTrips }, { ...adjusted, final: emptyTrips }).score)
    .toBeNull();
});

test('invalid input and cross-plan, control, or date mismatches are rejected', () => {
  expect(() => createPrediction(null, { metric: 'meanRent', expected: 0 }, now)).toThrow('City plan');
  expect(() => createPrediction(plan, { metric: 'unsupported', expected: 0 }, now)).toThrow('supported City metric');
  expect(() => createPrediction(plan, { metric: 'housingUnits', expected: 0.5 }, now)).toThrow('whole-number change');
  expect(() => createPrediction(plan, { metric: 'meanRent', expected: Infinity }, now)).toThrow('Enter a change');
  expect(() => createPrediction(plan, { metric: 'meanRent', expected: 0 }, 'bad date')).toThrow('commitment time');

  const prediction = createPrediction(plan, { metric: 'meanRent', expected: 0 }, now);
  const baseline = runPlan({ ...plan, policies: [] });
  const adjusted = runPlan(plan);
  expect(() => resolvePrediction(prediction, baseline, { ...adjusted, final: { ...adjusted.final, month: 7 } }))
    .toThrow('target month');
  expect(() => resolvePrediction(prediction, adjusted, adjusted)).toThrow('control');
  expect(() => resolvePrediction(prediction, baseline, { ...adjusted, recipe: { ...plan, seed: 2912 } }))
    .toThrow('committed plan');
  expect(() => resolvePrediction({ ...prediction, createdAt: undefined }, baseline, adjusted)).toThrow('commitment time');
});
