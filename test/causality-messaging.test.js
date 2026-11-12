import { test, expect } from 'bun:test';
import { attributionNotes } from '../world/causality/graph-view.js';
const target = { id: 'event:target', context: { modelVersion: 'unknown-v99' } };
const note = (data = {}, edges = [], selected = target) => attributionNotes(data, target.id, selected, edges).join(' ');
test('no returned event does not invent attribution', () => {
  expect(note({}, [], null)).toBe('');
});
test('unrecognized model without dependencies reports uncertainty about support and retention', () => {
  expect(note()).toContain('may not support dependency recording');
  expect(note()).toContain('cannot distinguish those cases');
  expect(note()).toContain('does not establish a cause');
});
test('conflicting inputs are preserved without resolving their claims or ranking causes', () => {
  const edges = ['a', 'b'].map(fromId => ({ fromId, toId: target.id, relation: 'contributes' }));
  const before = JSON.stringify(edges);
  expect(note({}, edges)).toContain('does not resolve conflicts or identify a single cause');
  expect(JSON.stringify(edges)).toBe(before);
  expect(note({}, [edges[0], edges[0]])).not.toContain('Multiple recorded inputs');
  expect(note({}, edges.map(edge => ({ ...edge, relation: 'correlates' })))).toContain('No recorded attribution');
});
test('incomplete history is distinct from evidence of no cause', () => {
  expect(note({ incomplete: true })).toContain('Missing records must not be interpreted as evidence that no cause exists');
  expect(note({ incomplete: false })).not.toContain('history is incomplete');
});
