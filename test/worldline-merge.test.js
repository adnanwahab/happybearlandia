import { expect, test } from 'bun:test';
import { encodePlan, futureURL, normalizePlan, PLAN_DEFAULTS, runPlan } from '../world/invention/model.js';
import { mergePlans, readFutureLink, runMerge } from '../world/invention/merge/merge.js';

const left = { ...PLAN_DEFAULTS, months: 20, policies: ['transit-d1-8'] };
const right = { ...left, policies: ['housing-d0-3'] };

test('merge runs independent baseline, source, and merged City policies from the same seed', () => {
  const result = runMerge(left, right);
  const { arms } = result;
  expect(arms.merged.recipe.policies).toEqual(['housing-d0-3', 'transit-d1-8']);
  expect(arms.baseline.recipe.policies).toEqual([]);
  expect(arms.merged.final).toEqual(runPlan(arms.merged.recipe).final);
  expect(arms.left.final).toEqual(runPlan(left).final);
  expect(arms.right.final).toEqual(runPlan(right).final);
  expect(arms.merged.cost).toBe(580000);
  expect(result.interactions.housingUnits).toBe(arms.merged.final.housingUnits - arms.left.final.housingUnits -
    arms.right.final.housingUnits + arms.baseline.final.housingUnits);
  for (const arm of Object.values(arms)) {
    expect(readFutureLink(arm.href)).toEqual(arm.recipe);
    expect(new URL(arm.href, 'https://hbl.test').searchParams.get('month')).toBe('22');
  }
  expect(mergePlans(right, left).merged).toEqual(arms.merged.recipe);
});

test('shared policies deduplicate while competing scopes and incompatible runs fail', () => {
  const shared = runMerge(left, { ...right, policies: [...right.policies, ...left.policies] });
  expect(shared.shared).toEqual(left.policies);
  expect(shared.arms.merged.cost).toBe(580000);
  expect(shared.interactions).toBeNull();
  expect(() => mergePlans(left, { ...right, seed: 7 })).toThrow('different seeds');
  expect(() => mergePlans(left, { ...right, months: 12 })).toThrow('different horizons');
  expect(() => mergePlans(left, { ...right, policies: ['transit-d1-4'] })).toThrow('Competing choices');
  expect(() => mergePlans({ ...left, modelVersion: 'stale' }, right)).toThrow('unsupported version');
  expect(mergePlans(left, { ...right, policies: ['transit-d2-4'] }).merged.policies).toEqual([
    'transit-d1-8', 'transit-d2-4',
  ]);
});

test('future links are decoded locally and require a unique versioned recipe', () => {
  const url = new URL(futureURL(left), 'https://hbl.test');
  expect(readFutureLink(url.href)).toEqual(normalizePlan(left));
  url.searchParams.append('plan', encodePlan(right));
  expect(() => readFutureLink(url.href)).toThrow('exactly one plan recipe');
  expect(() => readFutureLink('/world/causal.html?runId=demo')).toThrow('City future link');
  expect(() => readFutureLink('/world/invention/future/?plan=%7B%7D')).toThrow('missing its version');
});
