import { expect, test } from '@playwright/test';

for (const days of [30, 90]) {
  test('a resident day advances and persists an exact ' + days + '-day follow-up', async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.goto('/world/government/index.html');
    const fixture = await page.evaluate(async () => {
      const { createCustomHouseholdSave } = await import('/world/house/creator-model.js');
      const { createPopulationRuntime } = await import('/world/population/runtime.js');
      const { readPopulationCheckpoint } = await import('/world/population/checkpoint.js');
      const { save, householdId } = await createCustomHouseholdSave({
        name: 'Playable Life QA',
        startingMoney: 14250,
        relationship: 'roommates',
        members: [{
          name: 'Alex Day',
          ageYears: 35,
          voice: 'warm',
          skinColor: '#d1a77c',
          shirtColor: '#658da6',
          hairColor: '#534d36',
          traits: ['social', 'romantic', 'creative'],
          interests: ['hobbies'],
        }],
      }, {
        runtimeFactory: options => createPopulationRuntime({
          ...options,
          stepMinutes: 15,
          clockMode: 'ticks-per-poll',
        }),
      });
      const { model, runtime } = readPopulationCheckpoint(save.checkpoint);
      return { save, householdId, personId: model.prefix + '-p0', minute: model.minute, tick: runtime.tick };
    });

    await page.evaluate(async fixture => {
      const { mountHouseEntryControls } = await import('/world/house/bridge.js');
      const inspector = document.createElement('section');
      inspector.setAttribute('data-lc-person', '');
      document.body.append(inspector);
      mountHouseEntryControls({
        container: document.body,
        getSelection: () => ({ mode: 'living', id: fixture.personId, householdId: fixture.householdId }),
        getBuilding: () => null,
        getRuntime: () => true,
        capture: () => structuredClone(fixture.save),
      });
    }, fixture);
    const startResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/world-experiments' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Live a day as this resident' }).click();
    const created = await startResponse;
    expect(created.status()).toBe(201);
    const house = '/world/house/' + encodeURIComponent(fixture.householdId);
    await page.waitForURL(url => url.pathname === house && url.searchParams.has('experiment'));
    const startId = new URL(page.url()).searchParams.get('experiment');
    const startRecord = await request.get('/api/world-experiments/' + startId);
    expect(startRecord.status()).toBe(200);
    const { checksum: startChecksum } = await startRecord.json();
    await expect(page).toHaveURL(house + '?' + new URLSearchParams({
      experiment: startId, person: fixture.personId, playableLife: '1',
    }));
    await expect(page.getByRole('heading', { name: 'Live a day as Alex Day' })).toBeVisible();
    const initialClock = page.getByText('1440 modeled minutes left in this day.');
    const accepted = page.getByText('Command accepted. Advance time to see elapsed effects.');
    await expect(initialClock).toBeVisible();
    await page.getByRole('button', { name: 'Rest', exact: true }).click();
    await expect(accepted).toBeVisible();
    await expect(initialClock).toBeVisible();

    await page.getByRole('button', { name: 'Advance time', exact: true }).click();
    await expect(page.getByText('1380 modeled minutes left in this day.')).toBeVisible();
    await page.getByRole('button', { name: 'Buy a plant', exact: true }).click();
    await expect(accepted).toBeVisible();

    const savedResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/world-experiments' && response.request().method() === 'POST',
      { timeout: 90_000 });
    await page.getByRole('combobox', { name: 'Autonomous follow-up duration' }).selectOption(String(days));
    await page.getByRole('button', { name: 'End the day and observe ' + days + ' days' }).click();
    await expect(page.getByRole('combobox', { name: 'Autonomous follow-up duration' })).toBeDisabled();
    await page.getByRole('button', { name: 'Pause follow-up' }).click();
    await expect(page.getByText(/resume from the last committed minute/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue follow-up and save' }).click();
    const saved = await savedResponse;
    expect(saved.status(), await saved.text()).toBe(201);
    const { id: followUpId } = await saved.json();
    expect(followUpId).not.toBe(startId);
    await expect(page.getByRole('heading', { name: 'Resident changes' })).toBeVisible();
    const reviewURL = house + '?' + new URLSearchParams({
      experiment: followUpId, person: fixture.personId, lifeReview: '1',
    });
    await expect(page).toHaveURL(reviewURL);
    await expect(page.getByRole('link', { name: 'Open starting World checkpoint' }))
      .toHaveAttribute('href', '/world?experiment=' + startId);
    await expect(page.getByRole('link', { name: 'Open follow-up World checkpoint' }))
      .toHaveAttribute('href', '/world?experiment=' + followUpId);

    const persisted = await request.get('/api/world-experiments/' + followUpId);
    expect(persisted.status()).toBe(200);
    const record = await persisted.json();
    expect(record.parentId).toBe(startId);
    expect(record.save.view.playableLife.actions.map(receipt => [receipt.action, receipt.minute])).toEqual([
      ['rest', fixture.minute],
      ['purchase', fixture.minute + 60],
    ]);
    expect(record.save.view.playableLife.controlSession).toMatchObject({
      runId: startId,
      entityId: fixture.personId,
      startTick: fixture.tick,
      endTick: fixture.tick + 96,
    });
    const finalMinute = await page.evaluate(async checkpoint => {
      const { readPopulationCheckpoint } = await import('/world/population/checkpoint.js');
      return readPopulationCheckpoint(checkpoint).model.minute;
    }, record.save.checkpoint);
    expect(finalMinute).toBe(fixture.minute + (days + 1) * 1440);
    expect(record.save.view.playableLife.followUp).toEqual({
      days, startMinute: fixture.minute + 1440,
      endMinute: finalMinute, endTick: fixture.tick + (days + 1) * 96,
    });
    const original = await request.get('/api/world-experiments/' + startId);
    expect((await original.json()).checksum).toBe(startChecksum);

    const reviewWrites = [];
    page.on('request', event => {
      if (event.method() === 'POST' && new URL(event.url()).pathname === '/api/world-experiments') {
        reviewWrites.push(event.url());
      }
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'A day as Alex Day' })).toBeVisible();
    await expect(page.getByText('The city advanced ' + days + ' modeled days after the resident’s day ended.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rest', exact: true })).toHaveCount(0);
    await page.getByText('Inspect recorded events and decisions', { exact: true }).click();
    await expect(page.getByText(new RegExp('Minute ' + fixture.minute + ' · Rest'))).toBeVisible();
    await expect(page.getByText(new RegExp('Minute ' + (fixture.minute + 60) + ' · Buy a plant'))).toBeVisible();
    expect(reviewWrites).toEqual([]);
  });

}
