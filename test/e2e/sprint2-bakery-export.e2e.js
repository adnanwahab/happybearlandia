import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const exportPath = '/world/sprint2/bakery-export.html';

test('downloads canonical local evidence for the intervention selected in the journey', async ({ page, baseURL }) => {
  const remoteRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(baseURL).origin) {
      remoteRequests.push(url.href);
    }
  });

  await page.goto('/world/journeys/bakery.html?month=75');
  await page.getByRole('button', { name: /reopen the route/i }).click();
  await expect(page.locator('#experiment-status')).toContainText('The bakery still closes');
  await page.getByRole('link', { name: 'Export Bakery evidence' }).click();
  await expect(page.locator('#recipe-details')).toContainText('month 75');
  await expect(page.locator('#final-summary')).toContainText('The intervention shows bakery closed');
  await expect(page.getByRole('heading', { name: 'Model limitations' })).toBeVisible();

  async function downloadEvidence() {
    const link = page.getByRole('link', { name: 'Download evidence JSON' });
    await expect(link).toHaveAttribute('href', /^blob:/);
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toBe('bakery-evidence-bakery-v1.2911.75.json');
    return readFile(await download.path(), 'utf8');
  }

  const bytes = await downloadEvidence();
  const { runs, transportEvidence } = JSON.parse(bytes);
  expect(runs.baseline.months[72].workerHours).toBe(3.2);
  expect(runs.intervention.events.at(-1).month).toBe(75);
  expect(transportEvidence.closedRoad.result.traces[0].unserved).toBe(60);
  await page.reload();
  expect(await downloadEvidence()).toBe(bytes);
  expect(remoteRequests).toEqual([]);
});

test('opens the default comparison directly and shows an error for unsupported recipes', async ({ page }) => {
  await page.goto(exportPath);
  await expect(page.locator('#recipe-details')).toContainText('month 72');
  await expect(page.locator('#final-summary')).toContainText('The intervention shows bakery open');
  await page.goto(exportPath + '?recipe=bakery-v999.2911.72');
  await expect(page.getByRole('status')).toContainText('The comparison could not be exported');
  await expect(page.getByRole('link', { name: 'Download evidence JSON' })).toBeHidden();
});
