import { test, expect } from '@playwright/test';
import fixture from '../fixtures/decision-ablation/representative.json';
import { mkdir } from 'node:fs/promises';

test('saved inputs, pending explanation, real fresh matched execution and mobile view', async ({ page }) => {
  const response = await page.request.post('/api/decision-experiments', { data: fixture });
  expect(response.ok()).toBeTruthy(); const { experiment } = await response.json();
  const original = await (await page.request.get(`/api/decision-experiments/${experiment.id}/manifest`)).json();
  await page.goto(`/world/decision.html?experiment=${experiment.id}`);
  const run = page.locator('[data-erase-run]'), status = page.locator('[data-erase-status]');
  await expect(run).toBeEnabled();
  await page.locator('[data-erase-scenario]').selectOption('plan');
  await page.locator('[data-erase-setting]').selectOption('permitting_months');
  // Hold a response so pending is inspectable even when the small fixture is fast.
  let release; const gate = new Promise(resolve => release = resolve);
  await page.route('**/api/decision-experiments/*/start', async route => { await gate; await route.continue(); });
  await run.click(); await expect(status).toContainText('Pending:'); await expect(run).toBeDisabled();
  await mkdir('.mini-symphony-evidence', { recursive: true });
  await page.locator('#erase-one').screenshot({ path: '.mini-symphony-evidence/SHE-741-pending.png' });
  release(); await expect(status).toContainText('Computed synthetic effect', { timeout: 30000 });
  await expect(status).toContainText('3 matched seed pairs');
  expect(await (await page.request.get(`/api/decision-experiments/${experiment.id}/manifest`)).json()).toEqual(original);
  await page.locator('#erase-one').screenshot({ path: '.mini-symphony-evidence/SHE-741-result.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#erase-one').screenshot({ path: '.mini-symphony-evidence/SHE-741-mobile.png' });
  await page.goto(`/world/decision.html?experiment=${experiment.id}&readonly=1`);
  await expect(run).toBeDisabled();
});
