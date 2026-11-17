import { test, expect } from 'bun:test';
import { checkAccuracy, validateModels } from '../scripts/validate-models.mjs';
import baseline from './fixtures/model-validation/houston.json';
const result = () => ({ dataset: { id: baseline.dataset }, modelVersion: baseline.modelVersion, seed: baseline.seed, runs: baseline.runs, successful: baseline.runs, failed: 0, metrics: [{ metricId: baseline.metric, observed: baseline.observed, count: baseline.runs, absoluteError: baseline.absoluteError }] });
test('accuracy rule accepts improvement and rejects regression, missing data and contract drift', () => {
  expect(checkAccuracy(result(), baseline).passed).toBe(true);
  const improved = result(); improved.metrics[0].absoluteError = 0;
  expect(checkAccuracy(improved, baseline).passed).toBe(true);
  for (const mutate of [r => r.metrics[0].absoluteError++, r => r.metrics = [], r => r.metrics[0].absoluteError = NaN, r => r.failed++, r => r.modelVersion = 'new', r => r.metrics[0].observed++]) {
    const bad = result(); mutate(bad);
    expect(() => checkAccuracy(bad, baseline)).toThrow('housing.houston-stock-error');
  }
});
test('validation retains accuracy and invariant failures and continues both checks', async () => {
  const bad = result(); bad.metrics[0].absoluteError++;
  const report = await validateModels({ diagnostic: async () => bad, replay: async () => ({caseCount: 1, mismatches: [{index:0, input:{seed:42}, message:'Housing assignment invariant'}]}) });
  expect(report.failures.map(row => row.rule)).toEqual(['housing.houston-stock-error','city.replay-invariants']);
  expect(report.failures[1].message).toBe('Housing assignment invariant');
});
