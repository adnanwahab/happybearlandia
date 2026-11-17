import { test, expect } from '@playwright/test';
for (const mobile of [false, true]) test(`World navigation and coalition journey ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/world?demo=1&synthetic=1&people=16');
  if (await page.locator('#top').getAttribute('open') === null) await page.locator('#top > summary').click();
  await page.getByRole('link', { name: 'Council Coalition Cards · synthetic toy', exact: true }).click();
  await expect(page).toHaveURL(/\/world\/coalition\/$/);
  await expect(page.getByRole('status')).toContainText('No source data');
  await page.getByRole('button', { name: 'Open pinned transit demo' }).click();
  await expect(page.locator('.card')).toHaveCount(5);
  await expect(page.getByRole('status')).toContainText('Not a winning coalition');
  for (const name of ['Commuting residents', 'Local employers', 'City treasurer']) {
    const button = page.getByRole('button', { name: `Join ${name} in bloc`, exact: true });
    await button.focus(); await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('status')).toContainText('Winning coalition · 3/5');
  await page.getByRole('button', { name: 'Join Renters in bloc', exact: true }).click();
  await page.getByRole('button', { name: 'Join Public service operators in bloc', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('1 oppose · 1 abstain');
  await page.getByRole('button', { name: 'Remove City treasurer from bloc', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Not a winning coalition · 2/5');
  await page.getByRole('button', { name: 'Cancel decision', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Decision cancelled');
  await expect(page.locator('#board')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open pinned transit demo' })).toBeFocused();
  await page.getByRole('button', { name: 'Open pinned transit demo' }).click();
  await expect(page.getByRole('status')).toContainText('0/5');
  await page.getByRole('link', { name: 'Back to World' }).click();
  await expect(page).toHaveURL(/\/world$/);
});

test('native drag moves a card without changing its vote', async ({ page }) => {
  await page.goto('/world/coalition/');
  await page.getByRole('button', { name: 'Open pinned transit demo' }).click();
  await page.locator('article[data-actor="renters"]').dragTo(page.locator('#bloc'));
  await expect(page.locator('#bloc article')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('0/5 support');
  await expect(page.getByRole('status')).toContainText('1 oppose');
});
