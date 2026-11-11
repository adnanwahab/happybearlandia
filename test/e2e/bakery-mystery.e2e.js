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
  await expect(page.locator('#case-outcome')).toContainText('Too late.');
  await expect(page.locator('[data-case-stage="delivery"]')).toContainText('No order recorded');

  await page.getByRole('button', { name: 'The direct flour route closes', exact: true }).click();
  await expect(page.locator('#why')).toContainText('3.2 of the usual 8 hours');
  await page.getByRole('button', { name: /keep the route open/i }).click();
  await expect(page.locator('#experiment-status')).toContainText('Mystery solved.');
  await expect(page.locator('#case-outcome')).toContainText('In time.');
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


test('the Case File highlights recorded links, jumps to the closure, and replays a last-chance intervention', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path + '?month=73');
  const file = page.getByRole('region', { name: 'Case File' });
  const slider = page.getByRole('slider', { name: 'Simulation timeline' });
  const stage = key => file.locator(`[data-case-stage="${key}"]`);
  const value = (key, branch = 'baseline') => stage(key).locator(`[data-case-branch="${branch}"] dd`);
  await expect(file.getByText(/Scenario assumption/)).toBeVisible();
  await expect(value('road')).toHaveText('Closed');
  await expect(value('delivery')).toHaveText('40 of 100 units');
  await expect(value('streak')).toHaveText('2 consecutive months');
  await expect(stage('delivery')).toHaveAttribute('data-connection', 'baseline');
  await expect(stage('bakery')).toHaveAttribute('data-connection', 'none');

  await file.getByRole('button', { name: 'Jump to the critical month' }).click();
  await expect(slider).toBeFocused();
  await expect(slider).toHaveValue('74');
  await expect(value('streak')).toHaveText('3 consecutive months');
  await expect(value('bakery')).toHaveText('Closed this month');
  await expect(value('shift')).toHaveText('0 of 8 hours');
  await expect(stage('bakery')).toHaveAttribute('data-connection', 'baseline');

  await page.getByRole('button', { name: /reopen the route/i }).click();
  await expect(file.locator('#case-outcome')).toContainText('The third short delivery never occurred.');
  await expect(value('delivery', 'adjusted')).toHaveText('100 of 100 units');
  await expect(value('streak', 'adjusted')).toHaveText('0 consecutive months');
  await expect(value('bakery', 'adjusted')).toHaveText('Open');
  await expect(value('shift', 'adjusted')).toHaveText('8 of 8 hours');
  const share = new URL(await page.getByLabel('Share this future').inputValue());
  share.searchParams.set('month', '74');
  await page.goto(share.href);
  await expect(slider).toHaveValue('74');
  await expect(value('streak')).toHaveText('3 consecutive months');
  await expect(value('shift', 'adjusted')).toHaveText('8 of 8 hours');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
