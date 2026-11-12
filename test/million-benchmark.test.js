import { test, expect } from 'bun:test';
import { createState, step, digest, validate } from '../world/bench/million-kernel.js';
test('all supported sizes replay exactly and conserve energy', () => {
  for (const size of [10000, 100000, 1000000]) {
    const options = { size, steps: 3, seed: 42 }, a = createState(options), b = createState(options);
    for (let i = 0; i < options.steps; i++) { expect(step(a)).toEqual(step(b)); expect(digest(a).totalEnergy).toBe(size * 10); }
    expect(digest(a)).toEqual(digest(b));
    expect(a.energy).toEqual(b.energy);
  }
});
test('independent scalar first-tick oracle validates ordered transfers', () => {
  for (const seed of [0, 42, 0xffffffff]) {
    const state = createState({ size: 10000, steps: 1, seed });
    const offset = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) % 10000;
    const expected = Array(10000).fill(10);
    for (let j = 0; j < 10000; j += 2) { expected[(j+offset)%10000]--; expected[(j+offset+1)%10000]++; }
    expect(step(state)).toEqual({ agentUpdates: 10000, interactions: 5000 });
    expect(Array.from(state.energy)).toEqual(expected);
  }
});
test('bounds reject unsupported and ambiguous inputs', () => {
  for (const patch of [{ size: 4096 }, { steps: 0 }, { steps: 601 }, { steps: 1.5 }, { seed: -1 }, { seed: 2**32 }, { seed: NaN }])
    expect(() => validate({ size: 10000, steps: 1, seed: 42, ...patch })).toThrow();
});
test('empty donors never underflow or count no-op interactions', () => {
  const state = createState({ size: 10000, steps: 1, seed: 42 }); state.energy.fill(0);
  expect(step(state)).toEqual({ agentUpdates: 0, interactions: 0 }); expect(digest(state).totalEnergy).toBe(0);
});

test('compute phase exports measured samples and consistent counts', async () => {
  const { runPhase } = await import('../world/bench/million-browser.js');
  const options = { size: 10000, steps: 3, seed: 42 };
  const record = await runPhase(options, 'compute-only');
  const replay = await runPhase(options, 'compute-only');
  expect(record.finalState).toEqual(replay.finalState);
  expect(record.agentUpdates).toBe(30000);
  expect(record.interactions).toBe(15000);
  expect(record.independentlyUpdatedStates).toBe(10000);
  expect(record.renderedPointInstancesPerFrame).toBe(0);
  expect(record.samples.every(row => row.stepMs >= 0 && row.frameMs === null)).toBe(true);
  expect(record.peakMemory.bytes).toBeNull();
  expect(Number.isFinite(record.wallMs)).toBe(true);
  await expect(runPhase(options, 'invalid')).rejects.toThrow('Unknown phase');
});

test('CLI rejects invalid recipes before opening browser or writing a report', () => {
  const result = Bun.spawnSync([process.execPath, 'scripts/benchmark-million.js', '/private/tmp/she171-invalid-unused.json', '0']);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain('steps must be 1..600');
});
