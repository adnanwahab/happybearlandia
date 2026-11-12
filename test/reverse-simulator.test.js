import { expect, test } from 'bun:test';
import { decodePlan, futureURL, POLICY_CATALOG, runPlan } from '../world/invention/model.js';
import {
  buildReverseSearch, normalizeReverseGoal, reverseFrontier, runReverseSearch,
} from '../world/invention/reverse/model.js';

const transitOptions = POLICY_CATALOG.filter(policy => policy.type === 'transit').map(policy => policy.id);

test('search enumerates compatible catalog options within budget and counts omissions', () => {
  const search = buildReverseSearch({ budget: 1e9, allowedPolicies: [...transitOptions].reverse() });
  // Each of three districts can select one of three transit options or leave it alone.
  expect(search.candidates).toHaveLength(4 ** 3 - 1);
  expect(search.outsideBudget).toBe(0);
  expect(search.omitted).toBe(0);
  const narrow = buildReverseSearch({ budget: 100_000, allowedPolicies: transitOptions });
  expect(narrow.candidates.map(({ cost }) => cost)).toEqual([80_000, 80_000, 80_000]);
  expect(narrow.outsideBudget).toBe(search.candidates.length - narrow.candidates.length);
  const limited = buildReverseSearch({ budget: 1e9 });
  expect(limited.candidates).toHaveLength(128);
  expect(limited.omitted).toBeGreaterThan(0);
  expect(() => normalizeReverseGoal({ allowedPolicies: ['road-expansion'] })).toThrow('supported policies');
  expect(() => normalizeReverseGoal({ budget: -1 })).toThrow('maximum budget');
  expect(() => normalizeReverseGoal({ targetReductionPercent: 101 })).toThrow('commute reduction');
});

test('a feasible search reports real same-seed monthly results and exact future links', () => {
  const updates = [];
  const input = { targetReductionPercent: 25, budget: 200_000, allowedPolicies: transitOptions };
  const report = runReverseSearch(input, update => updates.push(update));
  expect(report.state).toBe('feasible');
  expect(report.completed).toBe(9);
  expect(report.feasibleCount).toBeGreaterThan(0);
  expect(updates[0]).toMatchObject({ completed: 0, total: report.completed });
  expect(updates.at(-1)).toMatchObject({ completed: report.completed, total: report.completed });
  const base = runPlan({ ...report.goal.baseline, retainMonths: false });
  expect(report.baseline).toEqual(base.final);
  for (const plan of report.frontier) {
    expect(plan.cost).toBeLessThanOrEqual(input.budget);
    expect(plan.reduction).toBeGreaterThanOrEqual(input.targetReductionPercent);
    expect(plan.recipe.seed).toBe(base.recipe.seed);
    const url = new URL(futureURL(plan.recipe, plan.final.month), 'http://localhost');
    const replay = runPlan(decodePlan(url.searchParams.get('plan')), { retainMonths: true });
    const atMonth = replay.series.find(row => row.month === Number(url.searchParams.get('month')));
    expect(atMonth).toMatchObject(plan.final);
    expect(plan.reduction).toBeCloseTo(100 * (base.final.meanCommuteMinutes - atMonth.meanCommuteMinutes) / base.final.meanCommuteMinutes);
  }
  expect(runReverseSearch(input)).toEqual(report);
});

test('unmet searches expose honest fallbacks and the frontier keeps housing trade-offs', () => {
  const report = runReverseSearch({ budget: 0, targetReductionPercent: 25, allowedPolicies: transitOptions });
  expect(report).toMatchObject({ state: 'unmet', completed: 0, feasibleCount: 0, outsideBudget: 63 });
  expect(report.frontier[0]).toMatchObject({ recipe: { policies: [] }, reduction: 0, feasible: false });
  expect(runReverseSearch({ budget: 0, targetReductionPercent: 0 }).state).toBe('feasible');

  const row = (cost, reduction, commute, unhoused) => ({
    cost, reduction, final: { meanCommuteMinutes: commute, unhoused },
  });
  const cheapest = row(100, 20, 12, 3);
  const bestHousing = row(110, 10, 15, 0);
  const dominated = row(120, 18, 13, 4);
  const unavailable = row(0, null, null, 0);
  expect(reverseFrontier([dominated, bestHousing, cheapest, unavailable])).toEqual([cheapest, bestHousing]);
});

test('the largest search can admit the full compatible catalog within a sufficient budget', () => {
  const result = buildReverseSearch({ budget: 200_000_000, candidateLimit: 4096 });
  expect(result.candidates).toHaveLength(2556);
  expect(result.omitted).toBe(0);
  expect(result.outsideBudget).toBe(0);
});
