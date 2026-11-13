import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { inspectRipple } from '../world/causality/ripple.js';

function fixture(count = 8) {
  const nodes = Array.from({length: count}, (_, i) => ({id: String(i), type: 'transition'}));
  const edges = nodes.slice(1).map((node, i) => ({id: 'e' + i, fromId: String(i), toId: node.id, relation: 'causes', evidenceIds: [String(i)]}));
  const store = {getNode: (_, id) => nodes.find(n => n.id === id), getRun: () => ({status: 'completed', context: {seed: 0, modelVersion: 'fixture'}}), listEdges: (_, {sourceId, limit}) => ({items: edges.filter(e => e.fromId === sourceId).slice(0, limit), nextCursor: null})};
  return {store, edges};
}
test('five downstream steps retain citations and provenance and report truncation', () => {
  const {store} = fixture();
  const result = inspectRipple(store, 'r', '0');
  expect(result.edges).toHaveLength(5);
  expect(result.nodes).toHaveLength(6);
  expect(result.reasons).toContain('edge-limit');
  expect(result.context.seed).toBe(0);
  expect(result.edges.every(e => result.evidence.some(n => e.evidenceIds.includes(n.id)))).toBe(true);
  expect(inspectRipple(store, 'r', 'absent')).toBeNull();
});
test('correlation cycles terminate with original relation labels', () => {
  const {store, edges} = fixture(3);
  edges.push({id:'cycle',fromId:'2',toId:'0',relation:'correlates',evidenceIds:['2']});
  const result = inspectRipple(store, 'r', '0');
  expect(result.edges).toHaveLength(3);
  expect(result.edges.at(-1).relation).toBe('correlates');
  expect(result.reasons).toContain('cycle-bounded');
});
test('missing destination and absent source event are explicit gaps', () => {
  const {store, edges} = fixture(3);
  edges[0].evidenceIds = ['missing'];
  edges.push({id:'gap',fromId:'0',toId:'missing',evidenceIds:['0']});
  const result = inspectRipple(store, 'r', '0');
  expect(result.edges).toEqual([]);
  expect(result.reasons).toContain('missing-source-event');
  expect(result.reasons).toContain('missing-dependency');
  expect(result.missingIds).toContain('missing');
});
test('normal dispatcher serves actual persisted City source events and validates requests', async () => {
  const db = new Database(':memory:');
  try {
    const store = createCausalStore(db), handle = createCausalityHandler({store});
    const setup = await (await handle(new Request('http://localhost/api/causality/world-scenario', {method:'POST'}))).json();
    const source = store.listEvents(setup.context.runId, {limit:1000}).items.find(n => store.listEdges(setup.context.runId,{sourceId:n.id,limit:1}).items.length);
    expect(source).toBeDefined();
    const url = 'http://localhost/api/causality/ripple?' + new URLSearchParams({runId:setup.context.runId,targetId:source.id});
    const result = await (await handle(new Request(url))).json();
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeLessThanOrEqual(5);
    expect(result.evidence.every(n => n.context.runId === setup.context.runId)).toBe(true);
    expect((await handle(new Request(url+'&targetId=duplicate'))).status).toBe(400);
    expect((await handle(new Request(url,{method:'POST'}))).status).toBe(405);
  } finally { db.close(); }
});
