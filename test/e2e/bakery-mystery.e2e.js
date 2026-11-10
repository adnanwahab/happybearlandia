import { test, expect } from '@playwright/test';

const path = '/world/journeys/bakery.html';

test('investigates the closure, compares a successful intervention, and opens its shared recipe', async ({ page }) => {
  await page.goto(path);
  await expect(page.getByRole('slider', { name: 'Simulation timeline' })).toHaveValue('240');
  await expect(page.locator('#scene-status')).toContainText('Bakery closed');
  await expect(page.locator('#why')).toContainText('0 of the usual 8 hours');

  await page.getByRole('link', { name: 'Riverside Bakery closes', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Simulation timeline' })).toHaveValue('74');
  await expect(page.locator('#why')).toContainText('40 of the bakery’s 100-unit order');
  await page.getByRole('slider', { name: 'Simulation timeline' }).press('ArrowRight');
  await page.getByRole('button', { name: /reopen the route/i }).click();
  await expect(page.locator('#experiment-status')).toContainText('The bakery still closes.');

  await page.getByRole('button', { name: 'The direct flour route closes', exact: true }).click();
  await expect(page.locator('#why')).toContainText('3.2 of the usual 8 hours');
  await page.getByRole('button', { name: /keep the route open/i }).click();
  await expect(page.locator('#experiment-status')).toContainText('Mystery solved.');
  await expect(page.locator('#experiment-status')).toContainText('Earliest successful change on this device');
  await expect(page.locator('#metrics')).toContainText('3.2 hours → 8 hours');
  await expect(page.getByRole('link', { name: 'The direct flour route stays open' })).toBeVisible();

  const recipeURL = await page.getByLabel('Share this future').inputValue();
  await page.goto(recipeURL);
  await expect(page.getByRole('slider', { name: 'Simulation timeline' })).toHaveValue('240');
  await expect(page.locator('#scene-status')).toContainText('Baseline Closed · With change Open');
  await expect(page.locator('#metrics')).toContainText('0 hours → 8 hours');
  await page.getByRole('slider', { name: 'Percentage of baseline visible' }).fill('75');
  await expect(page.locator('#comparison')).toHaveCSS('--split', '75%');
});

test('unsupported recipe reports the error and opens the baseline', async ({ page }) => {
  await page.goto(path + '?recipe=bakery-v999.2911.72');
  await expect(page.locator('#experiment-status')).toContainText('The shared future could not open.');
  await expect(page.getByRole('slider', { name: 'Simulation timeline' })).toHaveValue('240');
  await expect(page.getByLabel('Share this future')).toBeHidden();
});
