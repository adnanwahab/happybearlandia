import { expect, test } from '@playwright/test';

test('complete the guided challenge and replay its exact event in a clean browser', async ({ page, browser }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: async text => { window.copiedReceipt = text; },
    } });
  });
  await page.goto('/world/living-city/');
  const status = page.locator('#challenge-status');
  await page.getByRole('button', { name: 'Begin challenge' }).click();
  await expect(status).toContainText('1/4');
  await page.locator('#investment').selectOption('12');
  await expect(status).toContainText('1/4');
  await page.locator('#test').click();
  await expect(status).toContainText('2/4');
  await page.locator('#copy').click();
  await expect(status).toContainText('2/4');
  await page.getByText('Inspect one recorded event', { exact: true }).click();
  await expect(status).toContainText('3/4');
  const event = await page.locator('#event-record').textContent();
  expect(JSON.parse(event).event).toBeTruthy();
  await page.locator('#copy').click();
  await expect(status).toContainText('4/4');
  const receipt = await page.evaluate(() => window.copiedReceipt);
  expect(receipt).toBe(await page.locator('#share').inputValue());
  const measurements = await page.locator('#pair dd').allTextContents();
  const clean = await browser.newContext();
  try {
    const replay = await clean.newPage();
    await replay.goto(receipt);
    await expect(replay.locator('#pair dd')).toHaveText(measurements);
    await expect(replay.locator('#event-record')).toHaveText(event);
    await expect(replay.locator('#investment')).toHaveValue('12');
    await expect(replay.locator('#share')).toHaveValue(receipt);
  } finally { await clean.close(); }
  await page.locator('#sample').selectOption('6');
  await expect(status).toContainText('2/4');
  await expect(page.locator('#event-inspector')).not.toHaveAttribute('open');
  await page.getByText('Inspect one recorded event', { exact: true }).click();
  await expect(status).toContainText('3/4');
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  });
  await page.locator('#copy').click();
  await expect(status).toContainText('Clipboard unavailable');
  await expect(page.locator('#share')).not.toHaveValue('');
  await page.locator('#investment').selectOption('4');
  await expect(status).toContainText('1/4');
  await expect(page.locator('#results')).toBeHidden();
});

test('a failed simulation cannot complete the run milestone and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, ...args) {
        if (message.action === 'compare' && !this.failedOnce) {
          this.failedOnce = true;
          queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', {
            data: { id: message.id, error: 'Controlled comparison failure' },
          })));
          return;
        }
        return super.postMessage(message, ...args);
      }
    };
  });
  await page.goto('/world/living-city/');
  await page.locator('#begin').click();
  await page.locator('#test').click();
  await expect(page.locator('#progress')).toContainText('Controlled comparison failure');
  await expect(page.locator('#challenge-status')).toContainText('1/4');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#test')).toBeEnabled();
  await page.locator('#test').click();
  await expect(page.locator('#challenge-status')).toContainText('2/4');
});
