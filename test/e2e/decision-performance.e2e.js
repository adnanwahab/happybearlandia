import { test, expect } from '@playwright/test';
import { housingModel, createHousingScenarios } from '../../world/models/housing/index.js';

test('1,000 futures per scenario complete while HTTP and browser stay responsive', async ({ page, request }, testInfo) => {
  test.setTimeout(120000);
  await page.goto('/world/decision.html');
  await expect(page.locator('#parameter-permitting_months')).toBeVisible();
  const input = { schemaVersion: 'decision-experiment.v1', name: 'Performance acceptance',
    decision: 'Compare housing alternatives', modelId: housingModel.id, modelVersion: housingModel.version,
    seed: 42, runs: 1000, years: 10, scenarios: createHousingScenarios(), metadata: { test: 'performance' } };
  const created = await request.post('/api/decision-experiments', { data: input });
  expect(created.status()).toBe(201);
  const { experiment } = await created.json();
  const startedAt = performance.now();
  expect((await request.post(`/api/decision-experiments/${experiment.id}/start`)).ok()).toBe(true);
  await page.goto(`/world/decision.html?experiment=${experiment.id}`);
  const httpLatency = [], frameLatency = [], progress = [];
  let finished;
  while (performance.now() - startedAt < 90000) {
    const tick = performance.now();
    expect((await request.get('/api/config')).ok()).toBe(true);
    httpLatency.push(performance.now() - tick);
    frameLatency.push(await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(); requestAnimationFrame(() => resolve(performance.now() - start));
    })));
    const state = await (await request.get(`/api/decision-experiments/${experiment.id}`)).json();
    progress.push(state.experiment.progress.completed);
    if (['completed', 'failed', 'cancelled'].includes(state.experiment.status)) { finished = state.experiment; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  expect(finished?.status).toBe('completed');
  expect(finished.progress.failed).toBe(0);
  expect(finished.progress.completed).toBe(1000 * input.scenarios.length);
  expect(Math.max(...httpLatency)).toBeLessThan(2000);
  expect(Math.max(...frameLatency)).toBeLessThan(2000);
  const resultStarted = performance.now();
  const results = await request.get(`/api/decision-experiments/${experiment.id}/results`);
  expect(results.ok()).toBe(true);
  const payload = await results.json();
  expect(payload.runs).toHaveLength(1000 * input.scenarios.length);
  const measurements = { totalRuns: payload.runs.length, wallMs: Math.round(performance.now() - startedAt),
    engineElapsedMs: finished.progress.elapsedMs, maxHttpMs: Math.round(Math.max(...httpLatency)),
    maxFrameMs: Math.round(Math.max(...frameLatency)), resultFetchParseMs: Math.round(performance.now() - resultStarted),
    resultBytes: Buffer.byteLength(JSON.stringify(payload)), progressSamples: progress };
  await testInfo.attach('decision-performance.json', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  console.info('Decision performance:', JSON.stringify(measurements));
});
