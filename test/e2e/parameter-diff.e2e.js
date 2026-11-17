import { test, expect } from '@playwright/test';

test('inspect baseline, defaults and live intervention edits without changing baseline', async ({ page }) => {
  await page.goto('/world/decision.html');
  await expect(page.locator('#parameter-permitting_months')).toBeVisible();
  await page.locator('#auto-preview').uncheck();
  await page.locator('#parameter-diff-inspector summary').click();
  const inspector = page.locator('#scenario-parameter-diff');
  await expect(inspector).toContainText('Shared matched seed: 42');
  await expect(inspector.locator('[data-diff-setting="migration"]')).toContainText('Shared');
  const permits = inspector.locator('[data-diff-setting="permitting_months"]');
  await expect(permits).toContainText('Changed');
  await page.locator('#parameter-permitting_months').fill('9');
  await expect(permits.locator('td').nth(0)).toContainText('18');
  await expect(permits.locator('td').nth(1)).toContainText('9');
  await page.locator('#run-seed').fill('87');
  await expect(inspector).toContainText('Shared matched seed: 87');
  await page.locator('[data-scenario-id="baseline"]').click();
  await expect(page.locator('#parameter-permitting_months')).toHaveValue('18');
  await expect(inspector.locator('[data-changed="true"]')).toHaveCount(0);
});
