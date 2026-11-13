import { expect, test } from 'bun:test';
import { hazardTile, paintHazard } from '../world/storm/hazard-field.js';
import { compileStorm, normalizeStorm } from '../world/storm/scenario.js';

test('missing and invalid tiles remain unknown; zero remains a modeled dry value', () => {
  for (const value of [null, undefined, NaN, Infinity, -1]) expect(hazardTile([value], 0)).toMatchObject({ value: null, state: 'unknown', color: '#777777' });
  expect(hazardTile([], 4).state).toBe('unknown');
  expect(hazardTile([0], 0)).toMatchObject({ value: 0, state: 'modeled value', uncertain: true });
  expect(hazardTile([.1], 0, { sampled: true })).toMatchObject({ state: 'sampled estimate', color: '#328db2' });
  expect(hazardTile([.4], 0).color).toBe('#22649e');
});

test('compiled source drainage and deterministic paint preserve inputs and uncertainty patterns', () => {
  const recipe = normalizeStorm({ edits: [{ type: 'drain', cell: 498 }] });
  const input = compileStorm(recipe), before = input.drains.slice();
  expect(hazardTile(input.drains, 498).value).toBeCloseTo(.15);
  expect(hazardTile(compileStorm({}).drains, 498).value).toBe(0);
  function record() {
    const calls = [];
    const ctx = new Proxy({}, { set(target, key, value) { calls.push([key, value]); return true; }, get: (_, key) => (...args) => calls.push([key, ...args]) });
    paintHazard(ctx, { size: 2, values: [0, .1, null, .4], selected: 1, sampled: true });
    return calls;
  }
  expect(record()).toEqual(record());
  expect(record().filter(row => row[0] === 'lineTo').length).toBe(5);
  expect(input.drains).toEqual(before);
});
