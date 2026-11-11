import { expect, test } from 'bun:test';
import { simulateWater, WATER_MODEL_VERSION } from '../world/storm/physics.js';
import { simulateWaterGPU } from '../world/storm/gpu.js';

test('flat closed grid retains uniform rain and accounts for all water', () => {
  const result = simulateWater({ size: 3, rainRate: 0.125, steps: 4 });
  expect(result).toMatchObject({ backend: 'CPU', modelVersion: WATER_MODEL_VERSION, size: 3, steps: 4 });
  expect(result.frames).toHaveLength(5);
  expect(result.frames[0]).toEqual(new Float32Array(9));
  for (let step = 1; step < result.frames.length; step++) {
    expect(result.frames[step]).toEqual(new Float32Array(9).fill(step * 0.125));
    expect(result.accounting[step]).toEqual({
      step, rainAdded: step * 9 * 0.125, drained: 0, stored: step * 9 * 0.125, residual: 0,
    });
  }
});

test('water transfers downhill across shared edges without wrapping the grid', () => {
  const result = simulateWater({ size: 2, rainRate: 1, steps: 1, terrain: [2, 0, 2, 0] });
  expect([...result.frames[1]]).toEqual([0.75, 1.25, 0.75, 1.25]);

  const terrain = new Float32Array(9);
  terrain[2] = 10;
  const drains = new Float32Array(9).fill(1);
  drains[2] = 0;
  const edge = simulateWater({ size: 3, terrain, drains, rainRate: 1, steps: 1 });
  expect([...edge.frames[1]]).toEqual([0, 0.25, 0.5, 0, 0, 0.25, 0, 0, 0]);
  expect(edge.accounting[1]).toEqual({ step: 1, rainAdded: 9, drained: 8, stored: 1, residual: 0 });
  expect(terrain[2]).toBe(10);
  expect(drains[2]).toBe(0);
});

test('drains cap local removal and stay stable through varied terrain and multiple steps', () => {
  const size = 32;
  const terrain = Float32Array.from({ length: size ** 2 }, (_, i) => Math.sin(i * 0.712) * 2 - i / 1024);
  const drains = Float32Array.from(terrain, (_, i) => i % 17 === 0 ? 0.15 : 0);
  const result = simulateWater({ size, terrain, drains, rainRate: 0.043, steps: 180 });
  expect(result.frames[0]).toEqual(new Float32Array(1024));
  let previousDrained = 0;
  for (const record of result.accounting) {
    expect(record.drained).toBeGreaterThanOrEqual(previousDrained);
    expect(record.drained).toBeLessThanOrEqual(record.rainAdded + 1e-4);
    expect(Math.abs(record.residual)).toBeLessThan(Math.max(1e-4, record.rainAdded * 1e-5));
    previousDrained = record.drained;
  }
  expect(result.frames.every(frame => frame.every(depth => Number.isFinite(depth) && depth >= 0))).toBe(true);
  expect(result.accounting.at(-1).drained).toBeGreaterThan(0);
  expect(result.accounting.at(-1).stored).toBeGreaterThan(0);
});

test('input and frame bounds are shared between CPU and GPU', async () => {
  expect(simulateWater({ steps: 0 }).frames).toHaveLength(1);
  expect(() => simulateWater({ size: 129 })).toThrow('Grid size');
  expect(() => simulateWater({ rainRate: -0.1 })).toThrow('Rain rate');
  expect(() => simulateWater({ size: 2, terrain: [0, 0, 0] })).toThrow('4 entries');
  expect(() => simulateWater({ size: 2, terrain: [Infinity, 0, 0, 0] })).toThrow('Terrain');
  await expect(simulateWaterGPU({ steps: 241 })).rejects.toThrow('Step count');
  await expect(simulateWaterGPU({ size: 2, drains: [0, -1, 0, 0] })).rejects.toThrow('Drain field');
});
