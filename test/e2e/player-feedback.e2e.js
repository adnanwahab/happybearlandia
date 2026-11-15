import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) test(`World reactions: consent, failure, clear, dismissal and reload (${mobile ? 'mobile reduced motion 2D' : 'desktop'})`, async ({ page, request }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  if (mobile) await page.emulateMedia({ reducedMotion: 'reduce' });
  // Verify normal server wiring without creating a collection record.
  expect((await request.get('/api/player-feedback')).status()).toBe(405);
  expect((await request.post('/api/player-feedback', { headers: { origin: new URL(test.info().project.use.baseURL).origin },
    data: { version: 1, consent: false, kind: 'favorite', moment: 'exploring' } })).status()).toBe(400);
  await page.route('**/api/area*', route => route.abort());
  const requests = []; let fail = true;
  await page.route('**/api/player-feedback', async route => {
    requests.push(route.request());
    if (fail) await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
    else await route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
  });
  const url = '/world/?demo=1&synthetic=1&people=16' + (mobile ? '&renderer=canvas2d' : '');
  await page.goto(url);
  const panel = page.locator('#playerFeedback');
  await expect(panel).not.toHaveAttribute('open', '');
  await page.getByLabel('HappyBearLandia world controls', { exact: true }).click();
  await panel.locator('summary').focus(); await page.keyboard.press('Enter');
  const wow = panel.getByRole('button', { name: 'Wow', exact: true });
  await expect(wow).toBeDisabled();
  await expect(panel.getByText('Counts cannot be individually withdrawn', { exact: false })).toBeVisible();
  expect(requests).toHaveLength(0);
  await panel.getByLabel('World feature').selectOption('comparing');
  await panel.getByRole('checkbox').check(); await wow.click();
  await expect(panel.getByRole('status')).toContainText('could not be confirmed');
  await expect(wow).toBeEnabled();
  expect(requests[0].postDataJSON()).toEqual({ version: 1, consent: true, kind: 'favorite', moment: 'comparing' });
  expect(requests[0].headers()['referer']).toBeUndefined(); expect(requests[0].headers()['cookie']).toBeUndefined();
  fail = false; await panel.getByRole('button', { name: 'Confusing', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('counted privately');
  await expect(panel.getByRole('checkbox')).not.toBeChecked(); await expect(wow).toBeDisabled();
  await panel.getByRole('button', { name: 'Clear local feedback' }).click();
  await expect(panel.getByLabel('World feature')).toHaveValue('exploring');
  await expect(panel.getByRole('status')).toContainText('Local choices cleared');
  await page.screenshot({ path: `.mini-symphony-evidence/SHE-586-after-${mobile ? 'mobile' : 'desktop'}-feedback.png` });
  // Touch controls fit the existing scrollable World panel and are at least 44px tall.
  for (const button of await panel.getByRole('button').all()) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await panel.getByLabel('World feature').focus(); await page.keyboard.press('Escape');
  await expect(panel).not.toHaveAttribute('open', '');
  await expect(panel.locator('summary')).toBeFocused();
  await page.reload(); await expect(panel).not.toHaveAttribute('open', '');
  expect(requests).toHaveLength(2);
});
