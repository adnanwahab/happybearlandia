import { expect, test } from 'bun:test';
import { createWorldPersistenceHandler } from '../world/experiments/persistence-api.js';
import { createPopulationCheckpoint, readPopulationCheckpoint } from '../world/population/checkpoint.js';
import { createPopulationRuntime } from '../world/population/runtime.js';
import { firstDifference } from '../world/timeline-braids/comparison.js';
import { loadBraids } from '../world/timeline-braids/model.js';

test('reads actual immutable sibling saves and compares only matching resident minutes', async () => {
  const runtime = createPopulationRuntime({ config: { population: 60, seed: 31 }, stepMinutes: 1 });
  const ids = ['braid0001', 'braid0002', 'braid0003', 'braid0004'];
  const handle = createWorldPersistenceHandler({ dbPath: ':memory:', idFactory: () => ids.shift() });
  const fetcher = (path, init) => handle(new Request('http://localhost' + path, init));
  async function save(checkpoint, label, parentId, person) {
    const response = await fetcher('/api/world-experiments', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'world-experiment-save.v1', label, parentId, mode: 'living', checkpoint,
        view: { origin: { lat: 29.7286, lng: -95.4746 }, selection: { type: 'person', id: person } },
        geometry: { area: {} },
      }),
    });
    expect(response.status).toBe(201);
    return response.json();
  }

  try {
    await runtime.ready;
    const checkpoint = await runtime.exportCheckpoint();
    const start = readPopulationCheckpoint(checkpoint);
    const person = start.model.prefix + '-p0';
    const root = await save(checkpoint, 'Shared starting point', undefined, person);
    await runtime.step();
    const later = readPopulationCheckpoint(await runtime.exportCheckpoint());
    const original = later.model.people.income[0];
    const left = await save(createPopulationCheckpoint(later), 'Left future', root.id, person);
    later.model.people.income[0] += 2000;
    const right = await save(createPopulationCheckpoint(later), 'Right future', root.id, person);
    await save(checkpoint, 'Reversed time', left.id, person);

    const result = await loadBraids({ rootId: root.id, fetcher });
    expect(result.personId).toBe(person);
    expect(result.branches.map(path => path.map(row => row.id))).toEqual([[root.id, left.id], [root.id, right.id]]);
    expect(result.notices).toHaveLength(1);
    const difference = firstDifference(...result.branches);
    expect(difference).toMatchObject({ minute: 1, fields: ['income'], left: { income: original }, right: { income: original + 2000 } });
    expect(firstDifference(result.branches[0], result.branches[0])).toBeNull();
    expect(firstDifference(result.branches[0], [result.branches[1][0], { ...result.branches[1][1], minute: 2 }])).toBeNull();
  } finally {
    runtime.destroy();
    handle.close();
  }
});
