import { test, expect } from '@playwright/test';

const route = '/world/future-split.html';

async function screenshot(page, testInfo, name) {
  if (process.env.HBL_FUTURE_SPLIT_SCREENSHOTS === '1') {
    await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
  }
}

test('homepage opens a synchronized comparison with real route and spending differences', async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Future Split Theater' }).click();

  const currentMonth = page.locator('#current-month');
  const month = page.getByRole('slider', { name: 'Simulation month' });
  await expect(currentMonth).toHaveText('Month 2');
  await expect(page.locator('#scene').getByText('Identical at this month')).toBeVisible();
  await expect(month).toHaveValue('2');

  await page.getByRole('button', { name: 'Play timeline' }).click();
  await expect(currentMonth).not.toHaveText('Month 2');
  await page.getByRole('button', { name: 'Pause timeline' }).click();
  await expect(page.getByRole('button', { name: 'Play timeline' })).toBeVisible();

  await page.getByRole('button', { name: /First divergence/ }).click();
  await expect(currentMonth).toHaveText('Month 4');
  await expect(page.locator('#scene')).toContainText('No entity differences at this month');
  await expect(page.locator('[data-metric="capitalSpending"]')).toContainText('160,000');

  await month.fill('12');
  await expect(currentMonth).toHaveText('Month 12');
  const routeId = 'route:transit-d1-d0';
  const routeButton = page.locator('#inspector').getByRole('button').and(page.locator(`[data-entity-id="${routeId}"]`));
  await page.locator(`#scene [data-arm="intervention"] [data-entity="${routeId}"] .split-route-point`).click();
  await expect(routeButton).toHaveAttribute('aria-pressed', 'true');
  const details = page.locator('.fs-entity-detail');
  await expect(details).toContainText('transit-d1-d0');
  const capacity = details.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: 'capacity', exact: true }),
  });
  await expect(capacity.getByRole('cell')).toHaveText(['1', '9']);
  await details.getByText('Monthly history', { exact: true }).click();
  await details.getByLabel('History field').selectOption('capacity');
  await details.getByRole('button', { name: 'Month 11', exact: true }).click();
  await expect(currentMonth).toHaveText('Month 11');
  await expect(capacity.getByRole('cell')).toHaveText(['1', '1']);
  await month.fill('12');
  await details.getByText('Monthly history', { exact: true }).click();
  await screenshot(page, testInfo, 'future-split-desktop.png');

  await page.getByRole('button', { name: 'Wipe', exact: true }).click();
  const reveal = page.getByRole('slider', { name: 'Reveal Future B' });
  await page.locator('.split-wipe-handle').scrollIntoViewIfNeeded();
  const canvas = await page.locator('.split-map-wipe .split-map-canvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await expect(reveal).toHaveValue('70');
  await expect(currentMonth).toHaveText('Month 12');
  await screenshot(page, testInfo, 'future-split-wipe.png');

  await page.getByRole('button', { name: 'A/B switch', exact: true }).click();
  const futureB = page.getByRole('button', { name: 'Future B', exact: true });
  await futureB.click();
  await expect(futureB).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#scene [data-arm=baseline]')).toHaveCount(0);
  await expect(page.locator('#scene [data-arm=intervention]')).toHaveCount(1);
  await expect(currentMonth).toHaveText('Month 12');

  await page.reload();
  await expect(currentMonth).toHaveText('Month 12');
  await expect(page.getByLabel('Future B policy')).toHaveValue('transit-d1-8');
  await expect(month).toHaveValue('12');
  await expect(routeButton).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('mobile shows an identical control and recovers from an invalid recipe link', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route + '?run=invalid');
  await expect(page.getByRole('status').filter({ hasText: 'recipe link is invalid' })).toBeVisible();
  await page.getByLabel('Future B policy').selectOption('');
  await page.getByRole('button', { name: 'Compare futures' }).click();

  const month = page.getByRole('slider', { name: 'Simulation month' });
  await expect(month).toHaveValue('2');
  await month.fill('14');
  await expect(page.locator('#current-month')).toHaveText('Month 14');
  await expect(page.locator('#scene').getByText('Identical at this month')).toBeVisible();
  await expect(page.getByRole('button', { name: /First divergence/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await screenshot(page, testInfo, 'future-split-mobile.png');
});

test('schematic marks added and removed records with selectable ghosts', async ({ page }) => {
  await page.goto(route + '?run=invalid');
  await page.evaluate(async () => {
    const { mountScene } = await import('/world/future-split/scene.js');
    const host = document.createElement('div');
    host.id = 'schematic-fixture';
    document.querySelector('main').append(host);
    const scene = mountScene(host, { onSelect(id) { host.dataset.selected = id; } });
    const oldBuilding = { id: 'building:old', modelId: 'old', kind: 'building', label: 'Old building', districtId: 'd0', fields: {} };
    const newBuilding = { id: 'building:new', modelId: 'new', kind: 'building', label: 'New building', districtId: 'd1', fields: {} };
    scene.render({
      month: 3,
      districts: [{ id: 'd0', name: 'Center' }, { id: 'd1', name: 'Riverside' }],
      baseline: { entities: [oldBuilding], metrics: {} },
      intervention: { entities: [newBuilding], metrics: {} },
      changes: [
        { id: oldBuilding.id, kind: 'building', status: 'removed', before: oldBuilding, after: null, fields: [] },
        { id: newBuilding.id, kind: 'building', status: 'added', before: null, after: newBuilding, fields: [] },
      ],
    }, null);
  });
  const fixture = page.locator('#schematic-fixture');
  const ghost = fixture.getByRole('button', { name: 'Old building, Removed marker, Future B' });
  await expect(ghost).toHaveClass(/split-ghost/);
  await ghost.press('Enter');
  await expect(fixture).toHaveAttribute('data-selected', 'building:old');
  await expect(fixture.getByRole('button', { name: 'New building, New, Future B' })).toBeVisible();
});
