import { test, expect } from '@playwright/test';

test('launch privacy copy matches local participation and demo network behavior', async ({ page, context, baseURL }) => {
  const requests = [], cookiesSet = [];
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  page.on('response', response => { if (response.headers()['set-cookie']) cookiesSet.push(response.url()); });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Privacy & cookies', exact: true })).toHaveAttribute('href', '/privacy');
  const consent = page.getByRole('checkbox', { name: 'Join the optional onboarding experiment' });
  await expect(consent).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('hbl.onboarding.v1'))).toBeNull();
  await consent.check();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('hbl.onboarding.v1')).events.map(e => e.type))).toEqual(['exposure']);
  await consent.uncheck();
  expect(await page.evaluate(() => sessionStorage.getItem('hbl.onboarding.v1'))).toBeNull();
  await page.getByRole('link', { name: 'Try the 60-second simulation' }).click();
  await expect.poll(() => page.evaluate(() => window.futureMachine?.state.status), { timeout: 90000 }).toBe('ready');
  await expect(page.getByRole('link', { name: 'Privacy & cookies', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hbl.future-machine.recent.v1'))).toBeNull();
  expect(await page.evaluate(() => window.futureMachine.firstPlayEvents.length)).toBeGreaterThan(0);
  expect(requests.filter(r => new URL(r.url).protocol.startsWith('http') && new URL(r.url).origin !== new URL(baseURL).origin)).toEqual([]);
  const writes = requests.filter(r => r.method === 'POST');
  expect(writes.length).toBeGreaterThan(0);
  for (const request of writes) {
    expect(new URL(request.url).pathname).toMatch(/^\/api\/city-experiments(?:\/|$)/);
    expect(request.body).not.toMatch(/fps_|hbl\.first-play|scenario-first|hbl\.onboarding/);
  }
  expect(cookiesSet).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  await page.getByRole('link', { name: 'Privacy & cookies', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Privacy & cookies' })).toBeVisible();
  await expect(page.locator('main')).toContainText('no automatic expiry or visitor deletion control');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/hbl-she965-browser/privacy-mobile.png', fullPage: true });
});
