import { test, expect } from '@playwright/test';
test('normal storm entry, keyboard demo, failed plan and recorded replay', async ({ page }) => {
  await page.goto('/world/storm/');
  const link = page.getByRole('link', { name: 'Storm Commander', exact: true });
  await link.focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/world\/storm\/commander.html$/);
  await page.getByRole('button', { name: 'Load authored demo' }).click();
  const run = page.getByRole('button', { name: 'Run challenge', exact: true });
  await run.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Success: 3/3');
  await expect(page.locator('#results')).toContainText('12 → 0 flooded steps');
  const checkpoint = await page.locator('#receipt').textContent();
  await page.getByRole('button', { name: 'Verify recorded replay' }).click();
  await expect(page.getByRole('status')).toContainText('Replay verified. Success');
  expect(await page.locator('#receipt').textContent()).toBe(checkpoint);
  await page.locator('#step').focus(); await page.keyboard.press('End');
  await expect(page.locator('#frame')).toContainText('Recorded step 60');
  for (const select of await page.locator('select').all()) await select.selectOption('standard');
  await expect(page.locator('#receipt')).toBeEmpty();
  await run.click();
  await expect(page.getByRole('status')).toContainText('Challenge failed: 2/3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/private/tmp/SHE-691-commander-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Back to Sculpt a Storm' }).click();
  await expect(page).toHaveURL(/\/world\/storm\/$/);
});

test('visible missing-source and replay-mismatch states clear the score', async ({ page }) => {
  await page.route('**/storm/commander.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('source = SOURCE, signal', 'source = null, signal');
    await route.fulfill({ response, body });
  });
  await page.goto('/world/storm/commander.html');
  await page.getByRole('button', { name: 'Run challenge', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No source data');
  await expect(page.locator('#receipt')).toBeEmpty();
  await page.unrouteAll();
  await page.route('**/storm/commander.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace("const replay = await runCommander(record.plan, options);", "throw new Error('Replay mismatch: injected fixture');");
    await route.fulfill({ response, body });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Run challenge', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Challenge failed');
  await page.getByRole('button', { name: 'Verify recorded replay' }).click();
  await expect(page.getByRole('status')).toContainText('Replay mismatch');
  await expect(page.locator('#receipt')).toBeEmpty();
});

test('cancel during execution exposes no partial result', async ({ page }) => {
  await page.route('**/storm/commander.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('setTimeout(resolve, 0)', 'setTimeout(resolve, 500)');
    await route.fulfill({ response, body });
  });
  await page.goto('/world/storm/commander.html');
  await page.getByRole('button', { name: 'Run challenge', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cancelled');
  await expect(page.locator('#receipt')).toBeEmpty();
  await expect(page.locator('#replay')).toBeDisabled();
});
