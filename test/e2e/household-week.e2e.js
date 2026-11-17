import { test, expect } from '@playwright/test';

test('inspector opens an exact household week; saved replay shows authoritative records and reloads read-only', async ({ page, request }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/world/government/index.html');
  const fixture = await page.evaluate(async () => {
    const { createCustomHouseholdSave } = await import('/world/house/creator-model.js');
    const { createPopulationRuntime } = await import('/world/population/runtime.js');
    const { save, householdId } = await createCustomHouseholdSave({ name: 'Week QA', startingMoney: 14250,
      relationship: 'roommates', members: [{ name: 'Week Resident', ageYears: 35, voice: 'warm',
        skinColor: '#d1a77c', shirtColor: '#658da6', hairColor: '#534d36', traits: ['social'], interests: ['hobbies'] }] },
      { runtimeFactory: options => createPopulationRuntime({ ...options, stepMinutes: 30, clockMode: 'ticks-per-poll' }) });
    const { readPopulationCheckpoint } = await import('/world/population/checkpoint.js');
    const { model } = readPopulationCheckpoint(save.checkpoint);
    const { mountHouseEntryControls } = await import('/world/house/bridge.js');
    const inspector = document.createElement('section'); inspector.setAttribute('data-lc-person', ''); document.body.append(inspector);
    mountHouseEntryControls({ container: document.body,
      getSelection: () => ({ mode: 'living', id: model.prefix + '-p0', householdId }), getBuilding: () => null,
      getRuntime: () => true, capture: () => structuredClone(save) });
    return { householdId, minute: model.minute };
  });
  await page.getByRole('button', { name: 'Follow household for a week', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Follow this household for a week' })).toBeVisible();
  const parentId = new URL(page.url()).searchParams.get('experiment');
  const parent = await (await request.get('/api/world-experiments/' + parentId)).json();
  await page.getByRole('button', { name: 'Observe seven days and save replay' }).click();
  await page.getByRole('button', { name: 'Pause week', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('paused');
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/world-experiments' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Resume week and save replay' }).click();
  const response = await saved; expect(response.status(), await response.text()).toBe(201);
  const finalId = (await response.json()).id;
  await expect(page.getByRole('heading', { name: 'Household week replay' })).toBeVisible();
  const record = await (await request.get('/api/world-experiments/' + finalId)).json();
  const report = record.save.view.householdWeek;
  expect(report.householdId).toBe(fixture.householdId);
  expect(report.startMinute).toBe(fixture.minute); expect(report.endMinute).toBe(fixture.minute + 10080);
  expect(report.observations).toHaveLength(8); expect(record.parentId).toBe(parentId);
  const expected = report.events.map(e => ({ id: e.id, text: `Minute ${e.minute} · ${e.type} · ${e.id}`, record: JSON.stringify(e, null, 2) }));
  expect(await page.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.eventId,
    text: node.firstChild.textContent, record: node.querySelector('pre').textContent })))).toEqual(expected);
  await expect(page.getByText(/unobserved or evicted events cannot be reconstructed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rest', exact: true })).toHaveCount(0);
  expect((await (await request.get('/api/world-experiments/' + parentId)).json()).checksum).toBe(parent.checksum);
  const writes = []; page.on('request', r => { if (r.method() === 'POST') writes.push(r.url()); });
  await page.reload(); await expect(page.getByRole('heading', { name: 'Household week replay' })).toBeVisible();
  expect(await page.locator('[data-event-id]').count()).toBe(report.events.length);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
