import { expect, test } from 'bun:test';
import { createWorldPersistenceHandler } from '../world/experiments/persistence-api.js';
import { runHouseCheckpointTask } from '../world/house/checkpoint-tasks.js';
import { createPopulationCheckpoint, readPopulationCheckpoint } from '../world/population/checkpoint.js';
import { createPopulationRuntime } from '../world/population/runtime.js';
import {
  buildZoomIndex, listZoomCheckpoints, loadZoomIndex, pathAtLevel, resolveZoom, zoomPathFromURL, zoomURL,
} from '../world/civilization-zoom/model.js';

const origin = 'http://localhost';
const geo = { lat: 29.7286, lng: -95.4746 };
const experiment = 'zoomSave01';

test('Civilization Zoom drills through exact saved anchors and opens the same household, resident, and clock', async () => {
  const runtime = createPopulationRuntime({
    config: { population: 12, seed: 91 }, stepMinutes: 1,
    worldContext: { origin: geo, buildings: [{ id: 'osm-home-1', center: [5, 5] }] },
  });
  const handler = createWorldPersistenceHandler({ dbPath: ':memory:', idFactory: () => experiment });
  const fetcher = (path, init) => handler(new Request(origin + path, init));
  try {
    await runtime.ready;
    await runtime.step();
    const saved = readPopulationCheckpoint(await runtime.exportCheckpoint());
    const { model } = saved;
    const person = model.prefix + '-p0';
    const other = model.prefix + '-p1';
    const id = `${person}-retained`;
    model.traces = [['person:0', [{ id, type: 'ACTIVITY_CHOICE', minute: model.minute, chosen: 'HOME' }]]];
    model.social.ties[JSON.stringify([person, other].sort())] = {
      a: person, b: other, kind: 'Household', lastMinute: model.minute,
      memories: [{ minute: model.minute, event: 'talk', text: 'Saved conversation' }],
    };
    const save = {
      schemaVersion: 'world-experiment-save.v1', mode: 'living', label: 'Mapped world',
      checkpoint: createPopulationCheckpoint(saved), view: { origin: geo }, geometry: { area: {} },
    };
    const response = await fetcher('/api/world-experiments', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(save),
    });
    expect(response.status).toBe(201);
    expect(await listZoomCheckpoints({ fetcher })).toMatchObject([{ id: experiment, label: 'Mapped world' }]);

    const index = await loadZoomIndex(experiment, { fetcher });
    expect(index.checkpoint.tick).toBe(1);
    expect(index.origin).toEqual(geo);
    const direct = zoomPathFromURL(new URLSearchParams({ experiment, person }));
    const resident = resolveZoom(index, direct);
    expect(resident.anchor.buildingId).toBe('osm-home-1');
    expect(resident.household.residents).toContain(0);
    expect(resident.resident).toMatchObject({
      id: person, decisions: [{ id, minute: 1 }],
      links: [{ path: { person: other }, memories: [{ text: 'Saved conversation' }] }],
    });
    expect(resolveZoom(index, pathAtLevel(resident.path, 'district')).district.anchors.has(resident.path.location)).toBe(true);
    const restored = zoomPathFromURL(new URL(zoomURL(experiment, resident.path), origin).search);
    expect(restored).toEqual(resident.path);

    const house = new URL(resident.resident.house, origin);
    const householdId = decodeURIComponent(house.pathname.split('/').at(-1));
    expect(house.searchParams.get('experiment')).toBe(experiment);
    expect(house.searchParams.get('person')).toBe(person);
    expect(house.searchParams.get('playableLife')).toBe('1');
    const record = await (await fetcher('/api/world-experiments/' + experiment)).json();
    const prepared = runHouseCheckpointTask({ kind: 'prepare', save: record.save, householdId });
    expect(prepared.entry).toMatchObject({ householdId, minute: 1 });
    expect(prepared.entry.members).toContain(person);
    expect(new URL(resident.resident.braids, origin).searchParams.get('person')).toBe(person);
    expect(() => resolveZoom(index, { ...resident.path, household: 'other-save-h0' })).toThrow('unavailable');
    expect(() => resolveZoom(index, { level: 'resident', person: 'foreign-p0' })).toThrow('unavailable');
    await expect(loadZoomIndex('missing01', { fetcher })).rejects.toThrow('not found');
  } finally {
    runtime.destroy();
    handler.close();
  }
}, 20000);

test('homes without saved geometry keep their household and resident without inventing a building', async () => {
  const runtime = createPopulationRuntime({ config: { population: 4, seed: 7 }, stepMinutes: 1 });
  try {
    await runtime.ready;
    const { model } = readPopulationCheckpoint(await runtime.exportCheckpoint());
    const index = buildZoomIndex({ id: experiment, tick: 0, model });
    const resident = resolveZoom(index, index.residentPaths[0]);
    expect(index.origin).toBeNull();
    expect(resident.anchor).toMatchObject({ buildingId: null, name: 'Homes without a building anchor' });
    expect(resident.resident.links).toEqual([]);
    expect(resident.resident.decisions).toEqual([]);
  } finally {
    runtime.destroy();
  }
}, 20000);
