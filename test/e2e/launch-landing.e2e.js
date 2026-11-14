import { test, expect } from '@playwright/test';

test('rainbow title animates only when motion is allowed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const title = page.locator('.launch h1');
  await expect(title).toHaveText('One city. Two possible futures.');
  await expect(title).toHaveCSS('animation-name', 'title-hues');
  await expect(title).toHaveCSS('animation-duration', '18s');
  await expect(title).toHaveCSS('background-clip', 'text');
  const filters = await title.evaluate(el => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const start = getComputedStyle(el).filter;
    animation.currentTime = 9000;
    return [start, getComputedStyle(el).filter];
  });
  expect(filters[0]).not.toBe(filters[1]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await title.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(title).toHaveCSS('animation-name', 'none');
  await expect(title).toHaveCSS('filter', 'none');
  await expect(title).toHaveCSS('background-image', /linear-gradient/);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'no-preference' });
  await expect(title).toHaveCSS('animation-name', 'none');
  await expect(title).toHaveCSS('background-image', 'none');
  expect(await title.evaluate(el => getComputedStyle(el).color)).not.toBe('rgba(0, 0, 0, 0)');
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`launch promise and first click at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const hero = page.locator('.launch');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('One city. Two possible futures.');
    await expect(hero).toContainText('not predictions of a real city');
    const image = hero.getByRole('img');
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`landing-${viewport.width}.png`), fullPage: true });
    const play = hero.getByRole('link', { name: 'Play Demo' });
    await expect(play).toHaveCount(1);
    await play.click();
    await expect(page).toHaveURL(/\/world\/future-machine\.html\?demo=1/);
    await expect.poll(() => page.evaluate(() => window.futureMachine?.state.status), { timeout: 90000 }).toBe('ready');
    expect(await page.evaluate(() => window.futureMachine.history.seed)).toBe(42);
  });
}
