import { test, expect } from 'bun:test';
import { createShootoutPreflight } from '../world/metrics/architecture-shootout.js';

test('all 30 requested cases stay explicitly unmeasured', () => {
  const report = createShootoutPreflight();
  expect(report.status).toBe('blocked');
  expect(report.measurementPerformed).toBe(false);
  expect(new Set(report.cases.map(row => row.id)).size).toBe(30);
  for (const row of report.cases) {
    expect(row.status).toBe('blocked');
    expect(Object.values(row.metrics).every(value => value === null)).toBe(true);
    expect(row.validationErrors).toBeNull();
    expect(row.artifacts).toEqual([]);
  }
  for (const architecture of ['A', 'B', 'C', 'D', 'E']) {
    const rows = report.cases.filter(row => row.architecture === architecture);
    expect(rows.map(row => [row.residents, row.render])).toEqual(
      [10000, 100000, 1000000].flatMap(n => [[n, false], [n, true]]));
  }
});

test('seed-matched plans are repeatable and isolated', () => {
  const a = createShootoutPreflight({ seed: 0xffffffff });
  expect(a).toEqual(createShootoutPreflight({ seed: 0xffffffff }));
  a.cases[0].artifacts.push('untrusted');
  expect(createShootoutPreflight().cases[0].artifacts).toEqual([]);
  for (const seed of [-1, 0x100000000, 1.5, NaN, Infinity, '42', null]) {
    expect(() => createShootoutPreflight({ seed })).toThrow('uint32');
  }
});
