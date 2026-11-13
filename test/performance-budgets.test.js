import { test, expect } from 'bun:test';
import { budgets, checkBudgets } from '../scripts/performance/budgets.js';
import { BENCHMARK_SCENES } from '../world/render/bench/scenes.js';

test('every benchmark route and renderer has all three enforced budgets', () => {
  expect(Object.keys(budgets)).toEqual(BENCHMARK_SCENES);
  for (const renderers of Object.values(budgets)) for (const backend of ['webgl2', 'webgpu']) {
    const limits = renderers[backend];
    expect(Object.keys(limits)).toEqual(['loadMs', 'p95FrameMs', 'peakHeapBytes']);
    expect(checkBudgets(limits, limits)).toEqual([]);
    for (const key of Object.keys(limits)) {
      expect(checkBudgets({ ...limits, [key]: limits[key] + 1 }, limits)).toHaveLength(1);
      for (const invalid of [null, undefined, NaN, Infinity, -1])
        expect(checkBudgets({ ...limits, [key]: invalid }, limits)).toHaveLength(1);
    }
  }
  expect(checkBudgets({}, undefined)).toHaveLength(1);
});
