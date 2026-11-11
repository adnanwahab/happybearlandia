import { expect, test } from 'bun:test';
import { compileRecordedFutureSearch as compile } from '../world/decision/backlog-search/index.js';
import { housingModel, createHousingScenarios, simulateHousingRun } from '../world/models/housing/index.js';
const metrics = [{ id: 'median_rent', label: 'Median monthly rent', unit: 'USD/month' }, { id: 'vacancy_rate', label: 'Vacancy', unit: 'fraction' }];
const run = { id: 'r', status: 'completed', seed: 0, scenarioId: 'baseline', modelVersion: 'v1', metrics: { median_rent: 1800, vacancy_rate: .06 }, monthlyTimeline: [{ month: 0, metrics: { median_rent: 2100 } }, { month: 12, metrics: { median_rent: 1800 } }], events: [{ month: 12, label: 'Construction delay' }] };
test('typed grammar, scope, percentages and evidence preserve exact records', () => {
  const query = compile('find futures where rent below 2k USD/month and vacancy above 5% and seed 0 and scenario baseline and model version v1', metrics);
  expect(query.error).toBeUndefined(); expect(query.test(run)).toBe(true);
  expect(query.explain(run).source).toMatchObject({ runId: 'r', seed: 0, month: 'final' });
  expect(query.explain(run).evidence.find(row => row.metricId === 'vacancy_rate').threshold).toBe(.05);
  expect(query.test({ ...run, seed: 1 })).toBe(false);
});
test('unsupported and ambiguous language never becomes a predictive or event query', () => {
  for (const text of ['make rent cheaper', 'rent < 2k minutes', 'rent < 10%', 'vacancy > $2', 'rent < 20 or rent > 30', 'x'.repeat(1001), 'seed -1', 'at month 1.5']) expect(compile(text, metrics).error).toBeTruthy();
  expect(compile('rent < 2000', [...metrics, { id: 'other_rent', label: 'Median monthly rent', unit: 'USD/month' }]).error).toBeUndefined(); // explicit alias wins
  expect(compile('monthly < 2000', [...metrics, { id: 'other', label: 'Monthly costs', unit: 'USD' }]).error).toBeTruthy();
  expect(compile('seed 1', metrics, { seed: 0 }).error).toBeTruthy();
});
test('exact recorded months, missing values, duplicate observations and no future events', () => {
  expect(compile('at month 0 and rent below 2000', metrics).test(run)).toBe(false);
  expect(compile('at month 12 and rent below 2000', metrics).test(run)).toBe(true);
  expect(compile('at month 1 and rent below 2000', metrics).explain(run).status).toBe('missing');
  expect(compile('rent below 2000', metrics).explain({ ...run, metrics: {} }).status).toBe('missing');
  expect(compile('at month 12', metrics).explain({ ...run, monthlyTimeline: [...run.monthlyTimeline, run.monthlyTimeline[1]] }).status).toBe('missing');
  expect(compile('at month 0 and event: construction delay', metrics).test(run)).toBe(false);
  expect(compile('at month 12 and event: construction delay', metrics).test(run)).toBe(true);
  expect(compile('at month 12 and event: delay', metrics).explain({ ...run, events: ['delay'] }).status).toBe('missing');
  expect(compile('at month 12 and success', metrics).explain(run).status).toBe('missing');
  expect(compile('', metrics).test({ ...run, status: 'failed' })).toBe(false);
});
test('actual housing model output remains immutable and searchable without generated outcomes', () => {
  const scenario = createHousingScenarios()[0];
  const result = simulateHousingRun({ scenario, seed: 42, years: 1 });
  const stored = { ...result, id: 'actual-housing', seed: 42, scenarioId: scenario.id, modelVersion: housingModel.version, status: 'completed' };
  const before = JSON.stringify(stored);
  const value = result.monthlyTimeline[12].metrics.median_rent;
  const query = compile(`at month 12 and median_rent = ${value} USD/month and seed 42`, housingModel.metrics);
  expect(query.error).toBeUndefined(); expect(query.test(stored, scenario)).toBe(true);
  expect(query.explain(stored, scenario).evidence.find(row => row.metricId === 'median_rent').value).toBe(value);
  expect(JSON.stringify(stored)).toBe(before);
});

import { createDecisionStore } from '../world/decision/store.js';
import { searchStoredDecisionResults } from '../world/decision/backlog-search/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('searches reloaded versioned records through the existing private store contract', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'backlog-search-'));
  try {
    const store = createDecisionStore({ directory });
    await store.save({ experiment: { id: 'stored-search', modelId: 'housing', modelVersion: 'v1', scenarios: [{ id: 'baseline' }] }, runs: [run, { ...run, id: 'pending', status: 'running' }] });
    const loaded = await store.load('stored-search');
    const result = searchStoredDecisionResults(loaded, 'rent < 2000 USD/month and seed 0 and model version v1', metrics);
    expect(result.results.map(row => row.status)).toEqual(['match', 'missing']);
    expect(result.results[0].source.experimentId).toBe('stored-search');
    expect(result.results[0].run).toBe(loaded.runs[0]);
    expect(searchStoredDecisionResults(loaded, 'predict prosperity', metrics).error).toBeTruthy();
    expect(() => searchStoredDecisionResults({ runs: Array(8001) }, '', metrics)).toThrow('8000');
    expect((await store.load('stored-search')).runs).toEqual(loaded.runs);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('ordinary bounded phrases and numeric boundaries retain exact typed comparisons', () => {
  const definitions = [...metrics, { id: 'public_expenditure', label: 'Cost', unit: 'USD' }];
  for (const [query, value, expected] of [
    ['show me futures where rent is at most $2,000 USD/month', 2000, true],
    ['find worlds with rent greater than $-2', 0, true],
    ['rent >= $-2.5 USD/month', -2.5, true],
    ['rent < -2.5', -2.5, false],
    ['rent = 0', -0, true],
    ['rent = 0.0000001', .0000001, true],
    ['rent > 1000000000000000000000', 1e22, true],
    ['rent <= 2000', 2000.00001, false],
  ]) {
    const compiled = compile(query, definitions);
    expect(compiled.error).toBeUndefined();
    expect(compiled.test({ ...run, metrics: { median_rent: value } })).toBe(expected);
  }
  expect(compile('cost < 2b USD', definitions).test({ ...run, metrics: { public_expenditure: 1999999999 } })).toBe(true);
  expect(compile('vacancy = -5%', metrics).test({ ...run, metrics: { vacancy_rate: -.05 } })).toBe(true);
  expect(compile('vacancy = 5 fraction', metrics).test({ ...run, metrics: { vacancy_rate: 5 } })).toBe(true);
  for (const query of ['rent > -$2', 'rent < 12,34', 'rent > NaN', 'rent > Infinity', 'rent > 1e3', 'rent > 2 euros', 'rent > $2 USD', 'rent > 2 USD/month please', `rent > ${'9'.repeat(320)}`]) expect(compile(query, definitions).error).toBeTruthy();
});
test('exact IDs outrank ambiguous aliases and all selected scope conflicts fail closed', () => {
  const ambiguous = [...metrics, { id: 'annual_rent', label: 'Rent', unit: 'USD/year' }];
  expect(compile('rent < 2000', ambiguous).error).toContain('ambiguous');
  expect(compile('median_rent < 2000', ambiguous).test(run)).toBe(true);
  expect(compile('median_rent < 2000', [...metrics, { id: 'different', label: 'median_rent', unit: 'USD' }]).test(run)).toBe(true);
  for (const [query, scope] of [['seed 1', { seed: 0 }], ['scenario alternative', { scenarioId: 'baseline' }], ['model version v2', { modelVersion: 'v1' }], ['at month 2', { month: 1 }]]) expect(compile(query, metrics, scope).error).toContain('conflicts');
  for (const query of ['seed 4294967296', 'at month 601', 'seed 0 and seed 1', 'at month 0 and at month 1', Array(13).fill('rent > 0').join(' and '), 'rent < 1 and', 'rent is cheaper', 'what if we build homes']) expect(compile(query, metrics).error).toBeTruthy();
  expect(compile('seed 4294967295', metrics).test({ ...run, seed: 4294967295 })).toBe(true);
  expect(compile('model version v1', metrics).explain({ ...run, modelVersion: undefined }).status).toBe('missing');
});
