import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCityApi } from '../world/city/api.js';
import { createCity } from '../world/city/seed.js';
import { CityStore } from '../world/city/storage.js';
import { compareMonths, replayMonths } from '../world/sprint2/delta-model.js';

test('compares any returned months in a saved city replay by stable entity ID', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hbl-delta-'));
  const store = new CityStore(root);
  const handle = createCityApi({ store });
  const request = async (path, body) => {
    const response = await handle(new Request(`http://localhost${path}`, body === undefined ? {} : {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(response.ok).toBe(true);
    return response.json();
  };

  try {
    const initial = createCity({ households: 9 });
    for (const utility of initial.utilities) utility.capacity = 1000;
    initial.projects.push({
      id: 'delta-housing', districtId: 'd0', type: 'housing', stage: 'construction',
      units: 2, amount: 2, duration: 2, progress: 0, cost: 100, costOverrun: 0,
      displacedUnits: [], displacedBusinesses: [],
    });
    const { id } = await request('/api/city-experiments', {
      initial, runs: 2, months: 4, scenarios: [{ id: 'baseline' }],
    });
    let record;
    for (let attempt = 0; attempt < 100; attempt++) {
      record = await request(`/api/city-experiments/${id}`);
      if (!['queued', 'running'].includes(record.status)) break;
      await Bun.sleep(25);
    }
    expect(record.status).toBe('complete');

    const replay = await request(`/api/experiments/${id}/replay`, { scenarioId: 'baseline', runIndex: 1 });
    const months = replayMonths(replay);
    expect([...months.keys()]).toEqual([1, 2, 3, 4]);
    expect(months.get(2).seed).toBe(initial.seed + 1);
    const report = compareMonths(months, 1, 3);
    const added = report.buildings.rows.find(row => row.id === 'building-delta-housing');
    expect(added.kind).toBe('added');
    expect(added.before).toBeUndefined();
    expect(added.after).toEqual(months.get(3).buildings.find(row => row.id === added.id));
    const removed = compareMonths(months, 3, 1).buildings.rows.find(row => row.id === added.id);
    expect(removed).toMatchObject({ kind: 'removed', before: added.after });
    expect(removed.after).toBeUndefined();

    for (const domain of ['businesses', 'households']) {
      const changed = report[domain].rows.find(row => row.kind === 'changed');
      expect(changed.fields.length).toBeGreaterThan(0);
      expect(changed.before).toEqual(months.get(1)[domain].find(row => row.id === changed.id));
      expect(changed.after).toEqual(months.get(3)[domain].find(row => row.id === changed.id));
    }
    expect(compareMonths(months, 2, 2).households.counts).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(() => compareMonths(months, 0, 2)).toThrow('available months');
    expect(() => replayMonths({ steps: [replay.steps[0], replay.steps[0]] })).toThrow('duplicate months');

    const { businesses, ...partial } = months.get(3);
    const partialMonths = new Map(months).set(3, partial);
    expect(compareMonths(partialMonths, 1, 3).businesses).toEqual({ unavailableMonths: [3] });
    partialMonths.set(3, { ...partial, businesses: [] });
    expect(compareMonths(partialMonths, 1, 3).businesses.counts.removed).toBe(months.get(1).businesses.length);
    partialMonths.set(3, { ...partial, businesses: [businesses[0], businesses[0]] });
    expect(compareMonths(partialMonths, 1, 3).businesses).toEqual({ unavailableMonths: [3] });
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
