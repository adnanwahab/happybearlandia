import { test, expect } from '@playwright/test';

test('Plan page follows backend lifecycle and sends cancel/retry actions', async ({ page }) => {
  let state = 'queued';
  const actions = [];
  await page.route('**/api/world/experiments**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/cancel')) { actions.push('cancel'); state = 'canceled'; }
    else if (path.endsWith('/retry')) { actions.push('retry'); state = 'retrying'; }
    await route.fulfill({ json: { experimentId: 'fixture', statusUrl: '/api/world/experiments/fixture', lifecycle: state, progress: { step: 2, totalSteps: 4 }, error: state === 'failed' ? 'Controlled failure' : null } });
  });
  await page.goto('/world/plan?proposals=t_bus&autorun=0');
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  for (const next of ['queued', 'starting', 'running']) {
    state = next;
    await expect(page.getByRole('status')).toHaveAttribute('data-state', next);
    await expect(page.getByRole('button', { name: 'Simulate', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel run', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
  await expect(page.getByRole('status')).toHaveAttribute('data-state', 'canceled');
  const retry = page.getByRole('button', { name: 'Retry same run', exact: true });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(page.getByRole('status')).toHaveAttribute('data-state', 'retrying');
  state = 'failed';
  await expect(page.getByRole('status')).toContainText('Controlled failure');
  await expect(retry).toBeEnabled();
  expect(actions).toEqual(['cancel', 'retry']);
});
