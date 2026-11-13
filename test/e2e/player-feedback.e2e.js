import { test, expect } from '@playwright/test';

test('World feedback is optional, consented, private, and nonblocking on network failure', async ({ page }) => {
  const requests = [];
  let fail = true;
  await page.route('**/api/player-feedback', async route => {
    requests.push(route.request());
    if (fail) await route.abort('failed');
    else await route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/world/?demo=1&synthetic=1&people=20');
  const panel = page.locator('#playerFeedback');
  await panel.locator('summary').click();
  const send = panel.getByRole('button', { name: 'Send feedback', exact: true });
  await expect(send).toBeDisabled();
  await panel.getByRole('button', { name: 'Continue without sending' }).click();
  expect(requests).toHaveLength(0);
  await panel.locator('summary').click();
  await panel.getByLabel('Feedback type').selectOption('favorite');
  await panel.getByLabel('Moment', { exact: true }).selectOption('comparing');
  await panel.getByRole('checkbox').check();
  await send.click();
  await expect(panel.getByRole('status')).toContainText('could not be confirmed');
  await expect(send).toBeEnabled();
  expect(requests[0].postDataJSON()).toEqual({ version: 1, consent: true, kind: 'favorite', moment: 'comparing' });
  expect(requests[0].headers()['referer']).toBeUndefined();
  expect(requests[0].headers()['cookie']).toBeUndefined();
  fail = false;
  await send.click();
  await expect(panel.getByRole('status')).toContainText('counted privately');
  await expect(panel.getByRole('checkbox')).not.toBeChecked();
  await expect(send).toBeDisabled();
  await page.screenshot({ path: 'test-results/player-feedback.png' });
});
