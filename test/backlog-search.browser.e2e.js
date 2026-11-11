import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { housingModel, createHousingScenarios } from '../world/models/housing/index.js';

async function savedResults(request) {
  const created = await request.post('/api/decision-experiments', { data: {
    name: 'Recorded search browser acceptance', modelId: housingModel.id, modelVersion: housingModel.version,
    seed: 0, runs: 2, years: 1, scenarios: createHousingScenarios().slice(0, 2), metadata: { synthetic: true, purpose: 'search mechanics, not calibration' },
  } });
  expect(created.status()).toBe(201);
  const { experiment } = await created.json();
  expect((await request.post(`/api/decision-experiments/${experiment.id}/start`)).ok()).toBe(true);
  await expect.poll(async () => (await (await request.get(`/api/decision-experiments/${experiment.id}`)).json()).experiment.status).toBe('completed');
  const response = await request.get(`/api/decision-experiments/${experiment.id}/results`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function plotted(page) {
  return page.locator('[data-viz="landscape"] [data-run-id]').evaluateAll(nodes => nodes.map(node => node.dataset.runId).sort());
}

test('actual saved Decision Studio search agrees with records and retains selection/replay identity', async ({ page, request }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const results = await savedResults(request);
  await page.goto(`/world/decision.html?experiment=${results.experiment.id}&readonly=1#futures`);
  const search = page.locator('[data-control="search"]');
  await expect(search).toBeVisible();
  await expect.poll(() => plotted(page)).toEqual(results.runs.map(run => run.id).sort());
  const target = results.runs.find(run => run.status === 'completed');
  // Normal UI loads monthly traces on selection; do not inject full records.
  const initialPoint = page.locator(`[data-viz="landscape"] [data-run-id="${target.id}"]`);
  await initialPoint.focus(); await initialPoint.press('Enter');
  await expect.poll(() => page.evaluate(id => window.hblDecisionStudio.state.results.runs.find(run => run.id === id)?.monthlyTimeline?.length || 0, target.id)).toBe(13);
  const month = 6, threshold = target.monthlyTimeline.find(row => row.month === month).metrics.median_rent + 1;
  const query = `show me futures where rent below ${threshold} USD/month and scenario ${target.scenarioId} and seed ${target.seed} and model version ${target.modelVersion} and at month ${month}`;
  // Independent oracle uses the saved exact month, never compiler output.
  const expected = results.runs.filter(run => run.status === 'completed' && run.scenarioId === target.scenarioId && run.seed === target.seed && run.modelVersion === target.modelVersion && run.monthlyTimeline.find(row => row.month === month)?.metrics.median_rent < threshold).map(run => run.id).sort();
  await search.fill(query);
  await expect.poll(() => plotted(page)).toEqual(expected);
  await expect(page.locator('[data-search-note]')).toContainText(/month 6/);
  const point = page.locator(`[data-viz="landscape"] [data-run-id="${target.id}"]`);
  await point.focus(); await point.press('Enter');
  await expect(page.locator('[data-run-summary]')).toContainText(target.id);
  const replay = page.getByLabel('Replay year', { exact: true });
  await replay.fill('6'); await replay.dispatchEvent('input');
  await page.locator('[data-control="enter"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('run')).toBe(target.id);
  expect(new URL(page.url()).searchParams.get('month')).toBe('6');
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(results.experiment.id);
  await expect(page.locator('#open-neighborhood-world')).toHaveAttribute('href', new RegExp(`decisionRun=${target.id}.*month=6`));
  await page.locator('.decision-viz .dv-panel').first().screenshot({ path: info.outputPath('search-results.png') });
  await page.locator('[data-viz="replay"]').screenshot({ path: info.outputPath('selected-recorded-future.png') });
  const evidencePath = info.outputPath('saved-search-evidence.json');
  await writeFile(evidencePath, JSON.stringify({ sourceRoot: process.env.HBL_SEARCH_SOURCE_ROOT || 'current search worktree', experiment: results.experiment.id, query, expected, selected: target.id, seed: target.seed, modelVersion: target.modelVersion, month, threshold, url: page.url() }, null, 2));
  await info.attach('saved-search-evidence.json', { path: evidencePath, contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('actual Decision search displays invalid-query feedback and recovers', async ({ page, request }, info) => {
  const results = await savedResults(request);
  await page.goto(`/world/decision.html?experiment=${results.experiment.id}&readonly=1#futures`);
  const search = page.locator('[data-control="search"]');
  await expect(search).toBeVisible();
  for (const query of ['predict a happy city', 'rent < 2000 minutes', 'seed 0 and seed 1']) {
    await search.fill(query);
    await expect(page.locator('[data-search-note]')).toContainText(/unsupported|expected|conflicts/i);
    await expect.poll(() => plotted(page)).toEqual([]);
  }
  await search.fill('rent > 0 USD/month');
  await expect.poll(() => plotted(page)).toEqual(results.runs.filter(run => run.metrics.median_rent > 0).map(run => run.id).sort());
  await page.locator('.decision-viz .dv-panel').first().screenshot({ path: info.outputPath('search-recovered.png') });
});
