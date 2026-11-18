import { test, expect } from 'bun:test';
import { drainageEdges } from '../world/storm/drainage.js';
import fixture from './fixtures/storm/drainage.json';
const context = { arm: 'baseline', step: 1 };
test('recorded geometry and exact values replay without mutation', () => {
  const before = JSON.stringify(fixture);
  const rows = drainageEdges(fixture, context);
  expect(rows.map(e => [e.flow, e.overflow])).toEqual([[2,.5],[0,0],[null,null]]);
  expect(drainageEdges(JSON.parse(before), context)).toEqual(rows);
  expect(JSON.stringify(fixture)).toBe(before);
});
test('missing, mismatched, unsupported and invented geometry remain absent', () => {
  for (const record of [null, {}, {...fixture, units:'m/s'}, {...fixture, source:''}, {...fixture, step:2}, {...fixture, arm:'adjusted'}]) expect(drainageEdges(record, context)).toEqual([]);
  expect(drainageEdges({...fixture, edges:[{...fixture.edges[0],points:[[0,0],[2,1]]}]},context)).toEqual([]);
  const rows = drainageEdges({...fixture, edges:[{...fixture.edges[0],flow:-1,overflow:Infinity},fixture.edges[0]]},context);
  expect(rows).toHaveLength(1);
  expect(rows[0].flow).toBeNull(); expect(rows[0].overflow).toBeNull();
});
