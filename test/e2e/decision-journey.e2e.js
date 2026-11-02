import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ actionTimeout: 15000 });

async function ready(page) {
  await expect(page.locator('#parameter-permitting_months')).toBeVisible();
}
async function complete(page, previousId) {
  await expect.poll(() => page.evaluate(old => {
    const state = window.hblDecisionStudio?.state;
    return Boolean(state?.experiment?.id && state.experiment.id !== old && state.experiment.status === 'completed' && !state.busy);
  }, previousId), { timeout: 60000 }).toBe(true);
  return page.evaluate(() => structuredClone(window.hblDecisionStudio.state.results));
}
async function run(page, count, previousId) {
  await page.locator('#run-count').selectOption(String(count));
  await page.locator('#run-experiment').click();
  return complete(page, previousId);
}

test('customer journey: 500 futures, replay, tradeoffs, trust, brief, edits, reproduce and share', async ({ page, context }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/world/decision.html');
  await ready(page);
  await page.locator('#try-example').click();
  await expect(page.locator('#parameter-permitting_months')).toHaveValue('6');
  await page.locator('#auto-preview').uncheck();
  const results = await run(page, 500);
  expect(results.experiment.scenarios.map(row => row.kind)).toEqual(['baseline', 'plan-a', 'plan-b', 'stress']);
  expect(results.runs).toHaveLength(2000);
  await expect(page.locator('.decision-viz [data-summary]')).toContainText('2,000 completed futures');
  await expect(page.locator('#progress-count')).toHaveText('2,000 / 2,000');
  await expect(page.locator('[data-viz="distribution"]')).toContainText('80% interval');
  await expect(page.locator('[data-viz="comparison"]')).toContainText('Current policy');
  await expect(page.getByRole('img', { name: 'Cost versus affordability Pareto view' })).toBeVisible();
  await page.locator('[data-control="projection"]').click();
  await expect(page.getByLabel('Rotate landscape')).toBeVisible();
  await page.locator('.decision-viz .dv-panel').first().screenshot({ path: '/private/tmp/hbl-decision-landscape.png' });
  const plottedIds = await page.locator('[data-viz="landscape"] [data-run-id]').evaluateAll(points => points.map(point => point.dataset.runId));
  const plottedScenarios = new Set(results.runs.filter(row => plottedIds.includes(row.id)).map(row => row.scenarioId));
  // A global stride over round-robin rows must not erase entire alternatives.
  expect([...plottedScenarios].sort()).toEqual(results.experiment.scenarios.map(row => row.id).sort());
  const firstPoint = page.locator('[data-viz="landscape"] [data-run-id]').first();
  const selectedId = await firstPoint.getAttribute('data-run-id');
  // Dense projected points overlap; keyboard selection reaches the exact future
  // through the same supported interaction available to assistive users.
  await firstPoint.focus();
  await firstPoint.press('Enter');
  await expect(page.locator('[data-run-summary]')).toContainText(selectedId);
  const replay = page.getByLabel('Replay year', { exact: true });
  await replay.fill(await replay.getAttribute('max'));
  await replay.dispatchEvent('input');
  await expect(replay).toHaveAttribute('aria-valuetext', 'Year 10');
  await page.locator('[data-control="unfavorable"]').check();
  await expect(page.locator('[data-filter-note]')).toContainText('Unfavorable means worse');
  await page.locator('[data-control="unfavorable"]').uncheck();
  await expect(page.locator('#decision-trust summary').filter({ hasText: 'Which assumptions matter?' })).toBeVisible();
  await expect(page.locator('#decision-trust')).toContainText(/limitations/i);
  await expect(page.locator('#decision-trust')).toContainText(/assumption/i);
  await expect(page.locator('#decision-trust')).toContainText(/evidence/i);
  const briefOpening = context.waitForEvent('page');
  await page.locator('#decision-trust [data-action="brief"]').click();
  const brief = await briefOpening;
  await expect(brief.locator('.decision-brief')).toContainText('Affordable Housing Plan');
  await expect(brief.locator('.decision-brief')).toContainText(/limitations/i);
  await expect(brief.locator('.decision-brief')).toContainText(/evidence/i);
  await brief.emulateMedia({ media: 'print' });
  await expect(brief.locator('#print-brief')).toBeHidden();
  await brief.close();
  await page.locator('#executive-toggle').click();
  await expect(page.locator('#executive-toggle')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.hblDecisionStudio.state.results.runs.length)).toBe(2000);
  await page.locator('#executive-toggle').click();
  const downloading = page.waitForEvent('download');
  await page.locator('#download-manifest').click();
  const download = await downloading;
  const manifest = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(manifest.experiment.seed).toBe(42);
  expect(manifest.experiment.runs).toBe(500);
  const original = results.experiment.id;
  await page.locator('#parameter-permitting_months').fill('30');
  await page.locator('#parameter-permitting_months').dispatchEvent('input');
  const edited = await run(page, 10, original);
  const oldPlan = results.runs.find(row => row.scenarioId === 'plan-a');
  const newPlan = edited.runs.find(row => row.scenarioId === 'plan-a' && row.seed === oldPlan.seed);
  expect(newPlan.sampledParameters.permitting_months).toBe(30);
  expect(newPlan.metrics).not.toEqual(oldPlan.metrics);
  await page.locator('#reproduce-experiment').click();
  const reproduced = await complete(page, edited.experiment.id);
  expect(reproduced.runs.map(row => row.metrics)).toEqual(edited.runs.map(row => row.metrics));
  const shared = await context.newPage();
  await shared.goto(reproduced.experiment.shareUrl);
  await expect(shared.locator('#readonly-banner')).toBeVisible();
  await expect(shared.locator('#run-experiment')).toBeDisabled();
  await expect(shared.locator('#parameter-permitting_months')).toBeDisabled();
  await expect(shared.locator('.decision-viz [data-summary]')).toContainText('40 completed futures');
  await expect(shared.locator('#decision-trust')).toContainText(/limitations/i);
  await shared.close();
  expect(errors, 'Browser errors during the complete decision journey').toEqual([]);
});

test('a large customer batch can be cancelled without replacing the old product', async ({ page }) => {
  await page.goto('/world/decision.html');
  await ready(page);
  await page.locator('#try-example').click();
  for (let index = 0; index < 4; index++) await page.locator('#duplicate-scenario').click();
  await page.locator('#run-count').selectOption('1000');
  await page.locator('#run-years').fill('10');
  const starting = page.waitForResponse(response => /\/api\/decision-experiments\/[^/]+\/start$/.test(new URL(response.url()).pathname));
  await page.locator('#run-experiment').click();
  await starting;
  // Keyboard activation avoids waiting for chart-driven layout changes while
  // the real worker is already progressing through this fast numeric model.
  await page.locator('#cancel-experiment').press('Enter');
  await expect(page.locator('#run-state')).toContainText('cancelled');
  const state = await page.evaluate(() => window.hblDecisionStudio.state.experiment);
  expect(state.progress.completed).toBeLessThan(state.progress.total);
  await page.goto('/world/experiment-lab.html');
  await expect(page.getByRole('link', { name: /Decision simulation demo/ })).toHaveAttribute('href', '/world/decision.html?demo=1');
  await expect(page.locator('#load-json')).toBeEnabled();
});

test('customer data import is previewed, saved, reopened, and identified as unverified evidence', async ({ page }) => {
  await page.goto('/world/decision.html');
  await ready(page);
  await page.locator('#try-example').click();
  await page.locator('#auto-preview').uncheck();
  await page.locator('.data-import > summary').click();
  const upload = page.locator('#parameter-upload');
  await upload.setInputFiles({ name: 'customer-input.csv', mimeType: 'text/csv', buffer: Buffer.from('permit_delay,density\n12,1.8\n') });
  await page.getByLabel('Map permit_delay to parameter').selectOption('permitting_months');
  await page.getByLabel('Map density to parameter').selectOption('zoning_density');
  await expect(page.locator('#import-preview')).toContainText('12 months');
  await expect(page.locator('#parameter-permitting_months')).toHaveValue('6');
  await page.locator('#apply-import').click();
  await expect(page.locator('#parameter-permitting_months')).toHaveValue('12');
  await expect(page.locator('#parameter-zoning_density')).toHaveValue('1.8');
  await page.locator('#project-name').fill('Customer housing inputs');
  await page.locator('#save-project').click();
  const savedId = await page.locator('#local-projects').inputValue();
  expect(savedId).not.toBe('');
  await page.locator('#parameter-permitting_months').fill('40');
  await page.locator('#local-projects').selectOption(savedId);
  await page.locator('#open-local').click();
  await expect(page.locator('#parameter-permitting_months')).toHaveValue('12');
  await page.locator('#duplicate-scenario').click();
  await page.locator('#scenario-name').fill('Customer alternative');
  await expect(page.locator('#scenario-tabs')).toContainText('Customer alternative');
  const data = await run(page, 10);
  expect(data.experiment.scenarios).toHaveLength(5);
  await expect(page.locator('#decision-trust')).toContainText('customer-input.csv');
  await expect(page.locator('#decision-trust')).toContainText(/unverified/i);
});

test('pilot request produces a local brief and diagnostics report actual execution', async ({ page }) => {
  await page.goto('/world/decision.html');
  await ready(page);
  await page.locator('#try-example').click();
  const pilot = page.locator('.decision-pilot-request');
  await pilot.locator('summary').click();
  await pilot.locator('[name="organization"]').fill('Municipal planning demo');
  await pilot.locator('[name="alternatives"]').fill('Current policy, transit housing, delivery stress');
  const downloading = page.waitForEvent('download');
  await pilot.getByRole('button', { name: 'Download pilot brief' }).click();
  const file = await downloading;
  const brief = JSON.parse(await readFile(await file.path(), 'utf8'));
  expect(brief.schemaVersion).toBe('decision-pilot-brief.v1');
  expect(brief.organization).toBe('Municipal planning demo');
  expect(brief.decision).toContain('transit');
  await expect(pilot.getByRole('status')).toContainText('downloaded locally');
  await run(page, 10);
  const diagnostics = page.locator('.decision-diagnostics');
  await diagnostics.locator('summary').click();
  await expect(diagnostics).toContainText('40 / 40');
  await expect(diagnostics).toContainText('Runs per second');
  await expect(diagnostics).toContainText('No captured errors.');
});
