import { expect, test } from '@playwright/test';
import { createCity } from '../../world/city/seed.js';

test('explores before and after values from a completed city run', async ({ page, request }) => {
  const initial = createCity({ households: 9 });
  for (const utility of initial.utilities) utility.capacity = 1000;
  initial.projects.push({
    id: 'browser-delta', districtId: 'd0', type: 'housing', stage: 'construction',
    units: 2, amount: 2, duration: 2, progress: 0, cost: 100, costOverrun: 0,
    displacedUnits: [], displacedBusinesses: [],
  });
  const created = await request.post('/api/city-experiments', {
    data: { initial, runs: 1, months: 3, scenarios: [{ id: 'baseline' }] },
  });
  expect(created.status()).toBe(202);
  const { id } = await created.json();
  await expect.poll(async () => {
    const response = await request.get(`/api/city-experiments/${id}`);
    return (await response.json()).status;
  }).toBe('complete');

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/world/sprint2/delta.html?experiment=${id}`);
  await expect(page.getByLabel('Saved experiment')).toHaveValue(id);
  await page.getByRole('button', { name: 'Load run' }).click();
  await expect(page.getByText('3 replay months available.')).toBeVisible();
  await expect(page.getByLabel('Before')).toHaveValue('1');
  await expect(page.getByLabel('After')).toHaveValue('3');

  await page.getByText('Added · building-browser-delta', { exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Before · Month 1' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Entity absent' }).first()).toBeVisible();

  await page.getByLabel('Before').selectOption('2');
  await page.getByLabel('After').selectOption('1');
  await expect(page.getByText('Removed · building-browser-delta', { exact: true })).toBeVisible();
  await page.getByLabel('Show records').selectOption('households');
  await page.getByText(/^Changed ·/).first().click();
  await expect(page.getByRole('columnheader', { name: 'After · Month 1' })).toBeVisible();

  await page.route('**/api/experiments/*/replay', async route => {
    const response = await route.fetch();
    const replay = await response.json();
    delete replay.steps.at(-1).state.businesses;
    await route.fulfill({ response, json: replay });
  });
  await page.getByRole('button', { name: 'Load run' }).click();
  await page.getByLabel('Show records').selectOption('businesses');
  await expect(page.locator('#results')).toContainText('Businesses unavailable in month 3.');
  await expect(page.locator('#results')).not.toContainText('Removed');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
