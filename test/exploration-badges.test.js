import { test, expect } from 'bun:test';
import { createBadgeStore, inspectionBadges, BADGE_KEY } from '../world/decision/exploration-badges.js';
import { housingModel, createHousingScenarios } from '../world/models/housing/index.js';
const fixture = () => {
  const scenarios = createHousingScenarios();
  return { model: housingModel, experiment: { status: 'completed', modelId: housingModel.id, modelVersion: housingModel.version, scenarios }, runs: scenarios.map(s => ({ scenarioId: s.id, seed: 42, metrics: { public_expenditure: 100, affordability: 60 } })) };
};
const memory = () => { const values = new Map(); return { values, getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }; };
test('completed matched results recognize distinct supported levers independent of outcome quality', () => {
  const data = fixture();
  const ids = inspectionBadges(data);
  expect(ids).toContain('tradeoffs');
  expect(ids).toContain('permitting_months');
  expect(new Set(ids).size).toBe(ids.length);
  data.runs.forEach(r => { r.metrics.affordability = -100; });
  expect(inspectionBadges(data)).toEqual(ids);
});
test('rejects preview, pending, unsupported version, missing and unmatched observations', () => {
  for (const mutate of [d => d.experiment.status = 'running', d => d.experiment.metadata = {preview:true}, d => d.experiment.modelVersion = 'unknown', d => d.runs = [], d => d.runs[0].seed = 9, d => d.runs[0].metrics.affordability = null]) {
    const data = fixture(); mutate(data); expect(inspectionBadges(data)).toEqual([]);
  }
});
test('unchanged alternatives do not award policy exploration', () => {
  const data = fixture(); data.experiment.scenarios.forEach(s => s.parameters = {...data.experiment.scenarios[0].parameters});
  expect(inspectionBadges(data)).toEqual(['tradeoffs']);
});
test('idempotent awards survive reload and persist only allowlisted identifiers', () => {
  const storage = memory(), store = createBadgeStore(storage);
  expect(store.award(['permitting_months','permitting_months','tradeoffs','person@example.com'])).toEqual(['permitting_months','tradeoffs']);
  expect(store.award(['tradeoffs'])).toEqual([]);
  const reopened = createBadgeStore(storage);
  expect(reopened.award(['permitting_months'])).toEqual([]);
  expect(JSON.parse(storage.getItem(BADGE_KEY))).toEqual({version:1,badges:['permitting_months','tradeoffs']});
  reopened.clear(); expect(createBadgeStore(storage).badges).toEqual([]);
});
test('malformed or unavailable storage cannot interrupt exploration', () => {
  const storage = memory(); storage.setItem(BADGE_KEY,'{');
  expect(createBadgeStore(storage).badges).toEqual([]);
  const store = createBadgeStore({getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}});
  expect(store.award(['tradeoffs'])).toEqual(['tradeoffs']);
  expect(store.award(['tradeoffs'])).toEqual([]);
  expect(store.persistent).toBe(false); store.clear(); expect(store.badges).toEqual([]);
});
