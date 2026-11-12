import { test, expect } from '@playwright/test';

const measure = (baseline, plan) => ({ baseline: { mean: baseline }, plan: { mean: plan }, delta: { mean: plan - baseline, p10: plan - baseline - 1, p90: plan - baseline + 1 } });
const result = {
  meta: { seeds: 2, metrics: { avgMood: { label: 'Well-being', better: 'higher' }, displacedResidents: { label: 'Displaced by storm', better: 'lower' } } },
  futures: { metric: 'avgMood', neutralBand: 0.25, year: 5 },
  series: [
    { year: 1, metrics: { avgMood: measure(50, 50), displacedResidents: measure(14, 14) } },
    { year: 5, metrics: { avgMood: measure(50, 55), displacedResidents: measure(14, 8) } },
  ],
  runs: [0, 1].map(() => ({ years: { 1: { baseline: { avgMood: 50 }, plan: { avgMood: 50 } }, 5: { baseline: { avgMood: 50 }, plan: { avgMood: 55 } } } })),
};

test('checkpoint slider updates recorded outcomes without another experiment and ignores stale summaries', async ({ page }) => {
  let experiments = 0, releaseSummary;
  const summaryGate = new Promise(resolve => { releaseSummary = resolve; });
  await page.route(url => url.pathname === '/world', route => route.fulfill({ contentType: 'text/html', body: '<p>Paired map fixture</p>' }));
  await page.route('**/api/plan', route => route.fulfill({ json: { packages: [{ name: 'Balanced', items: [{ proposal: { id: 'f_drainage' } }] }] } }));
  await page.route('**/api/world/experiments', route => { experiments++; return route.fulfill({ status: 202, json: { statusUrl: '/api/world/experiments/timeline-fixture' } }); });
  await page.route('**/api/world/experiments/timeline-fixture', route => route.fulfill({ json: { status: 'done', result } }));
  await page.route('**/api/constitution-summary', async route => { await summaryGate; await route.fulfill({ json: { summary: 'Delayed final-year provider summary' } }); });
  await page.goto('/world/visualize-consitution.html');
  await page.getByRole('button', { name: 'Compare worlds' }).click();
  const slider = page.getByRole('slider', { name: 'Simulation checkpoint:' });
  await expect(slider).toBeVisible();
  await expect(page.locator('#checkpoint-year')).toHaveText('Year 5');
  await expect(page.locator('#split')).toContainText('2 better');
  await expect(page.locator('#metrics')).toContainText('Plan 8');
  await slider.focus(); await slider.press('Home');
  await expect(page.locator('#checkpoint-year')).toHaveText('Year 1');
  await expect(page.locator('#split')).toContainText('2 neutral');
  await expect(page.locator('#metrics')).toContainText('Plan 14');
  await expect(page.locator('#summary')).toContainText('At year 1');
  const summaryResponse = page.waitForResponse('**/api/constitution-summary');
  releaseSummary();
  await (await summaryResponse).finished();
  await expect(page.locator('#summary')).toContainText('At year 1');
  await expect(page.getByRole('button', { name: 'Compare worlds' })).toBeEnabled();
  await slider.press('End');
  await expect(page.locator('#checkpoint-year')).toHaveText('Year 5');
  await expect(page.locator('#summary')).toContainText('At year 5');
  expect(experiments).toBe(1);
  await page.locator('#idea').fill('A different plan');
  await expect(page.locator('#results')).toBeHidden();
});

test('current Constitution Studio scrubs yearly and monthly paired replay within the evaluated horizon', async ({ page }) => {
  await page.route('**/__yearly-timeline', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><main id="studio"></main>' }));
  await page.goto('/__yearly-timeline');
  await page.evaluate(async () => {
    const { mountConstitutionStudio } = await import('/world/constitution-city/studio.js');
    const { createConstitutionRuntime } = await import('/world/constitution-city/runtime.js');
    const { normalizeDearCongressPlan } = await import('/world/constitution-city/plan.js');
    const { createCity } = await import('/world/city/seed.js');
    const { analyzeConstitutionDiff } = await import('/world/constitution-city/analysis.js');
    const source = await (await fetch('/world/constitution-city/dear-congress-plan.json')).json();
    const plan = normalizeDearCongressPlan(source), initial = createCity({ households: 3 });
    const runtime = createConstitutionRuntime({ initial, plan });
    const studio = mountConstitutionStudio(document.querySelector('#studio'), { plan, initial, runtime, analyzeDiff: analyzeConstitutionDiff });
    window.timelineFixture = { studio, runtime };
  });
  const slider = page.locator('[data-cc-month]');
  await expect(slider).toBeDisabled();
  await page.locator('[data-cc-years]').fill('2');
  await page.locator('[data-cc-run]').click();
  await expect.poll(() => page.evaluate(() => window.timelineFixture.studio.getState().month)).toBe(24);
  await expect(slider).toHaveAttribute('max', '24');
  await expect(slider).toHaveAttribute('step', '12');
  await slider.focus(); await slider.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.timelineFixture.studio.getState().month)).toBe(12);
  const replay = await page.evaluate(() => { const { selected } = window.timelineFixture.studio.getState(); return [selected.state.month, selected.baselineState.month]; });
  expect(replay).toEqual([12, 12]);
  await page.locator('[data-cc-time-step]').selectOption('1');
  await expect(slider).toHaveAttribute('step', '1');
  await slider.focus(); await slider.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.timelineFixture.studio.getState().month)).toBe(11);
  await page.locator('[data-cc-time-step]').selectOption('12');
  await expect.poll(() => page.evaluate(() => window.timelineFixture.studio.getState().month)).toBe(0);
  await slider.focus(); await slider.press('End');
  await expect.poll(() => page.evaluate(() => window.timelineFixture.studio.getState().month)).toBe(24);
  await page.evaluate(() => { window.timelineFixture.studio.destroy(); window.timelineFixture.runtime.destroy(); });
});
