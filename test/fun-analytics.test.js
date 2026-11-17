import {test, expect} from 'bun:test';
import {FUN_METRICS} from '../world/universe/fun-analytics.js';
test('all five metrics define explicit units and denominators without inferring enjoyment', () => {
  expect(FUN_METRICS.map(m => m.id)).toEqual(['activation','experiments','replays','returns','enjoyment']);
  for (const metric of FUN_METRICS) {
    expect(metric.numerator.length).toBeGreaterThan(20);
    expect(metric.denominator.length).toBeGreaterThan(20);
    expect(Object.isFrozen(metric)).toBe(true);
  }
  expect(FUN_METRICS[3].denominator).toContain('full seven-day');
  expect(FUN_METRICS[4].denominator).toContain('explicit');
});
