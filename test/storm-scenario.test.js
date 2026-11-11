import { expect, test } from 'bun:test';
import { consequences, runStormEnsemble } from '../world/storm/compare.js';
import { simulateWater } from '../world/storm/physics.js';
import { compileStorm, CROSSING_CELL, CROSSING_DRAINS, normalizeStorm, readStorm, stormCost } from '../world/storm/scenario.js';

test('the demonstration closes Low Crossing and matched drainage keeps it open', () => {
  const original = normalizeStorm();
  const branch = readStorm(JSON.stringify(normalizeStorm({ ...original, edits: CROSSING_DRAINS })));
  const baseline = consequences(simulateWater(compileStorm(original)));
  const adjusted = consequences(simulateWater(compileStorm(branch)));
  expect(branch.rainRate).toBe(original.rainRate);
  expect(stormCost(branch)).toBe(480000);
  expect(baseline.totals.closedRoads).toBe(1);
  expect(adjusted.totals.closedRoads).toBe(0);
  expect(baseline.totals.floodedBuildings).toBe(5);
  expect(adjusted.totals.floodedBuildings).toBe(4);
  expect(baseline.events.some(event => event.entityId === 'low-crossing' && event.status === 'closed')).toBe(true);
  expect(adjusted.events.some(event => event.entityId === 'low-crossing' && event.status === 'closed')).toBe(false);
});

test('edits are validated and only change the selected layer', () => {
  const start = compileStorm();
  const raised = compileStorm({ edits: [{ type: 'road', cell: CROSSING_CELL }] });
  const detention = compileStorm({ edits: [{ type: 'basin', cell: 0 }] });
  expect(raised.terrain[CROSSING_CELL] - start.terrain[CROSSING_CELL]).toBeCloseTo(0.35);
  expect(start.terrain[0] - detention.terrain[0]).toBeCloseTo(0.45);
  expect(raised.drains).toEqual(start.drains);
  expect(() => normalizeStorm({ edits: [{ type: 'basin', cell: CROSSING_CELL }] })).toThrow('unbuilt');
  expect(() => normalizeStorm({ edits: [{ type: 'road', cell: 0 }] })).toThrow('road cell');
  expect(() => readStorm('{"version":"old"}')).toThrow('Unsupported');
});

test('the ensemble compares 100 same-rain pairs and is deterministic', () => {
  const completed = [];
  const input = { edits: CROSSING_DRAINS };
  const metrics = runStormEnsemble(input, sample => completed.push(sample));
  expect(completed.at(-1)).toBe(100);
  expect(metrics).toEqual(runStormEnsemble(input));
  expect(metrics.closedRoads.improved).toBeGreaterThan(0);
  for (const row of Object.values(metrics)) expect(row.improved + row.unchanged + row.worsened).toBe(100);
}, 20000);
