import { test, expect } from '@playwright/test';
test('session survey offers a collapsed form after two replays with consent, failure, retry and skip', async ({ page }) => {
  const calls = []; let fail = true;
  await page.route('**/api/session-survey', async route => {
    calls.push(route.request());
    await route.fulfill({ status: fail ? 503 : 201, contentType: 'application/json', body: fail ? '{}' : '{"ok":true}' });
  });
  // Real UI module with controlled lifecycle inputs; controller integration is checked separately.
  await page.goto('/world/');
  await page.evaluate(async () => {
    const { mountSessionSurvey } = await import('/world/onboarding/session-survey.js');
    document.body.replaceChildren();
    window.survey = mountSessionSurvey(document.body);
    window.survey.update({ status: 'completed' });
  });
  const panel = page.getByTestId('session-survey');
  await expect(panel).toBeHidden();
  await page.evaluate(() => { survey.replayStarted(); survey.update({ status: 'completed' }); });
  await expect(panel).toBeHidden();
  await page.evaluate(() => { survey.replayStarted(); survey.update({ status: 'completed' }); });
  await expect(panel.locator('summary')).toBeVisible();
  await expect(panel.locator('form')).toBeHidden();
  await panel.locator('summary').click();
  const send = panel.getByRole('button', { name: 'Send session feedback' });
  await expect(send).toBeDisabled();
  await panel.getByLabel('One suggestion', { exact: false }).fill('Make the comparison easier to follow.');
  await panel.getByRole('checkbox').check();
  await send.click();
  await expect(panel.getByRole('status')).toContainText('Could not confirm');
  await expect(send).toBeEnabled();
  expect(calls[0].postDataJSON()).toEqual({ version: 1, consent: true, rating: '', suggestion: 'Make the comparison easier to follow.' });
  expect(calls[0].headers()['referer']).toBeUndefined();
  fail = false; await send.click();
  await expect(panel.getByRole('status')).toContainText('feedback was saved');
  await expect(panel.getByRole('checkbox')).not.toBeChecked();
  await expect(send).toBeDisabled();
  await panel.getByRole('button', { name: 'Skip feedback' }).click();
  await expect(panel).toBeHidden(); expect(calls).toHaveLength(2);
});
