import { expect, test } from '@playwright/test';

test('the civilization hub opens exact city layers and recorded clues', async ({ page, request }) => {
  const recorded = await request.post('/api/causality/world-scenario');
  expect(recorded.ok(), await recorded.text()).toBe(true);
  await page.goto('/world/civilization/');
  await page.getByRole('link', { name: 'Archaeology of the Future' }).click();
  await expect(page.getByRole('heading', { name: 'Month 16', exact: true })).toBeVisible();
  const row = page.locator('#layers li').filter({ has: page.getByRole('heading', { name: 'Month 16', exact: true }) });
  await expect(row.getByRole('link', { name: 'Open city checkpoint' })).toHaveAttribute('href', /month=16/);
  await row.getByRole('link', { name: 'Inspect recorded event' }).click();
  await expect(page.getByRole('heading', { name: 'PROJECT_COMPLETED', exact: true })).toBeVisible();

  await page.goBack();
  await page.getByLabel('Entity type').selectOption('businesses');
  await expect(page.locator('#layers li').first()).toBeVisible();
});

test('the planner runs matched futures in a worker and opens a reproducible City pair', async ({ page }) => {
  await page.goto('/world/civilization/');
  await page.getByRole('link', { name: 'Riverside Planning Lab' }).click();
  await page.getByRole('button', { name: 'Run planner experiment' }).click();
  await expect(page.getByRole('heading', { name: 'Forecast and simulated outcomes' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Planner experiment complete.');
  await expect(page.getByText(/of 100 pairs recorded a commute/)).toBeVisible();
  await page.getByText('Inspect the planner’s assumptions').click();
  await expect(page.getByText(/receives the expansion/)).toBeVisible();
  const replay = page.getByRole('link', { name: 'Replay the first comparable City pair' });
  await expect(replay).toHaveAttribute('href', /^\/world\/living-city\/\?challenge=living-city-commute\.v1%2Bcity-systems/);
  await replay.click();
  await expect(page).toHaveURL(/challenge=/);
  const replayIndex = Number(new URL(page.url()).searchParams.get('challenge').split(':').at(-1));
  await expect(page.locator('#pair-status')).toContainText(`Pair ${replayIndex + 1} · Seed`);
});

test('the genome combines ingredients, reruns assumptions, and reopens the same monthly series', async ({ page }) => {
  await page.goto('/world/laboratory/');
  await page.getByRole('link', { name: 'World Genome' }).click();
  await page.getByLabel('Construction capacity × baseline').fill('0.65');
  await page.getByRole('checkbox', { name: /Riverside flood/ }).check();
  await page.getByRole('checkbox', { name: /Materials shortage/ }).check();
  await page.getByRole('button', { name: 'Run matched futures' }).click();
  await expect(page.getByRole('status')).toHaveText('Matched futures complete.');
  await expect(page.getByText(/Remove construction capacity change/)).toBeVisible();
  await expect(page.getByText(/Remove riverside flood change/)).toBeVisible();
  await expect(page.getByText(/Remove materials shortage change/)).toBeVisible();
  await page.getByLabel('Measure over time').selectOption('meanRent');
  await page.getByRole('slider', { name: 'Inspect month' }).press('Home');
  await expect(page.locator('#plot-value')).toContainText('Month 0');
  const share = page.getByRole('link', { name: 'Open the shareable recipe' });
  const url = await share.getAttribute('href');
  const metrics = await page.locator('#metrics').innerText();
  await page.goto(url);
  await expect(page.getByRole('status')).toHaveText('Matched futures complete.');
  await expect(page.getByRole('checkbox', { name: /Riverside flood/ })).toBeChecked();
  await expect(page.locator('#metrics')).toHaveText(metrics, { useInnerText: true });
});

test('the Atlas runs a matched grid and reopens a selected future at an exact month', async ({ page }) => {
  await page.goto('/world/laboratory/');
  await page.getByRole('link', { name: 'Tipping Point Atlas' }).click();
  await page.getByLabel('Months', { exact: true }).fill('12');
  await page.getByLabel('Starting households').fill('30');
  await page.getByRole('button', { name: 'Run sweep' }).click();
  await expect(page.locator('#sweep-status')).toHaveText('Completed 75 of 75 modeled scenarios.', { timeout: 20000 });
  await expect(page.locator('#grid tbody button')).toHaveCount(25);
  await page.locator('#grid tbody button').first().click();
  await expect(page.locator('#samples li')).toHaveCount(3);
  await page.getByRole('link', { name: 'Open seed 42' }).click();
  await expect(page.locator('#sample-status')).toHaveText('Recomputed from the selected recipe.');
  await expect(page.locator('#districts tr')).toHaveCount(3);
  await page.getByRole('slider', { name: /Snapshot month/ }).press('Home');
  await expect(page).toHaveURL(/month=0/);
  await page.reload();
  await expect(page.locator('#selected-month')).toContainText('0 of 12');
});
