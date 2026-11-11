import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createHousingScenarios, housingModel } from '../world/models/housing/index.js';
import { createBuildingProposal } from '../world/buildings/proposal.js';

// Real production API, persisted experiment, real model, no mocked outputs.
async function savedPair(request) {
  const scenarios = createHousingScenarios().filter(s => ['baseline', 'plan-a'].includes(s.kind));
  scenarios.find(s => s.kind === 'plan-a').projects = [createBuildingProposal({ id: 'browser-comparison-tower', status: 'approved' })];
  const recipe = { schemaVersion: 'decision-experiment.v1', name: 'Comparison browser acceptance', decision: 'Compare recorded housing construction', modelId: housingModel.id, modelVersion: housingModel.version, seed: 0, runs: 10, years: 10, scenarios };
  const created = await request.post('/api/decision-experiments', { data: recipe }); expect(created.ok()).toBe(true);
  const { experiment } = await created.json();
  expect((await request.post(`/api/decision-experiments/${experiment.id}/start`, { data: {} })).ok()).toBe(true);
  let results;
  await expect.poll(async () => { const response = await request.get(`/api/decision-experiments/${experiment.id}/results`); expect(response.ok()).toBe(true); results = await response.json(); return results.experiment.status; }, { timeout: 60000 }).toBe('completed');
  const selected = results.runs.find(run => run.scenarioId === 'plan-a' && run.status === 'completed');
  const baseline = results.runs.find(run => run.scenarioId === 'baseline' && run.seed === selected.seed);
  expect(baseline).toBeTruthy();
  const completion = selected.projects[0].states.find(row => row.completedUnits > 0)?.month;
  expect(completion).toBeGreaterThan(0);
  return { recipe, results, selected, baseline, completion };
}
const widths = (process.env.HBL_COMPARISON_WIDTHS || '390,320').split(',').map(Number);
for (const width of widths) test(`saved housing comparison ${width}px hydrates paired traces and reverses`, async ({ page, request }, testInfo) => {
  const evidence = await savedPair(request), { results, selected, baseline, completion } = evidence;
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const observations = [];
  const traces = []; page.on('response', response => { if (/\/runs\//.test(response.url()) && response.ok()) traces.push(response.url()); });
  await page.addInitScript(() => document.addEventListener('housing-comparison:inspect', event => { window.__housingInspection = event.detail; }));
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/world/decision.html?experiment=${results.experiment.id}&run=${selected.id}&readonly=1#futures`);
  const view = page.getByRole('region', { name: 'Paired stored housing scenes' });
  // Deliberate integration gate: never mount the module directly from the test.
  await expect(view, 'Coordinator must wire the production Advanced Studio mount').toBeVisible();
  writeFileSync(testInfo.outputPath('actual-housing-records.json'), JSON.stringify(evidence, null, 2));
  await testInfo.attach('actual-housing-records', { path: testInfo.outputPath('actual-housing-records.json'), contentType: 'application/json' });
  await view.screenshot({ path: testInfo.outputPath('initial-production-comparison.png') });
  const slider = view.getByRole('slider', { name: 'Paired housing month' });
  for (const month of [0, completion, 0]) {
    await slider.fill(String(month)); await slider.dispatchEvent('input');
    await view.screenshot({ path: testInfo.outputPath(`before-assertions-${width}-month-${month}.png`) });
    const a = baseline.monthlyTimeline.find(row => row.month === month), b = selected.monthlyTimeline.find(row => row.month === month);
    await expect(view.getByRole('status')).toContainText(`Month ${month}`);
    await expect(view.getByRole('status')).toContainText(`seed ${selected.seed}`);
    await expect(view.getByRole('status')).toContainText(`model ${selected.modelVersion}`);
    const texts = await view.locator('svg > g > text').allTextContents();
    for (const [index, row] of [a,b].entries()) {
      const format = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
      await expect(view.locator('svg > g').nth(index)).toContainText(`${format(row.metrics.housing_supply)} homes · vacancy ${format(row.metrics.vacancy_rate)}%`);
    }
    expect(texts.some(text => /vacancy/.test(text) && !/Missing/.test(text))).toBe(true);
    const project = view.locator('[data-project-id="browser-comparison-tower"]');
    await expect(project).toHaveCount(1); await project.focus(); await expect(project).toBeFocused(); await page.keyboard.press('Enter');
    const state = selected.projects[0].states.find(row => row.month === month);
    const receipt = await page.evaluate(() => window.__housingInspection);
    expect.soft(receipt).toEqual({ runId: selected.id, projectId: 'browser-comparison-tower', month, state });
    observations.push({ month, receipt, baselineMetrics: a.metrics, selectedMetrics: b.metrics });
    await expect(project).toHaveAttribute('aria-label', new RegExp(`${state.completedUnits} completed homes`));
    await view.screenshot({ path: testInfo.outputPath(`housing-${width}-month-${month}.png`) });
    expect(await view.locator('svg').evaluate(el => el.getBoundingClientRect().width <= innerWidth)).toBe(true);
  }
  expect(traces.some(url => url.includes(encodeURIComponent(selected.id)))).toBe(true);
  expect(traces.some(url => url.includes(encodeURIComponent(baseline.id)))).toBe(true);
  writeFileSync(testInfo.outputPath('acceptance-receipts.json'), JSON.stringify({ experimentId: results.experiment.id, seed: selected.seed, modelVersion: selected.modelVersion, observations, traces, errors }, null, 2));
  await testInfo.attach('acceptance-receipts', { path: testInfo.outputPath('acceptance-receipts.json'), contentType: 'application/json' });
  await page.evaluate(() => window.hblDecisionStudio.advancedStudio.destroy()); await expect(view).toHaveCount(0); expect(errors).toEqual([]);
});

test('missing baseline trace remains missing in the production comparison', async ({ page, request }, testInfo) => {
  const { results, selected, baseline, completion } = await savedPair(request), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Network failure injection only; never substitute synthetic model/API data.
  let aborted = 0;
  await page.route(`**/runs/${encodeURIComponent(baseline.id)}`, route => { aborted++; return route.abort('failed'); });
  await page.goto(`/world/decision.html?experiment=${results.experiment.id}&run=${selected.id}&readonly=1#futures`);
  const view = page.getByRole('region', { name: 'Paired stored housing scenes' }); await expect(view).toBeVisible();
  const slider = view.getByRole('slider', { name: 'Paired housing month' }); await slider.fill(String(completion)); await slider.dispatchEvent('input');
  await expect(view).toContainText('Missing'); await expect(view).toContainText('No exact recorded snapshot');
  writeFileSync(testInfo.outputPath('missing-trace-records.json'), JSON.stringify({ experimentId: results.experiment.id, selectedId: selected.id, baselineId: baseline.id, seed: selected.seed, modelVersion: selected.modelVersion, month: completion, abortedRequests: aborted }, null, 2));
  await expect(view.getByRole('status')).toContainText('supply difference Missing');
  await view.screenshot({ path: testInfo.outputPath('missing-baseline-trace.png') }); expect(aborted, 'The production loader must actually request the matched baseline').toBeGreaterThan(0); expect(errors).toEqual([]);
});
