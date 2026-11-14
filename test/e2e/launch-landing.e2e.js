import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
  test(`launch promise and first click at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const hero = page.locator('.launch');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Choose a housing policy. Watch two possible futures. Discover why they differ.');
    await expect(hero).toContainText('not predictions of a real city');
    const image = hero.getByRole('img');
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`landing-${viewport.width}.png`), fullPage: true });
    const play = hero.getByRole('link', { name: 'Try the 60-second simulation' });
    await expect(play).toHaveCount(1);
    await expect(hero.getByRole('link', { name: 'Explore all experiments' })).toHaveAttribute('href', '#explore');
    await expect(page.getByRole('region', { name: 'Interactive worlds and experiments' })).toBeAttached();
    expect(await play.evaluate(link => link.getBoundingClientRect().top)).toBeLessThan(viewport.height);
    await play.focus();
    await expect(play).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/world\/future-machine\.html\?demo=1/);
    await expect.poll(() => page.evaluate(() => window.futureMachine?.state.status), { timeout: 90000 }).toBe('ready');
    expect(await page.evaluate(() => window.futureMachine.history.seed)).toBe(42);
  });
}
