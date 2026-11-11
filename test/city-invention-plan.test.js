import { expect, test } from 'bun:test';
import {
  decodePlan, encodePlan, futureURL, normalizePlan, planCost, PLAN_START_MONTH, POLICY_CATALOG, runPlan,
} from '../world/invention/model.js';

test('City plans preserve compatible policies and replay their exact simulated commute', () => {
  const plan = normalizePlan({ seed: 2911, policies: ['transit-d1-8', 'upzone-d2-12'] });
  const url = new URL(futureURL(plan, 10), 'http://localhost');
  expect(decodePlan(url.searchParams.get('plan'))).toEqual(plan);
  expect(url.searchParams.get('month')).toBe('10');
  expect(planCost(plan)).toBe(190000);
  expect(POLICY_CATALOG).toHaveLength(18);

  const baseline = runPlan({ seed: plan.seed });
  const replay = runPlan(plan, { retainMonths: true });
  expect(replay.series).toHaveLength(plan.months + 1);
  expect(replay.start.meanCommuteMinutes).toBe(baseline.start.meanCommuteMinutes);
  expect(replay.final.meanCommuteMinutes).toBeLessThan(baseline.final.meanCommuteMinutes);
  expect(replay.final.districts.map(row => row.name)).toEqual(['Center', 'Riverside', 'Uptown']);
  expect(replay.final.districts.reduce((sum, row) => sum + row.commuteCount, 0)).toBe(replay.final.commuteCount);
  expect(runPlan(decodePlan(encodePlan(plan)), { retainMonths: true })).toEqual(replay);
});

test('a plan can stop after the exact first matching month and validates its supported input space', () => {
  const visited = [];
  const run = runPlan({}, {
    retainMonths: true,
    stopWhen: row => {
      visited.push(row.month);
      return row.month === 5;
    },
  });
  expect(run.stopped).toBe(true);
  expect(visited).toEqual([3, 4, 5]);
  expect(run.start.month).toBe(PLAN_START_MONTH);
  expect(run.final).toEqual(run.series.at(-1));
  expect(run.final).toEqual(runPlan({}, { retainMonths: true }).series[3]);
  expect(() => normalizePlan({ policies: ['transit-d1-4', 'transit-d1-8'] })).toThrow('only one');
  expect(() => normalizePlan({ policies: ['road-d1-4'] })).toThrow('unsupported');
  expect(() => decodePlan(JSON.stringify({ seed: 42 }))).toThrow('missing');
  expect(() => futureURL({}, 1)).toThrow('horizon');
});
