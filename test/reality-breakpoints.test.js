import { expect, test } from 'bun:test';
import { futureURL, PLAN_START_MONTH, runPlan } from '../world/invention/model.js';
import { normalizeBreakpoint, runBreakpoint } from '../world/invention/breakpoints/model.js';

test('the first hit stops the City engine at the exact step and retains original evidence', () => {
  const plan = { seed: 2911, months: 12, policies: [] };
  const rule = { metric: 'unemploymentRate', operator: 'gt', threshold: 20 };
  const actual = runBreakpoint(plan, rule);
  const baseline = runPlan(plan, { retainMonths: true });
  const first = baseline.series.find(row =>
    row.month > PLAN_START_MONTH && row.unemploymentRate * 100 > rule.threshold);
  const prior = baseline.series.find(row => row.month === first.month - 1);
  expect(actual.startMonth).toBe(PLAN_START_MONTH);
  expect(actual.month).toBe(6);
  expect(actual.hit.events).toEqual(first.events);
  expect(actual.hit.events.every(event => event.simulationTime === first.month)).toBe(true);
  expect(actual.previous).toEqual({ month: prior.month, value: prior.unemploymentRate * 100 });
  expect(actual.value).toBe(first.unemploymentRate * 100);
  expect(actual.tested).toBe(first.month - PLAN_START_MONTH);
  expect(actual.missing).toBe(0);
  expect(runBreakpoint(plan, rule)).toEqual(actual);

  const visited = [];
  const stopped = runPlan(plan, { stopWhen(row) {
    visited.push(row.month);
    return row.unemploymentRate * 100 > rule.threshold;
  } });
  expect(visited).toEqual([3, 4, 5, 6]);
  expect(stopped.stopped).toBe(true);
  expect(stopped.final.month).toBe(actual.month);
  expect(new URL(futureURL(actual.recipe, actual.month), 'http://localhost').searchParams.get('month')).toBe('6');
});

test('comparison boundaries, initial-state exclusion, no hit, and invalid input', () => {
  const plan = { seed: 2911, months: 3, policies: [] };
  const metric = 'unhoused';
  const inclusive = runBreakpoint(plan, { metric, operator: 'gte', threshold: 0 });
  expect(inclusive.month).toBe(PLAN_START_MONTH + 1);
  expect(inclusive.hit.value).toBe(0);
  expect(inclusive.previous).toEqual({ month: PLAN_START_MONTH, value: 0 });
  expect(inclusive.tested).toBe(1);

  const strict = runBreakpoint(plan, { metric, operator: 'gt', threshold: 0 });
  expect(strict).toMatchObject({ hit: null, month: PLAN_START_MONTH + 3, tested: 3, missing: 0, value: 0 });
  expect(() => normalizeBreakpoint({ metric, operator: 'gt', threshold: 0.1 })).toThrow('whole-number');
  expect(() => normalizeBreakpoint({ metric, operator: 'eq', threshold: 0 })).toThrow('comparison');
  expect(() => normalizeBreakpoint({ metric: 'unemploymentRate', operator: 'gt', threshold: 101 })).toThrow('range');
  expect(() => normalizeBreakpoint({ metric: 'publicBalance', operator: 'lt', threshold: null })).toThrow('numeric');
  expect(normalizeBreakpoint({ metric: 'publicBalance', operator: 'lt', threshold: -1 }).threshold).toBe(-1);
});

test('changing the threshold or plan reruns against fresh City state', () => {
  const plan = { seed: 2911, months: 12, policies: ['transit-d1-8'] };
  const rule = { metric: 'unemploymentRate', operator: 'gt', threshold: 12 };
  const early = runBreakpoint(plan, rule);
  const later = runBreakpoint(plan, { ...rule, threshold: 20 });
  expect(early.hit.month).toBe(3);
  expect(early.hit.policies).toEqual([{ id: 'transit-d1-8', stage: 'APPROVED' }]);
  expect(later.hit.month).toBeGreaterThan(early.hit.month);
  expect(runBreakpoint(plan, rule)).toEqual(early);
});
