import { expect, test } from 'bun:test';
import { createPacer, estimate, handleOptions, setCapacity } from '../world/invention/impact/model.js';
import { decodePlan, encodePlan, runPlan } from '../world/invention/model.js';

test('handle clamps/snaps only to catalog policies and preserves other manifest inputs', () => {
  const input = { seed: 7, months: 6, policies: ['housing-d0-3', 'transit-d1-8'] };
  for (const [value, capacity, cost] of [[-100, 4, 500000], [6, 4, 500000], [7, 8, 580000], [100, 12, 660000]]) {
    const next = setCapacity(input, value);
    expect(estimate(next)).toMatchObject({ capacity, cost, field: 'policies', policyId: `transit-d1-${capacity}` });
    expect(next.seed).toBe(7); expect(next.months).toBe(6);
    expect(next.policies).toContain('housing-d0-3');
    expect(decodePlan(encodePlan(next))).toEqual(next);
  }
  expect(input.policies).toEqual(['housing-d0-3', 'transit-d1-8']);
  expect(handleOptions('transit', 'd1')).toEqual([4, 8, 12]);
  expect(handleOptions('housing', 'd1')).toBeNull();
  expect(handleOptions('upzone', 'd1')).toBeNull();
  expect(handleOptions('transit', 'd0')).toBeNull();
});

test('invalid values and unsupported plans fail without modifying input', () => {
  const plan = setCapacity({}, 8);
  for (const value of [NaN, Infinity, -Infinity, '', null, '12']) expect(() => setCapacity(plan, value)).toThrow('finite');
  expect(() => estimate({})).toThrow('no supported');
  expect(() => setCapacity({ policies: ['unknown'] }, 4)).toThrow('unsupported');
  expect(estimate(plan).capacity).toBe(8);
});

test('executed outcome uses the exact recipe and deterministic City replay', () => {
  const plan = setCapacity({}, 12);
  const first = runPlan(plan);
  expect(first).toEqual(runPlan(decodePlan(encodePlan(plan))));
  expect(first.recipe).toEqual(plan);
  expect(first.final.month).toBe(14);
  expect(first.final.policyStages[0].id).toBe('transit-d1-12');
  expect(first.scenarioVersion).toBe('living-city-commute.v1');
  expect(estimate(plan).cost).toBe(240000);
});

test('pacing coalesces updates, records delays, cancels pending work and stops after disposal', () => {
  let callback, time = 0, requested = 0, paints = 0, cancelled = [];
  const pacer = createPacer({ request: fn => { callback = fn; return ++requested; }, cancel: id => cancelled.push(id), now: () => time, paint: () => paints++ });
  pacer.schedule(); pacer.schedule(); expect(requested).toBe(1);
  time = 40; callback(); expect(paints).toBe(1);
  expect(pacer.metrics).toMatchObject({ samples: 1, maxWaitMs: 40, slowFrames: 1 });
  pacer.schedule(); pacer.dispose(); pacer.dispose(); pacer.schedule();
  expect(cancelled).toEqual([2]); expect(requested).toBe(2); expect(pacer.metrics.cancelled).toBe(1);
});
