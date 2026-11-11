import { expect, test } from 'bun:test';
import { createWorldPersistenceHandler } from '../world/experiments/persistence-api.js';
import { createPopulationCheckpoint, readPopulationCheckpoint } from '../world/population/checkpoint.js';
import { appendFamilyChild } from '../world/population/population-growth.js';
import { createPopulationRuntime } from '../world/population/runtime.js';
import { defaultResident, familyView, fetchCheckpoint, replayURL, residentHistory } from
  '../world/civilization/families/history.js';

test('saved population families retain parent links, birth evidence, and exact checkpoint history', async () => {
  const runtime = createPopulationRuntime({ config: { population: 60, seed: 31 }, stepMinutes: 1 });
  const ids = ['family0001', 'family0002', 'family0003'];
  const handle = createWorldPersistenceHandler({ dbPath: ':memory:', idFactory: () => ids.shift() });
  const fetcher = (path, init) => handle(new Request('http://localhost' + path, init));
  const origin = { lat: 29.7286, lng: -95.4746 };
  async function save(checkpoint, label, parentId, selection) {
    const response = await fetcher('/api/world-experiments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'world-experiment-save.v1',
        label, parentId, mode: 'living', checkpoint,
        view: { origin, selection }, geometry: { area: {} },
      }),
    });
    expect(response.status).toBe(201);
    return response.json();
  }
  try {
    await runtime.ready;
    const before = await runtime.exportCheckpoint();
    const root = await save(before, 'Before adoption');
    await runtime.step();
    const state = readPopulationCheckpoint(await runtime.exportCheckpoint());
    const { model } = state;
    const adult = model.people.ageYears.findIndex(age => age >= 18);
    const household = model.people.household[adult];
    const child = appendFamilyChild(model, {
      id: 'plan-family-adopt',
      household,
      parentIndices: [adult],
      name: 'Morgan',
      method: 'adoption',
      ageYears: 4,
    });
    const person = model.prefix + '-p' + child;
    const parent = model.prefix + '-p' + adult;
    const record = await save(createPopulationCheckpoint(state), 'After adoption', root.id,
      { type: 'person', id: person });
    const loaded = await fetchCheckpoint(record.id, { fetcher });

    expect(defaultResident(loaded)).toBe(person);
    expect(familyView(loaded.model, person)).toMatchObject({
      focus: { id: person, name: 'Morgan', age: 4 },
      ancestors: [[{ person: { id: parent }, evidence: {
        id: 'plan-family-adopt', method: 'adoption', minute: 1,
      } }]],
      descendants: [],
    });
    expect(familyView(loaded.model, parent).descendants.flat().some(link => link.person.id === person)).toBe(true);
    expect(() => familyView(loaded.model, 'unrelated-p0')).toThrow('absent');

    const history = await residentHistory(loaded, person, { fetcher });
    expect(history.rows).toMatchObject([
      { id: record.id, minute: 1, tick: 1, person: { id: person } },
      { id: root.id, minute: 0, tick: 0, person: null },
    ]);
    expect(history.notice).toBeUndefined();
    expect(replayURL(root.id)).toBe(root.url);

    const discontinuity = await save(before, 'Earlier clock', record.id);
    const unmatched = await fetchCheckpoint(discontinuity.id, { fetcher });
    const stopped = await residentHistory(unmatched, parent, { fetcher });
    expect(stopped.rows).toHaveLength(1);
    expect(stopped.notice).toContain('different population or clock');
    await expect(fetchCheckpoint('notfound', { fetcher })).rejects.toThrow('was not found');
  } finally {
    runtime.destroy();
    handle.close();
  }
});
