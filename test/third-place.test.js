import { test, expect } from 'bun:test';
import { SCENARIO, VERSION, compareProject, validateProject, replayComparison } from '../world/invention/third-place/model.js';

test('pinned park/plaza challenge validates and preserves matched immutable design checkpoints', () => {
  const source = JSON.stringify(SCENARIO);
  for (const project of ['park', 'plaza']) {
    expect(validateProject(project)).toBeDefined();
    const result = compareProject(project);
    expect(result.version).toBe(VERSION);
    expect(result.before.seed).toBe(708);
    expect(result.after.seed).toBe(result.before.seed);
    expect(result.before.lotId).toBe(result.after.lotId);
    expect(result.before.firstYearUSD).toBe(0);
    expect(result.after.firstYearUSD).toBe(project === 'park' ? 66000 : 90000);
    expect(result.after.remainingUSD + result.after.firstYearUSD).toBe(100000);
    expect(Object.isFrozen(result.after.outcomes.social)).toBe(true);
    expect(Object.isFrozen(result.scenario.permitted)).toBe(true);
    for (const checkpoint of [result.before, result.after]) for (const metric of Object.values(checkpoint.outcomes)) {
      expect(metric.status).toBe('unavailable'); expect(metric.value).toBeNull();
    }
    expect(replayComparison(JSON.stringify(result))).toEqual(result);
    expect(compareProject(project)).toEqual(result);
  }
  expect(JSON.stringify(SCENARIO)).toBe(source);
});

test('unsupported actions, no source and replay corruption never produce replacement results', () => {
  expect(() => compareProject('stadium')).toThrow('not permitted');
  expect(() => compareProject('park', null)).toThrow('No source data');
  expect(() => compareProject('park', { ...SCENARIO, budgetUSD: 1 })).toThrow('Unsupported source');
  expect(() => validateProject('__proto__')).toThrow('not permitted');
  const original = compareProject('park');
  for (const mutate of [
    r => { r.after.firstYearUSD = 0; },
    r => { r.after.seed++; },
    r => { r.after.outcomes.visits = { status: 'available', value: 20 }; },
    r => { r.before.project = 'plaza'; },
    r => { r.version = 'future'; },
    r => { r.scenario = null; },
    r => { r.extra = true; },
  ]) {
    const bad = structuredClone(original); mutate(bad);
    expect(() => replayComparison(JSON.stringify(bad))).toThrow();
  }
  expect(() => replayComparison('{')).toThrow('Invalid replay JSON');
  expect(() => replayComparison(' '.repeat(8193))).toThrow('8192');
  expect(original).toEqual(compareProject('park'));
});
