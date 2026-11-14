import { expect, test } from 'bun:test';
import { lineageMap, MAP_LIMIT } from '../world/future-journey/lineage.js';
import { createCustomHouseholdSave } from '../world/house/creator-model.js';
import { readPopulationCheckpoint } from '../world/population/checkpoint.js';

async function fixture() {
  const { save } = await createCustomHouseholdSave({ name: 'Map fixture', startingMoney: 14250, relationship: 'roommates', members: [{ name: 'Alex', ageYears: 35, voice: 'warm', skinColor: '#d1a77c', shirtColor: '#658da6', hairColor: '#534d36', traits: ['social', 'creative', 'romantic'], interests: ['hobbies'] }] });
  const record = { id: 'parent001', schemaVersion: 'world-experiment-record.v1', save };
  return { record, state: readPopulationCheckpoint(save.checkpoint) };
}
test('discovers children without changing parent, preserves exact saved checkpoint', async () => {
  const parent = await fixture();
  const before = JSON.stringify(parent.record);
  const child = { ...parent.record, id: 'child0001', parentId: parent.record.id };
  const result = await lineageMap([parent], async url => Response.json(url === '/api/world-experiments' ? { experiments: [{ id: child.id, parentId: parent.record.id, mode: 'living' }] } : child));
  expect(result.nodes.map(n => n.id)).toEqual(['parent001', 'child0001']);
  expect(result.nodes[1].source.record.save.checkpoint).toEqual(parent.record.save.checkpoint);
  expect(JSON.stringify(parent.record)).toBe(before);
});
test('labels missing child and unavailable catalog', async () => {
  const parent = await fixture();
  const result = await lineageMap([parent], async url => url === '/api/world-experiments' ? Response.json({ experiments: [{ id: 'missing001', parentId: parent.record.id, mode: 'living' }] }) : new Response('', { status: 404 }));
  expect(result.nodes[1].error).toContain('missing');
  expect((await lineageMap([parent], async () => new Response('', { status: 503 }))).notice).toContain('catalog unavailable');
  expect((await lineageMap([], async () => Response.json({ experiments: [] }))).nodes).toEqual([]);
});
test('bounds checkpoint reads and reports truncated branches', async () => {
  const parent = await fixture();
  let reads = 0;
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: 'child' + String(i).padStart(4, '0'), parentId: parent.record.id, mode: 'living' }));
  const start = performance.now();
  const result = await lineageMap([parent], async url => {
    if (url === '/api/world-experiments') return Response.json({ experiments: rows });
    reads++;
    return Response.json({ ...parent.record, id: url.split('/').at(-1), parentId: parent.record.id });
  });
  expect(result.nodes).toHaveLength(MAP_LIMIT);
  expect(reads).toBe(MAP_LIMIT - 1);
  expect(result.notice).toContain('limited');
  console.log(`Synthetic 30-child catalog, ${reads} checkpoint decodes: ${(performance.now() - start).toFixed(2)} ms`);
});

test('component exposes exact links, selected stop, provenance and unavailable labels', async () => {
  const { renderLineage } = await import('../world/future-journey/lineage.js');
  const document = { createElement(tag) { return { tag, children: [], style: {}, attributes: {}, append(...children) { this.children.push(...children); }, setAttribute(key, value) { this.attributes[key] = value; }, replaceChildren(...children) { this.children = children; } }; } };
  const container = document.createElement('div');
  const source = await fixture();
  renderLineage(container, [{ id: source.record.id, source }, { id: 'missing001', error: 'Saved checkpoint is missing.' }], source.record.id, 'resident001', document);
  const [available, unavailable] = container.children[0].children;
  const [link, description] = available.children;
  expect(link.attributes['aria-current']).toBe('step');
  expect(new URL(link.href, 'http://localhost').searchParams.get('experiment')).toBe(source.record.id);
  expect(description.textContent).toContain('Seed ' + source.state.model.config.seed);
  expect(description.textContent).toContain('Synthetic modeled state');
  expect(unavailable.children).toHaveLength(1);
  expect(unavailable.children[0].textContent).toContain('Unavailable');
});

test('rejects a catalog child whose recorded parent differs', async () => {
  const parent = await fixture();
  const result = await lineageMap([parent], async url => Response.json(url === '/api/world-experiments' ? { experiments: [{ id: 'child0001', parentId: parent.record.id, mode: 'living' }] } : { ...parent.record, id: 'child0001', parentId: 'other0001' }));
  expect(result.nodes[1].source).toBeUndefined();
  expect(result.nodes[1].error).toContain('Incompatible');
});

test('expired checkpoint responses are explicit', async () => {
  const { readFuture } = await import('../world/future-journey/model.js');
  await expect(readFuture('expired001', async () => new Response('', { status: 410 }))).rejects.toThrow('expired');
});
