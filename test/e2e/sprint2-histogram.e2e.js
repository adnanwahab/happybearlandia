import { expect, test } from '@playwright/test';

test('runs the city ensemble in a worker and reconciles the visible histogram', async ({ page }) => {
  test.setTimeout(150_000);
  const response = await page.goto('/world/sprint2/histogram.html');
  expect(response.status()).toBe(200);
  const run = page.getByRole('button', { name: 'Run 100 pairs' });
  const cancel = page.getByRole('button', { name: 'Cancel' });
  await run.click();
  await cancel.click();
  await expect(page.getByRole('status')).toContainText('Simulation canceled.');
  await expect(run).toBeEnabled();

  await run.click();
  await expect(page.getByRole('status')).toHaveText('Simulation complete.', { timeout: 125_000 });
  await expect(page.getByText('95 of 100 requested pairs', { exact: false })).toBeVisible();
  await expect(page.getByText('92 / 95', { exact: true })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader', { name: 'Change (minutes)' })).toBeVisible();
  const counts = await table.getByRole('cell').allTextContents();
  expect(counts.map(Number)).toEqual([0, 89, 0, 3, 3, 0, 0, 0, 0]);
  await page.getByText('View pairs with missing commutes').click();
  await expect(page.locator('#missing li')).toHaveCount(5);
});

test('reports worker loading failures against the requested denominator', async ({ page }) => {
  await page.route('**/world/living-city/worker.js', route => route.abort());
  await page.goto('/world/sprint2/histogram.html');
  const run = page.getByRole('button', { name: 'Run 100 pairs' });
  await run.click();
  await expect(page.getByRole('status')).toContainText('No results were returned for the 100 requested pairs.');
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(run).toBeEnabled();
});
