import { expect, test } from '@playwright/test';

test('the permit queue, construction theater and family share an exact replay month', async ({ page }) => {
  await page.goto('/world/hidden-systems/');
  await expect(page.getByRole('status').filter({ hasText: 'Matched futures ready.' })).toBeVisible();
  await expect(page.locator('#outcome')).toContainText('Baseline month 28 · Adjusted month 16');
  await page.getByRole('button', { name: 'Jump to first baseline delay' }).click();
  await expect(page.locator('#month-label')).toHaveText('Month 4 of 60');
  await expect(page.locator('#future')).toHaveValue('baseline');
  await page.getByRole('button', { name: 'Jump to adjusted move-in' }).click();
  await expect(page.locator('#month-label')).toHaveText('Month 16 of 60');
  await expect(page.locator('#family')).toContainText('Riverside');
  await expect(page.locator('#theater')).toContainText('Completed');
  await expect(page).toHaveURL(/month=16/);
  const selected = await page.locator('#project').inputValue();
  await page.reload();
  await expect(page.locator('#month-label')).toHaveText('Month 16 of 60');
  await expect(page.locator('#project')).toHaveValue(selected);
  await page.getByLabel('Monthly material capacity').fill('0.5');
  await page.getByRole('button', { name: 'Run matched futures' }).click();
  await expect(page.locator('#outcome')).toContainText('Adjusted month 28');
});
