import { expect, test } from 'bun:test';
import fixture from './fixtures/storm/commander-demo.json';
import { DEMO, SOURCE, runCommander, replayCommander, schedule } from '../world/storm/commander.js';
import { simulateWater } from '../world/storm/physics.js';

test('pinned authored success and standard-only failure use actual flooded parcels', async () => {
  const source = JSON.stringify(SOURCE);
  const success = await runCommander(DEMO);
  expect(success).toEqual(fixture);
  expect(success.success).toBe(true);
  expect(success.baseline.parcels.map(row => row.floodedTicks)).toEqual([12, 21, 2]);
  expect(success.adjusted.parcels.map(row => row.floodedTicks)).toEqual([0, 0, 0]);
  expect(success.dispatch.cost).toBe(960000);
  const failed = await runCommander(['standard', 'standard', 'standard']);
  expect(failed.success).toBe(false);
  expect(failed.protectedBlocks).toBe(2);
  expect(failed.dispatch.jobs[2].installed).toBe(false);
  expect(failed.baseline).toEqual(success.baseline);
  expect(JSON.stringify(SOURCE)).toBe(source);
  expect(Object.isFrozen(success.adjusted.depths[60])).toBe(true);
  expect(Object.isFrozen(success.source.recipe.edits)).toBe(true);
});

test('bounded dispatch rejects invalid and over-budget inputs; empty plan loses', async () => {
  for (const plan of [[], ['express', 'express', 'express'], ['skip', 'invalid', 'skip'], null]) {
    expect(() => schedule(plan)).toThrow();
  }
  const empty = await runCommander(['skip', 'skip', 'skip']);
  expect(empty.protectedBlocks).toBe(0);
  expect(empty.adjusted).toEqual(empty.baseline);
});

test('recorded checkpoints replay exactly and mismatches are refused', async () => {
  expect(await replayCommander(fixture)).toEqual(fixture);
  for (const alter of [r => r.adjusted.depths[60][0]++, r => r.source.recipe.seed++,
    r => r.protectedBlocks = 99, r => r.modelVersion = 'future']) {
    const changed = structuredClone(fixture); alter(changed);
    await expect(replayCommander(changed)).rejects.toThrow('Replay mismatch');
  }
  await expect(replayCommander(null)).rejects.toThrow('Replay mismatch');
});

test('cancel, absent source, missing frames and solver failures never score', async () => {
  const controller = new AbortController();
  await expect(runCommander(DEMO, { signal: controller.signal,
    yieldControl: async () => controller.abort() })).rejects.toThrow('Cancelled');
  await expect(runCommander(DEMO, { source: null })).rejects.toThrow('No source data');
  await expect(runCommander(DEMO, { solver: () => null })).rejects.toThrow('No source data');
  await expect(runCommander(DEMO, { solver: input => {
    const water = simulateWater(input); water.frames[10][334] = NaN; return water;
  } })).rejects.toThrow('No source data');
  await expect(runCommander(DEMO, { solver: () => { throw new Error('solver failed'); } })).rejects.toThrow('solver failed');
});


test('cancellation after baseline prevents adjusted execution and scoring', async () => {
  const controller = new AbortController();
  let calls = 0, yields = 0;
  await expect(runCommander(DEMO, { signal: controller.signal,
    yieldControl: async () => { if (++yields === 2) controller.abort(); },
    solver: input => { calls++; return simulateWater(input); }
  })).rejects.toThrow('Cancelled');
  expect(calls).toBe(1);
});
