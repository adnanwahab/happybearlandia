import { expect, test } from '@playwright/test';

test('help a resident, inspect real flows, compare 100 paired futures, and replay a shared challenge', async ({ page }) => {
  await page.goto('/world/living-city/');
  await expect(page.getByRole('heading', { name: 'The Riverside commute' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'City requests' }).locator('option')).toHaveCount(5);
  await page.getByRole('button', { name: 'Visit the resident’s home' }).click();
  await expect(page.getByRole('heading', { name: 'Home in Riverside' })).toBeVisible();
  await expect(page.locator('#home')).toContainText('building-d1');
  await expect(page.getByRole('heading', { name: 'Living Network Explorer' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Selected worker/ }).first()).toBeVisible();
  const flows = page.getByRole('combobox', { name: 'Flow category' });
  await flows.selectOption('goods');
  await expect(page.getByText('Flow data unavailable.')).toBeVisible();
  await flows.selectOption('people');
  await page.getByRole('button', { name: 'Compare 100 paired futures' }).click();

  await expect(page.locator('#progress')).toContainText('Compared 100 pairs over 12 months');
  await expect(page.getByRole('combobox', { name: 'Choose a paired future' }).locator('option')).toHaveCount(100);
  await expect(page.locator('#pair-status')).toContainText('Pair 1 · Seed');
  await page.getByRole('combobox', { name: 'Choose a paired future' }).selectOption('6');
  await expect(page.locator('#pair-status')).toContainText('Pair 7 · Seed');
  const pair = await page.locator('#pair').innerText();
  await expect(page.getByRole('heading', { name: 'Living City Council' })).toBeVisible();
  await page.getByText('Ask the resident what changed').click();
  await expect(page.locator('#answer')).toContainText('worker-1');
  await page.getByRole('combobox', { name: 'Network timeline' }).selectOption('baseline');
  await expect(page.locator('#network')).toContainText('month 14');

  const link = await page.getByLabel('Share this challenge').inputValue();
  await page.goto(link);
  await expect(page.locator('#pair-status')).toContainText('Pair 7 · Seed');
  const reopenedPair = await page.locator('#pair').innerText();
  expect(reopenedPair.replace(/\s+/g, ' ').trim()).toBe(pair.replace(/\s+/g, ' ').trim());
});
