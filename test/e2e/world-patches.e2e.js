import { test, expect } from '@playwright/test';

test('World Patches entry carries the exact scenario into the ballot and back', async ({page}) => {
  const world = '/world?universeId=universe%3Ahbl%3Amain&worldId=world%3Ahbl%3Amain&scenarioId=scenario%3Ahbl%3Abaseline';
  await page.goto(world, {waitUntil:'domcontentloaded'});
  const patches = page.getByRole('link', { name: 'Patches: propose improvements and vote' });
  await expect(patches).toBeVisible();
  const target = new URL(await patches.getAttribute('href'), 'http://localhost');
  expect(target.pathname).toBe('/vote-on-patch');
  expect(target.searchParams.get('returnTo')).toBe(world);
  await patches.click();
  await expect(page.getByRole('heading', { name: 'Vote on the next patch' })).toBeVisible();
  await expect(page.locator('#patch-world-context')).toContainText('scenario:hbl:baseline');
  await expect(page.getByRole('link', {name:'Back to your world'})).toHaveAttribute('href',world);
  await page.getByRole('button', {name:'Compare impact'}).first().click();
  await expect(page.locator('.impact-result').first()).toContainText('No recorded matched-seed');
});

test('World embed hides the public Patches entry', async ({page}) => {
  await page.goto('/world?embed=1&synthetic=1&people=8', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#world-patches-link')).toBeHidden();
});
