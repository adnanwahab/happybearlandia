import { expect, test } from 'bun:test';
import { runSeedEnsemble, summarize, observe } from '../world/population/seed-ensemble.js';
import { createPopulationModel } from '../world/population/model.js';

const small = { seeds: [0, 4294967295], minutes: 60, sampleSize: 4, cases: [{ population: 10, representedPopulation: 10 }, { population: 20, representedPopulation: 20 }, { population: 10, representedPopulation: 20 }] };
test('summary matches independent arithmetic, retains missing counts and unavailable intervals', () => {
  const s = summarize([1, 2, null, 3, 4]);
  expect(s.n).toBe(4); expect(s.missing).toBe(1); expect(s.mean).toBe(2.5);
  expect(s.standardDeviation).toBeCloseTo(Math.sqrt(5 / 3), 12);
  expect(s.interval[0]).toBeCloseTo(1.15, 12); expect(s.interval[1]).toBeCloseTo(3.85, 12);
  expect(summarize([null]).mean).toBeNull(); expect(summarize([2]).interval).toBeNull();
  expect(() => summarize([NaN])).toThrow();
});
test('real production entry points replay, pair seeds and preserve distinct comparison designs', () => {
  const report = runSeedEnsemble(small);
  expect(report).toEqual(runSeedEnsemble(small));
  expect(report.rows.length).toBe(18);
  for (const row of report.rows) {
    expect(Object.values(row.invariants).every(Boolean)).toBe(true);
    expect(row.clockInvariant).toBe(true);
    expect(row.counts.representedPeople).toBe(row.config.representedPopulation);
    expect(row.samples.camera.n).toBe(4);
  }
  for (const group of report.groups) {
    for (const stats of Object.values(group.arms[0].pairedBaselineDelta)) expect(stats.mean === 0 || stats.mean === null).toBe(true);
    // Independent reduction from raw paired records, not the summary implementation.
    const rows = report.rows.filter(r => r.caseId === group.caseId);
    const delta = small.seeds.map(seed => rows.find(r => r.seed === seed && r.arm === 'rent-15pct').metrics.personMeanHousingBurden - rows.find(r => r.seed === seed && r.arm === 'baseline').metrics.personMeanHousingBurden);
    expect(group.arms[1].pairedBaselineDelta.personMeanHousingBurden.mean).toBeCloseTo((delta[0] + delta[1]) / 2, 12);
  }
  expect(report.comparisons.some(c => c.kind === 'resolution' && c.caseId === '10/20')).toBe(true);
  expect(report.comparisons.some(c => c.kind === 'population-size' && c.caseId === '10/10')).toBe(true);
});
test('full display sample has zero selection error; no trips are unavailable; membership corruption fails', () => {
  const model = createPopulationModel({ population: 10 });
  const row = observe(model, 100);
  expect(row.metrics.plannedTripMinutes).toBeNull();
  expect(row.samples.systematic.error).toBeCloseTo(0, 12);
  expect(row.samples.camera.error).toBeCloseTo(0, 12);
  model.people.household[0] = 99999;
  expect(() => observe(model, 2)).toThrow('membership');
});
test('reject invalid or unbounded study requests before running', () => {
  for (const options of [{ seeds: [1] }, { seeds: [1, 1] }, { seeds: [-1, 2] }, { minutes: 1441 }, { sampleSize: 0 }, { cases: [{ population: 1001, representedPopulation: 1001 }] }, { cases: [small.cases[0], small.cases[0]] }]) expect(() => runSeedEnsemble(options)).toThrow();
});
test('person-weighted burden matches an independent hand-computed fixture', () => {
  const model = createPopulationModel({ population: 10, householdSize: 2.5 });
  // Four households of sizes 3,3,2,2. First pays all annual income in rent;
  // others pay zero. The full person mean must be 3/10, not 1/4.
  model.households.income.fill(1200); model.households.rent.fill(0);
  model.households.rent[0] = 100;
  const row = observe(model, 10);
  expect(row.metrics.personMeanHousingBurden).toBeCloseTo(.3, 12);
  expect(row.samples.camera.mean).toBeCloseTo(.3, 12);
  expect(() => runSeedEnsemble({ seed: 123 })).toThrow('Unknown');
  expect(() => runSeedEnsemble({ cases: [{ population: 10, representedPopulation: 10, rentMultiplier: 2 }] })).toThrow('Cases accept only');
});
