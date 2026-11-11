import { expect, test } from '@playwright/test';

test('the atlas filters actual findings and keeps the checkpoint link', async ({ page, request }) => {
  const recorded = await request.post('/api/causality/world-scenario');
  expect(recorded.ok()).toBe(true);
  await page.goto('/world/discoveries/');
  const atlas = page.locator('#atlas');
  const month = atlas.getByRole('button').first();
  await expect(month).toBeVisible();
  await month.click();
  const selected = atlas.locator('[aria-pressed=true]');
  const label = await selected.getAttribute('aria-label');
  const tick = /Month (\d+)/.exec(label)[1];
  const finding = page.locator('#findings li.finding').first();
  await expect(finding).toContainText('Month ' + tick);
  await expect(finding.getByRole('link', { name: 'Jump to month' })).toHaveAttribute('href', new RegExp('month=' + tick));
  await page.getByRole('button', { name: 'Show all months' }).click();
  await expect(selected).toHaveCount(0);
});
