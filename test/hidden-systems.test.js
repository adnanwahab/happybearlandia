import { expect, test } from 'bun:test';
import { BASELINE, compareHiddenSystems, normalizeRecipe, readRecipe } from '../world/hidden-systems/model.js';

test('permit and construction queues reconcile with recorded events and capacity', () => {
  const { baseline, adjusted } = compareHiddenSystems();
  for (const arm of [baseline, adjusted]) {
    expect(arm[0].permits.arrivals).toBeNull();
    expect(arm[0].construction.served).toBeNull();
    for (const row of arm.slice(1)) {
      for (const queue of [row.permits, row.construction]) {
        expect(queue.opening + queue.arrivals - queue.served).toBe(queue.closing);
      }
      const permits = row.resources.find(resource => resource.resource === 'permits');
      expect(row.permits.served).toBe(permits.used);
      expect(row.permits.served).toBeLessThanOrEqual(row.permits.capacity);
      expect(row.permits.waiting.every(({ months }) => Number.isInteger(months) && months >= 0)).toBe(true);
    }
  }
  expect(baseline[5].permits.closing).toBe(4);
  expect(adjusted[5].permits.closing).toBe(0);
  expect(baseline[5].construction.blocked.some(({ reason }) => reason === 'materials')).toBe(true);
});

test('same-seed capacity changes advance an actual building and housing placement', () => {
  const result = compareHiddenSystems();
  expect(result.baseline[0].household).toEqual(result.adjusted[0].household);
  const firstMove = arm => arm.find(row => row.household.move);
  const baselineMove = firstMove(result.baseline);
  const adjustedMove = firstMove(result.adjusted);
  expect([baselineMove.month, adjustedMove.month]).toEqual([28, 16]);
  for (const row of [baselineMove, adjustedMove]) {
    const project = row.projects.find(project => project.buildingId === row.household.buildingId);
    expect(project.stage).toBe('completion');
    expect(project.occupied).toBeGreaterThan(0);
    expect(project.events.some(event => event.eventType === 'PROJECT_COMPLETE')).toBe(true);
    expect(row.household.commuteOriginName).toBe('Riverside');
    expect(row.household.commuteMinutes).toBeGreaterThan(0);
  }
  expect(compareHiddenSystems(readRecipe(JSON.stringify(result.recipe)))).toEqual(result);
  const control = compareHiddenSystems({ ...BASELINE, months: 6 });
  expect(control.adjusted).toEqual(control.baseline);
  expect(() => normalizeRecipe({ materials: 0.6 })).toThrow('half-unit');
  expect(() => readRecipe('{"version":"old"}')).toThrow('unsupported version');
});
