import { test, expect } from 'bun:test';
import { fixture, buildIndex, bruteForce } from '../world/spatial/neighbor-index.js';
const ordered = a => a.slice().sort((a,b) => a-b);
test('seed-matched replay and both indices match independent small oracle across crowd skew', () => {
  for (const seed of [0,42,0xffffffff]) for (const hubFraction of [0,0.01,0.5,1]) {
    const p = fixture({count: 300, seed, hubFraction});
    expect(p).toEqual(fixture({count:300, seed, hubFraction}));
    for (const method of ['hash','sorted']) {
      const index = buildIndex(p,method);
      for (let id = 0; id < 300; id++) expect(ordered(index.query(id,8).neighbors)).toEqual(bruteForce(p,id,8));
    }
  }
});
test('negative coordinates, tile boundaries, exact radius, duplicates and no self contacts', () => {
  const p = {x:Int32Array.from([-16,-1,0,0,3,16,32768,-32768]), y:Int32Array.from([0,0,0,0,4,0,32768,-32768])};
  for (const method of ['hash','sorted']) for (const tileSize of [1,16,31]) {
    const index = buildIndex(p,method);
    for (let id=0;id<p.x.length;id++) for (const radius of [0,5,17]) expect(ordered(index.query(id,radius).neighbors)).toEqual(bruteForce(p,id,radius));
  }
});
test('overflow is measured without truncation; empty and invalid inputs', () => {
  for (const method of ['hash','sorted']) {
    const p = {x:new Int32Array(600),y:new Int32Array(600)};
    const index = buildIndex(p,method);
    expect(index.stats).toMatchObject({maxOccupancy:600,overflowTiles:1,overflowAgents:344,droppedAgents:0});
    expect(index.query(0,0).neighbors.length).toBe(599);
    expect(buildIndex(fixture({count:0}),method).stats.occupiedTiles).toBe(0);
    expect(() => index.query(600)).toThrow();
    expect(() => index.query(0,-1)).toThrow();
  }
  expect(() => fixture({seed:-1})).toThrow();
  expect(() => fixture({hubFraction:NaN})).toThrow();
  expect(() => buildIndex({x:Int32Array.of(32769),y:Int32Array.of(0)},'hash')).toThrow();
  expect(() => buildIndex(fixture({count:0}),'unknown')).toThrow();
});
