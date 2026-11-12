import { expect, test } from '@playwright/test';
import { decodePlan, futureURL } from '../../world/invention/model.js';

test('search results replay, combine in Merge Studio, and pause at an exact month', async ({ page }) => {
  await page.goto('/world/invention/');
  await page.getByRole('link', { name: 'Reverse Simulator' }).click();
  await page.getByLabel('Target commute reduction (%)').fill('25');
  await page.getByLabel('Maximum proposed cost (USD)').fill('250000');
  await page.getByRole('checkbox', { name: 'Build public housing' }).uncheck();
  await page.getByRole('checkbox', { name: 'Change zoning capacity' }).uncheck();
  await page.getByRole('button', { name: 'Find plans' }).click();
  await expect(page.getByRole('heading', { name: 'Commute target met' })).toBeVisible();
  await page.getByRole('link', { name: 'Open future ↗' }).first().click();
  await expect(page.getByRole('heading', { name: 'Month 14', exact: true })).toBeVisible();
  const source = decodePlan(new URL(page.url()).searchParams.get('plan'));
  expect(source.policies.every(id => id.startsWith('transit-'))).toBe(true);

  await page.getByRole('link', { name: 'Use this plan in Merge Studio' }).click();
  await expect(page.getByLabel('Future A link')).toHaveValue(/plan=/);
  await page.getByLabel('Future B link').fill(futureURL({ ...source, policies: ['housing-d0-3'] }));
  await page.getByRole('button', { name: 'Merge and rerun' }).click();
  await expect(page.getByRole('heading', { name: 'Four futures from one starting city' })).toBeVisible();
  await page.getByRole('link', { name: 'Open merged ↗' }).click();
  await expect(page.getByRole('heading', { name: 'Month 14', exact: true })).toBeVisible();
  const merged = decodePlan(new URL(page.url()).searchParams.get('plan'));
  expect(merged.policies).toEqual([...source.policies, 'housing-d0-3'].sort());

  await page.getByRole('link', { name: 'Set a breakpoint for this plan' }).click();
  await page.getByLabel('Comparison').selectOption('gte');
  await page.getByLabel('Threshold').fill('0');
  await page.getByRole('button', { name: 'Run from the start' }).click();
  await expect(page.getByRole('heading', { name: 'Paused at month 3' })).toBeVisible();
  await page.getByRole('link', { name: 'Open this month in the scenario viewer' }).click();
  await expect(page.getByRole('heading', { name: 'Month 3', exact: true })).toBeVisible();
  expect(decodePlan(new URL(page.url()).searchParams.get('plan'))).toEqual(merged);
});

test('the inverse search reports when a budget admits no feasible plan', async ({ page }) => {
  await page.goto('/world/invention/reverse/');
  await page.getByLabel('Maximum proposed cost (USD)').fill('0');
  await page.getByLabel('Target commute reduction (%)').fill('25');
  await page.getByRole('button', { name: 'Find plans' }).click();
  await expect(page.getByRole('heading', { name: 'No feasible plan found' })).toBeVisible();
  await expect(page.locator('#coverage')).toContainText('0 alternatives evaluated');
});
