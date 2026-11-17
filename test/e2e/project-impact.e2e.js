import { expect, test } from '@playwright/test';
for (const mobile of [false, true]) {
  test(`estimate handle, execution and unsupported controls (${mobile ? 'mobile reduced motion' : 'desktop'})`, async ({ page }) => {
    if (mobile) { await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); }
    await page.goto('/world/invention/');
    await page.getByRole('link', { name: 'Project Impact Handle', exact: true }).click();
    await expect(page.locator('#estimate')).toContainText('80,000');
    const slider = page.getByLabel('Additional capacity (catalog units)', { exact: true });
    await slider.focus();
    await expect(slider).toBeFocused();
    expect(await slider.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await slider.press('ArrowRight');
    await expect(page.locator('#estimate')).toContainText('160,000');
    await expect(page.locator('#manifest')).toContainText('transit-d1-8');
    await expect(page.locator('#outcome')).toContainText('No plan executed');
    await page.getByRole('button', { name: 'Undo capacity change' }).click();
    await expect(slider).toHaveValue('4');
    const number = page.getByLabel('Enter additional capacity');
    await number.fill('100'); await number.press('Tab');
    await expect(slider).toHaveValue('12');
    await page.getByRole('button', { name: 'Execute local City plan' }).click();
    await expect(page.locator('#outcome')).toContainText('Current executed plan: +12');
    await number.fill('4'); await number.press('Tab');
    await expect(page.locator('#outcome')).toContainText('Previous executed plan: +12');
    await number.fill(''); await number.press('Tab');
    await expect(page.getByRole('alert')).toContainText('finite');
    await expect(slider).toHaveValue('4');
    await page.getByLabel('Project', { exact: true }).selectOption('housing');
    await expect(slider).toBeHidden(); await expect(page.locator('#unsupported')).toBeVisible();
    await page.getByLabel('Project', { exact: true }).selectOption('upzone');
    await expect(slider).toBeHidden();
    await page.getByLabel('Project', { exact: true }).selectOption('transit');
    await expect(slider).toBeVisible();
    if (mobile) {
      const box = await slider.boundingBox();
      await page.touchscreen.tap(box.x + box.width - 8, box.y + box.height / 2);
      await expect(slider).toHaveValue('12');
      await expect(page.locator('#estimate')).toContainText('240,000');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#replay').click();
    await expect(page.getByRole('heading', { name: 'Month 14', exact: true })).toBeVisible();
  });
}

test('pointer drag changes the estimate and execution failures remain explicit', async ({ page }) => {
  await page.goto('/world/invention/impact/');
  const slider = page.locator('#capacity'), box = await slider.boundingBox();
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 10 }); await page.mouse.up();
  await expect(slider).toHaveValue('12'); await expect(page.locator('#estimate')).toContainText('240,000');
  await page.reload();
  // Fault injection only in test: fail the model run at the module boundary.
  await page.route('**/world/invention/model.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('  const scenario = createQuestScenario({ seed: recipe.seed });', '  throw new Error("Injected model failure");\n  const scenario = createQuestScenario({ seed: recipe.seed });') });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Execute local City plan' }).click();
  await expect(page.getByRole('alert')).toContainText('Execution failed: Injected model failure');
  await expect(page.locator('#outcome')).toContainText('No plan executed');
  await expect(page.locator('#replay')).toBeHidden();
});
