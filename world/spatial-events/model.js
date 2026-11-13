// Synthetic Architecture C research adapter; integer time and lattice positions.
export const VERSION = 'spatial-events.v1';
const compare = (a, b) => a.time - b.time || a.id - b.id || a.kind - b.kind;
class Heap {
  data = [];
  push(e) {
    const a = this.data; let i = a.length; a.push(e);
    while (i) { const p = (i - 1) >> 1; if (compare(a[p], e) <= 0) break; a[i] = a[p]; i = p; }
    a[i] = e;
  }
  pop() {
    const a = this.data, first = a[0], last = a.pop();
    if (a.length) { let i = 0;
      while (2 * i + 1 < a.length) { let j = 2 * i + 1;
        if (j + 1 < a.length && compare(a[j + 1], a[j]) < 0) j++;
        if (compare(last, a[j]) <= 0) break; a[i] = a[j]; i = j;
      } a[i] = last;
    } return first;
  }
}
const mix = (h, n) => Math.imul(h ^ n, 16777619) >>> 0;
export function runSpatialEvents({ count = 10000, seed = 42, rounds = 1, tiles = 64, hot = false, scheduler = 'tiled' } = {}) {
  for (const [name, n, min, max] of [['count', count, 0, 1000000], ['seed', seed, 0, 0xffffffff], ['rounds', rounds, 1, 10], ['tiles', tiles, 2, 256]])
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}`);
  if (!['tiled', 'scalar'].includes(scheduler) || typeof hot !== 'boolean') throw new Error('Invalid scheduler/hot');
  const position = new Uint16Array(count), energy = new Uint8Array(count).fill(10);
  const members = Array.from({ length: tiles }, () => new Set());
  const queues = Array.from({ length: scheduler === 'tiled' ? tiles : 1 }, () => new Heap());
  const heads = new Heap();
  const metrics = { scheduled: 0, processed: 0, scheduledInteractions: 0, processedInteractions: 0, stateUpdates: 0, handoffs: 0, maxQueueDepth: 0, maxTileQueueDepth: 0, lateEvents: 0 };
  let interactions = 0;
  let pending = 0, hash = 2166136261, last = null;
  const enqueue = e => {
    const q = queues[scheduler === 'tiled' ? e.tile : 0];
    // Only current queue heads enter the coordinator. Identity invalidates old heads.
    const old = q.data[0]; q.push(e);
    if (q.data[0] !== old) heads.push(e);
    metrics.scheduled++; if (e.kind === 2) metrics.scheduledInteractions++;
    metrics.maxQueueDepth = Math.max(metrics.maxQueueDepth, ++pending);
    metrics.maxTileQueueDepth = Math.max(metrics.maxTileQueueDepth, q.data.length);
  };
  for (let id = 0; id < count; id++) {
    const tile = hot ? 0 : id % tiles; position[id] = tile; members[tile].add(id);
    enqueue({ time: (mix(seed, id) % 17), id, kind: 0, tile, round: 0 });
  }
  while (heads.data.length) {
    const e = heads.pop(), q = queues[scheduler === 'tiled' ? e.tile : 0];
    if (q.data[0] !== e) continue;
    q.pop(); if (q.data.length) heads.push(q.data[0]); pending--;
    if (last && compare(e, last) < 0) metrics.lateEvents++;
    last = e; metrics.processed++;
    for (const n of [e.time, e.id, e.kind, e.tile, e.round]) hash = mix(hash, n);
    if (position[e.id] !== e.tile || !members[e.tile].has(e.id)) throw new Error('Lost/duplicate ownership');
    if (e.kind === 0) {
      enqueue({ ...e, time: e.time + 1 + (mix(seed, e.id + e.round) % 7), kind: 1 });
    } else if (e.kind === 1) {
      const target = (e.tile + 1) % tiles; // Adjacent ring tile, never teleport.
      if (!members[e.tile].delete(e.id) || members[target].has(e.id)) throw new Error('Duplicate handoff');
      members[target].add(e.id); position[e.id] = target; metrics.handoffs++; metrics.stateUpdates++;
      enqueue({ ...e, tile: target, time: e.time + 1, kind: 2 });
    } else {
      // Stable local partner: next identity on this ring, only if currently co-located.
      const peer = (e.id + tiles) % count; metrics.processedInteractions++;
      if (peer !== e.id && position[peer] === e.tile && energy[e.id] > 0 && energy[peer] < 20) {
        energy[e.id]--; energy[peer]++; metrics.stateUpdates += 2;
        interactions++;
      }
      if (e.round + 1 < rounds) enqueue({ ...e, time: e.time + 1, kind: 0, round: e.round + 1 });
    }
  }
  let stateHash = 2166136261, total = 0, seen = new Uint8Array(count);
  for (let tile = 0; tile < tiles; tile++) for (const id of members[tile]) {
    if (id >= count || seen[id]++ || position[id] !== tile) throw new Error('Duplicate/lost agent');
  }
  for (let id = 0; id < count; id++) {
    if (seen[id] !== 1 || energy[id] > 20 || position[id] !== ((hot ? 0 : id % tiles) + rounds) % tiles) throw new Error('Teleport/resource invariant');
    total += energy[id]; stateHash = mix(mix(stateHash, position[id]), energy[id]);
  }
  if (total !== count * 10 || pending || metrics.lateEvents || metrics.scheduled !== metrics.processed) throw new Error('Conservation/order invariant');
  return { model: VERSION, rules: 'ring-arrival-unit-contact.v1', source: 'synthetic-lattice.v1', seed, count, rounds, tiles, hot, scheduler, metrics, modeledPairwiseInteractions: interactions, eventOrderingHash: hash.toString(16), stateHash: stateHash.toString(16), invariants: { population: count, energy: total, duplicates: 0, lost: 0, teleports: 0 } };
}
