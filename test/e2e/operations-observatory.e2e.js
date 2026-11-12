import { test, expect } from '@playwright/test';

test('normal entry, projected evidence, source links and mobile layout', async ({ page, request }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Operations Observatory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Operations Observatory' })).toBeVisible();
  await expect(page.locator('#status')).toContainText('Evidence refreshed');
  await expect(page.locator('#engineering')).toContainText('Synthetic dependency hold: SHE-180');
  await expect(page.locator('#engineering')).toContainText('failure — Synthetic CI fixture');
  await expect(page.locator('#engineering')).toContainText('$12.00 / verified feature');
  await expect(page.locator('#product')).toContainText('80 % of fixture sessions (synthetic)');
  await expect(page.locator('#product')).not.toContainText('verified feature');
  for (const article of await page.locator('article').all()) await expect(article.getByRole('link', { name: 'Source issue or run ↗' })).toHaveAttribute('href', /^https:\/\/(linear.app|github.com)\//);
  // This is a synthetic gate assertion for a matching fixture build.
  await expect(page.locator('#engineering')).toContainText('Recorded gates passed for this build');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Refresh evidence' }).click();
  await expect(page.locator('#status')).toContainText('Evidence refreshed');
  expect(errors).toEqual([]);
  const response = await request.post('/api/operations-observatory');
  expect(response.status()).toBe(405);
  expect((await request.get('/tools/operations-observatory')).url()).toEndWith('/tools/operations-observatory/');
});

test('failed refresh removes old results and recovers', async ({ page }) => {
  await page.goto('/tools/operations-observatory/');
  await expect(page.locator('article')).toHaveCount(6);
  await page.route('**/api/operations-observatory', route => route.fulfill({ status: 503, body: '{}' }));
  await page.getByRole('button', { name: 'Refresh evidence' }).click();
  await expect(page.locator('#status')).toContainText('Evidence unavailable');
  await expect(page.locator('article')).toHaveCount(0);
  await page.unroute('**/api/operations-observatory');
  await page.getByRole('button', { name: 'Refresh evidence' }).click();
  await expect(page.locator('article')).toHaveCount(6);
});

test('stale gates and a mismatched build cannot imply release readiness', async ({ page }) => {
  await page.route('**/api/operations-observatory', async route => {
    const response = await route.fetch(); const report = await response.json();
    report.release.freshness = 'stale'; report.release.buildId = 'different';
    await route.fulfill({ json: report });
  });
  await page.route('**/api/ready', route => route.fulfill({ json: { status: 'ready', buildId: 'abcdef123' } }));
  await page.goto('/tools/operations-observatory/');
  await expect(page.locator('#engineering')).toContainText('Release not established');
  await expect(page.locator('#engineering')).toContainText('stale');
});
