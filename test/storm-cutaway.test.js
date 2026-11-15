import { expect, test } from 'bun:test';
import { depthProfile } from '../world/storm/cutaway.js';
import { compileStorm, normalizeStorm } from '../world/storm/scenario.js';
import { simulateWater } from '../world/storm/physics.js';

test('fixed depth profile preserves zero, missing, thresholds and overflow', () => {
  const depth = [0, .099, .1, .4, 1.5, null, NaN, -1, Infinity];
  const before = depth.slice();
  const rows = depthProfile({ size: 3, selected: 4, depth });
  expect(rows.map(r => r.cell)).toEqual([3, 4, 5]);
  expect(rows[0]).toMatchObject({ color: '#22649e', height: .4, overflow: false });
  expect(rows[1]).toMatchObject({ value: 1.5, height: 1, overflow: true, selected: true });
  expect(rows[2]).toMatchObject({ value: null, height: null, state: 'unknown' });
  expect(depthProfile({ size: 3, selected: 0, depth }).map(r => r.color)).toEqual(['#dae4cf', '#70c9d7', '#328db2']);
  expect(depthProfile({ size: 3, selected: 8, depth }).every(r => r.value === null)).toBe(true);
  expect(depth).toEqual(before);
});

test('empty, unsupported and absent fields do not manufacture water', () => {
  for (const frame of [undefined, {}, { size: 0, selected: 0 }, { size: 129, selected: 0 }, { size: 2, selected: -1 }, { size: 2, selected: 4 }]) expect(depthProfile(frame)).toEqual([]);
  expect(depthProfile({ size: 2, selected: 0 }).map(r => r.state)).toEqual(['unknown', 'unknown']);
});

test('seed matched solver frames yield identical profiles without mutating run data', () => {
  const input = compileStorm(normalizeStorm({ seed: 517, steps: 3 }));
  const first = simulateWater(input), second = simulateWater(input);
  const before = JSON.stringify(first);
  for (let tick = 3; tick >= 0; tick--) {
    const frame = { size: input.size, selected: 498, depth: first.frames[tick] };
    expect(depthProfile(frame)).toEqual(depthProfile({ ...frame, depth: second.frames[tick] }));
  }
  expect(JSON.stringify(first)).toBe(before);
});
