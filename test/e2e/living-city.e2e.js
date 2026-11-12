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
  const pair = await page.locator('#pair dd').allTextContents();
  const difference = await page.locator('#pair-difference').innerText();
  await expect(page.getByRole('heading', { name: 'Same-seed commute scorecard' })).toBeVisible();
  await expect(page.locator('#pair-cost')).toContainText('modeled USD');
  await expect(page.getByRole('heading', { name: 'Living City Council' })).toBeVisible();
  await page.getByText('Ask the resident what changed').click();
  await expect(page.locator('#answer')).toContainText('worker-1');
  await page.getByRole('combobox', { name: 'Network timeline' }).selectOption('baseline');
  await expect(page.locator('#network')).toContainText('month 14');

  const link = await page.getByLabel('Share this challenge').inputValue();
  await page.goto(link);
  await expect(page.locator('#pair-status')).toContainText('Pair 7 · Seed');
  await expect(page.locator('#pair dd')).toHaveText(pair);
  await expect(page.locator('#pair-difference')).toHaveText(difference);
});

test('optional council can leave, recover from a failed run, and revise a supported policy', async ({ page }) => {
  await page.route('**/living-city/worker.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace('const result = await run(options);', `
      if (action === 'compare' && !self.councilFailureTested) {
        self.councilFailureTested = true;
        throw new Error('Test comparison failure');
      }
      const result = await run(options);`) });
  });
  await page.goto('/world/living-city/');
  await expect(page.locator('#city')).toBeVisible();
  const scene = page.locator('#council-scene');
  await expect(scene).not.toHaveAttribute('open', '');
  await scene.locator('summary').click();
  await page.getByRole('button', { name: 'Leave council' }).click();
  await expect(scene).not.toHaveAttribute('open', '');
  await scene.locator('summary').click();
  await page.locator('#investment').selectOption('4');
  const run = page.getByRole('button', { name: 'Test one council decision' });
  await run.click();
  await expect(page.locator('#progress')).toContainText('Test comparison failure');
  await expect(run).toBeEnabled();
  await run.click();
  await expect(page.locator('#progress')).toContainText('Compared 1 pairs over 12 months');
  await expect(page.locator('#sample option')).toHaveCount(1);
  await expect(page.locator('#council-provenance')).toContainText('amount 4 · cost 80000');
  await expect(page.locator('#council-provenance')).toContainText('Paired seed');
  await expect(page.locator('#council')).toContainText('Changed:');
  await expect(page.locator('#council')).toContainText('Unchanged:');
  await expect(page.locator('#council')).toContainText('Unavailable:');
  await page.locator('#investment').selectOption('12');
  await expect(page.locator('#council')).toContainText('Add 12 units');
  await run.click();
  await expect(page.locator('#council-provenance')).toContainText('amount 12 · cost 240000');
  await page.getByRole('button', { name: 'Leave council' }).click();
  await expect(page.getByRole('button', { name: 'Compare 100 paired futures' })).toBeEnabled();
});
