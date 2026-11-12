import { test, expect } from 'bun:test';
import { runSpatialEvents } from '../world/spatial-events/model.js';
// Independent sorted-list oracle, explicit scalar state and transitions.
function oracle(count, seed, rounds, tiles, hot) {
  const mix = (h, n) => Math.imul(h ^ n, 16777619) >>> 0;
  const agents = Array.from({ length: count }, (_, id) => ({ tile: hot ? 0 : id % tiles, energy: 10 }));
  const events = agents.map((a, id) => ({ id, tile: a.tile, time: mix(seed, id) % 17, kind: 0, round: 0 }));
  let h = 2166136261, interactions = 0;
  while (events.length) {
    events.sort((a,b) => a.time-b.time || a.id-b.id || a.kind-b.kind);
    const e = events.shift(), a = agents[e.id];
    for (const n of [e.time,e.id,e.kind,e.tile,e.round]) h = mix(h,n);
    if (e.kind === 0) events.push({ ...e, time: e.time+1+mix(seed,e.id+e.round)%7, kind:1 });
    else if (e.kind === 1) { a.tile = (a.tile+1)%tiles; events.push({ ...e,tile:a.tile,time:e.time+1,kind:2 }); }
    else {
      const peer = (e.id+tiles)%count, b = agents[peer];
      if (peer !== e.id && b.tile === a.tile && a.energy > 0 && b.energy < 20) { a.energy--; b.energy++; interactions++; }
      if (e.round+1 < rounds) events.push({ ...e,time:e.time+1,kind:0,round:e.round+1 });
    }
  }
  let state = 2166136261;
  for (const a of agents) state = mix(mix(state,a.tile),a.energy);
  return { eventOrderingHash:h.toString(16),stateHash:state.toString(16),modeledPairwiseInteractions:interactions };
}
test('independent scalar oracle agrees including ties, hot tiles, wraparound and seeds', () => {
  for (const count of [0,1,2,71]) for (const seed of [0,42,0xffffffff]) for (const hot of [false,true]) {
    const options = {count,seed,hot,rounds:3,tiles:2};
    const run = runSpatialEvents(options);
    expect(run).toMatchObject(oracle(count,seed,3,2,hot));
    expect(run.metrics.lateEvents).toBe(0);
    expect(run.metrics.scheduled).toBe(count*9);
  }
});
test('10k deterministic repeat and scheduler equivalence', () => {
  const a = runSpatialEvents(), b = runSpatialEvents(), scalar = runSpatialEvents({scheduler:'scalar'});
  expect(a).toEqual(b);
  expect(a.stateHash).toBe(scalar.stateHash);
  expect(a.eventOrderingHash).toBe(scalar.eventOrderingHash);
});
test('reject invalid inputs', () => {
  for (const options of [{count:-1},{count:1000001},{count:1.5},{seed:-1},{rounds:0},{tiles:1},{scheduler:'gpu'},{hot:1}]) expect(() => runSpatialEvents(options)).toThrow();
});
test('recorded 10k/100k/1M distributed and hot runs replay with ownership invariants', async () => {
  const evidence = await Bun.file(new URL('../docs/evidence/spatial-events-benchmark.json', import.meta.url)).json();
  for (const recorded of evidence.results) {
    const replay = runSpatialEvents(recorded);
    for (const key of ['metrics','stateHash','eventOrderingHash','invariants','modeledPairwiseInteractions']) expect(replay[key]).toEqual(recorded[key]);
  }
}, 30000);
