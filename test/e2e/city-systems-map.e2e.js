import { expect, test } from '@playwright/test';

const mapRoute = '/tools/city-systems-map';
const deckBundle = 'https://cdn.jsdelivr.net/npm/deck.gl@9.4.1/dist.min.js';
// Offline runs may set HBL_DECK_GL_BUNDLE to a local copy of that exact file (for example from the
// deck.gl@9.4.1 npm tarball). The page's SRI attribute still rejects any other bytes.
const localBundle = process.env.HBL_DECK_GL_BUNDLE;

test.beforeEach(async ({ page }) => {
  if (localBundle) {
    await page.route(deckBundle, route => route.fulfill({
      path: localBundle, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' },
    }));
  }
});

test('the map loads every system and responds to scenario, overlay and layer controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(mapRoute);
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#map canvas').first()).toBeVisible();
  await expect(page.getByText('Data city-systems-map.1, seeds 7 and 42.')).toBeAttached();

  const subway = page.locator('.kpi').filter({ hasText: 'Subway' });
  await expect(subway).toContainText('Running');
  const storm = page.getByRole('button', { name: /^Coastal storm/ });
  await storm.click();
  await expect(storm).toHaveAttribute('aria-pressed', 'true');
  await expect(subway).toContainText('Suspended');
  const legend = page.getByLabel('Legend');
  await expect(legend).toContainText('Flood depth');

  await page.getByRole('button', { name: 'Air quality', exact: true }).click();
  await expect(legend).toContainText('Fine particles (PM2.5)');
  await page.locator('#ly-grid').check();
  await expect(legend).toContainText('Load');
  await expect(page.locator('nav[aria-label="Connected universe"]')).toBeAttached();
});

test('the map explains when the deck.gl bundle is unavailable', async ({ page }) => {
  await page.route(deckBundle, route => route.abort());
  await page.goto(mapRoute);
  await expect(page.locator('#loading'))
    .toHaveText('The deck.gl library could not be loaded. Check your connection and reload.');
});
