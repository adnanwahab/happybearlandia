import { test, expect } from 'bun:test';
import { chooseLimits, assertLimits } from '../scripts/performance/first-interaction-budgets.mjs';
const samples = [100, 80, 120].map(n => ({jsBytes:n,readyMs:n,renderMs:n,peakHeapBytes:n}));
test('selects the worst cold sample with explicit headroom', () => {
  const limits = chooseLimits(samples);
  expect(limits).toEqual({ jsBytes:150,readyMs:150,renderMs:150,peakHeapBytes:150 });
  expect(() => assertLimits(limits)).not.toThrow();
});
test('missing samples or metrics cannot produce passing budgets', () => {
  expect(() => chooseLimits(samples.slice(1))).toThrow();
  for (const value of [undefined, null, NaN, Infinity, 0, -1]) {
    expect(() => chooseLimits([...samples.slice(1), {...samples[0], peakHeapBytes:value}])).toThrow();
  }
  expect(() => assertLimits({})).toThrow('Uncalibrated');
});
