import { test, expect } from '@playwright/test';
const route = '/world/?demo=1&synthetic=1&people=80';
async function ready(page) {
  await page.goto(route);
  await page.waitForFunction(() => window.hblVisualPass?.ready === true);
  await expect(page.getByTestId('quick-demo')).toBeEnabled();
}
async function completed(page) {
  await page.waitForFunction(() => ['completed', 'error'].includes(window.hblVisualPass?.getState().status), null, { timeout: 120000 });
  const state = await page.evaluate(() => window.hblVisualPass.getState());
  expect(state.status, JSON.stringify(state.error)).toBe('completed');
  expect(state.result).toBeTruthy();
  expect(state.observation).toBeTruthy();
  expect(state.timings.totalMs).toBeGreaterThan(0);
  return state;
}
for (const [name, width, height] of [['narrow',320,640],['phone',390,844],['tablet',768,1024],['desktop',1440,1000],['landscape',844,390]]) {
  test(`${name}: real matched comparison, resident inspection and replay`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await page.getByTestId('quick-demo').click();
    const state = await completed(page);
    await info.attach('measured-timings', { body: JSON.stringify({ viewport: { width, height }, userAgent: await page.evaluate(() => navigator.userAgent), timings: state.timings }), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath(`${name}-result.png`) });
    await expect(page.getByTestId('quick-demo-inspect')).toBeVisible();
    await page.getByTestId('quick-demo-inspect').click();
    await page.screenshot({ path: info.outputPath(`${name}-resident.png`) });
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.hblVisualPass.controller.replay());
    const replay = await completed(page);
    expect(replay.runId).not.toBe(state.runId);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test('stop during computation permits a fresh real run', async ({ page }) => {
  await ready(page);
  await page.getByTestId('quick-demo').click();
  await page.waitForFunction(() => window.hblVisualPass.getState().status === 'computing');
  await page.getByTestId('quick-demo-stop').click();
  expect(await page.evaluate(() => window.hblVisualPass.getState().status)).toBe('stopped');
  await page.evaluate(() => window.hblVisualPass.controller.replay());
  await completed(page);
  await expect(page.locator('#demoBtn')).toBeAttached();
  await expect(page.locator('#runExperimentBtn')).toBeAttached();
});
