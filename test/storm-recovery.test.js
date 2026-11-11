import { expect, test } from 'bun:test';
import { consequences } from '../world/storm/compare.js';
import { simulateWater } from '../world/storm/physics.js';
import { simulateRecovery } from '../world/storm/recovery.js';
import { compileStorm } from '../world/storm/scenario.js';

const impact = consequences(simulateWater(compileStorm({ rainRate: 0.0016 })));

test('route reopening unlocks an isolated clinic and shelters reachable households', () => {
  const actions = ['building/riverside-clinic', 'road/depot-spur', 'shelter'];
  const control = simulateRecovery(impact);
  const result = simulateRecovery(impact, { actions });
  expect(result.timeline[1].events.map(event => event.jobId)).toEqual(['road/depot-spur']);
  expect(result.timeline[3].events.map(event => event.jobId)).toEqual(['road/depot-spur', 'building/riverside-clinic']);
  expect(result.timeline.at(-1).operatingServices).toBe(1);
  expect(result.timeline.at(-1).shelteredHouseholds).toBe(12);
  expect(control.timeline.at(-1).operatingServices).toBe(0);
  expect(control.timeline.at(-1).shelteredHouseholds).toBe(0);
  expect(impact.buildings.find(row => row.id === 'riverside-clinic').lastExposure).toBe('flooded');
  expect(simulateRecovery(impact, { actions })).toEqual(result);
});

test('accepted aid adds a parallel crew and respects the combined response budget', () => {
  const actions = ['building/riverside-clinic', 'road/depot-spur', 'shelter'];
  const aid = { accepted: true, crews: 1, price: 55000 };
  const result = simulateRecovery(impact, { actions, aid });
  expect(result.timeline[1].events.map(event => event.jobId)).toEqual(['road/depot-spur', 'shelter']);
  expect(result.timeline[3].shelteredHouseholds).toBe(12);
  expect(result.timeline.at(-1).spent).toBe(150000);
  expect(() => simulateRecovery(impact, { actions: [...actions, 'building/depot-clinic'], aid: { accepted: true, crews: 2, price: 95000 } })).toThrow('budget');
  expect(() => simulateRecovery(impact, { actions: ['shelter', 'shelter'] })).toThrow('unique');
});
