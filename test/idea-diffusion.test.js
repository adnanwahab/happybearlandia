import { expect, test } from 'bun:test';
import { createPopulationRuntime } from '../world/population/runtime.js';
import { createWorldPersistenceHandler } from '../world/experiments/persistence-api.js';
import { simulateIdeaSpread, IDEA_RULES } from '../world/civilization/ideas/model.js';
import { projectContacts } from '../world/civilization/ideas/source.js';

const contact = (id, minute, from, to) => ({
  id, minute, pair: [from, to], evidence: { experimentId: 'ideaTest01', collection: 'socialTimeline', index: 0 },
});

test('seeded adoption can remix, stays synchronous, and fades at the declared minute', () => {
  const source = {
    experimentId: 'ideaTest01', throughMinute: 1450,
    contacts: [
      contact('ab', 10, 'a', 'b'),
      contact('bc-same', 10, 'b', 'c'),
      contact('bc-later', 11, 'b', 'c'),
      contact('ad-after-fade', 1450, 'a', 'd'),
    ],
  };
  const results = Array.from({ length: 40 }, (_, seed) =>
    simulateIdeaSpread(source, { title: 'Tool library', starterId: 'a', seed }));
  const report = results.find(result => result.events.some(event => event.remixed && event.personId === 'b') &&
    result.events.some(event => event.kind === 'adopted' && event.personId === 'c'));
  expect(report).toBeDefined();
  expect(simulateIdeaSpread(source, report.recipe)).toEqual(report);
  expect(report.events.map(({ kind, minute, personId, variant }) => ({ kind, minute, personId, variant }))).toEqual([
    { kind: 'introduced', minute: 10, personId: 'a', variant: 'original' },
    { kind: 'adopted', minute: 10, personId: 'b', variant: 'remix' },
    { kind: 'adopted', minute: 11, personId: 'c', variant: 'remix' },
    { kind: 'faded', minute: 1450, personId: 'a', variant: 'original' },
    { kind: 'faded', minute: 1450, personId: 'b', variant: 'remix' },
  ]);
  expect(report).toMatchObject({ reached: 3, active: 1, recipe: { version: IDEA_RULES.version } });
  expect(report.events[2].evidence).toEqual(source.contacts[2].evidence);
  expect(results.some(result => result.events.some(event => event.kind === 'declined'))).toBe(true);
  expect(() => simulateIdeaSpread(source, { ...report.recipe, starterId: 'other' })).toThrow('retained contact');
  expect(() => simulateIdeaSpread(source, { ...report.recipe, seed: -1 })).toThrow('whole number');
});

test('a saved World checkpoint projects actual accepted Population talk commands', async () => {
  const runtime = createPopulationRuntime({ config: { population: 80, seed: 27 }, stepMinutes: 1 });
  const api = createWorldPersistenceHandler({ dbPath: ':memory:', idFactory: () => 'ideaTest01' });
  try {
    await runtime.ready;
    const resident = await runtime.inspectPerson(runtime.getSnapshot().visibleAgents[0].id);
    const neighbor = resident.social.nearby[0];
    const area = { origin: { lat: 29, lng: -95 }, buildings: [] };
    const before = await runtime.exportCheckpoint();
    const toSave = checkpoint => ({
      schemaVersion: 'world-experiment-save.v1', mode: 'living', label: 'Test city',
      checkpoint, view: { origin: area.origin }, geometry: { area },
    });
    const noContacts = projectContacts({
      schemaVersion: 'world-experiment-record.v1', id: 'ideaTest01', save: toSave(before),
    });
    expect(noContacts.contacts).toEqual([]);

    const { command } = await runtime.socialAction(resident.id, neighbor.id, 'talk');
    await runtime.step();
    const endpoint = 'http://localhost/api/world-experiments';
    const saved = await api(new Request(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toSave(await runtime.exportCheckpoint())),
    }));
    expect(saved.status).toBe(201);
    const response = await api(new Request(endpoint + '/ideaTest01'));
    expect(response.status).toBe(200);
    const source = projectContacts(await response.json());
    expect(source).toMatchObject({ experimentId: 'ideaTest01', populationSeed: 27, throughMinute: 1 });
    expect(source.contacts).toContainEqual({
      id: 'socialTimeline-0', minute: command.tick, pair: [resident.id, neighbor.id],
      evidence: { experimentId: 'ideaTest01', collection: 'socialTimeline', index: 0, placeId: null, text: null },
    });
    const report = simulateIdeaSpread(source, { title: 'Library', starterId: resident.id, seed: 42 });
    expect(report.events[1].evidence).toEqual(source.contacts[0].evidence);
    expect(source.people.map(person => person.id)).toEqual([resident.id, neighbor.id]);
  } finally {
    runtime.destroy();
    api.close();
  }
}, 20000);
