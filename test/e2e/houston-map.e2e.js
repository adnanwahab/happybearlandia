import { expect, test } from '@playwright/test';

const mapRoute = '/tools/houston-map';
const deckBundle = 'https://cdn.jsdelivr.net/npm/deck.gl@9.2.2/dist.min.js';

test('the homepage carousel opens an interactive deck.gl map in an iframe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', route => {
    const request = route.request();
    if (request.resourceType() === 'document' && request.frame().parentFrame() &&
        new URL(request.url()).pathname !== mapRoute) {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Preview fixture</title>' });
    }
    return route.continue();
  });

  await page.goto('/');
  const card = page.locator('.gallery-card').filter({
    has: page.getByRole('heading', { name: 'Houston Neighborhood Map', exact: true }),
  });
  await expect(card.getByRole('link', { name: 'Open Houston Neighborhood Map in a new tab' }))
    .toHaveAttribute('href', /^\/tools\/houston-map(?:\?|$)/);
  const jump = page.getByLabel('Jump to a preview');
  const option = jump.getByRole('option', { name: /Houston Neighborhood Map$/ });
  await jump.selectOption({ value: await option.getAttribute('value') });
  await expect(card).toHaveClass(/is-current/);
  await card.getByRole('button', { name: 'Interact with Houston Neighborhood Map' }).click();
  await expect(card).toHaveClass(/is-interactive/);
  const map = card.frameLocator('iframe');
  const canvas = map.locator('canvas');
  const flat = map.getByRole('button', { name: '2D view' });
  await expect(flat).toBeEnabled();
  const angled = await canvas.screenshot();
  await flat.press('Enter');
  await expect(flat).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await canvas.screenshot()).equals(angled)).toBe(false);
  await map.getByRole('button', { name: 'Reset view' }).press('Enter');
  await expect(flat).toHaveAttribute('aria-pressed', 'true');
  await flat.press('Enter');
  await expect(flat).toHaveAttribute('aria-pressed', 'false');
});

test('the standalone map explains when the deck.gl bundle is unavailable', async ({ page }) => {
  await page.route(deckBundle, route => route.abort());
  await page.goto(mapRoute);
  await expect(page.getByRole('status')).toHaveText('The deck.gl library could not be loaded.');
  await expect(page.getByRole('button', { name: '2D view' })).toBeDisabled();
});
