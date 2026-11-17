// Synthetic integer-coordinate broad phase; IDs are position-array indices.
export const VERSION = 'spatial-neighbors.v1';
function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(name);
}
export function fixture({ count = 1000000, seed = 42, hubFraction = 0.01, extent = 4096 } = {}) {
  integer(count, 'count', 0, 1000000); integer(seed, 'seed', 0, 0xffffffff);
  integer(extent, 'extent', 64, 32768);
  if (!Number.isFinite(hubFraction) || hubFraction < 0 || hubFraction > 1) throw new RangeError('hubFraction');
  let state = seed;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const x = new Int32Array(count), y = new Int32Array(count);
  const hubCount = Math.floor(count * hubFraction);
  for (let i = 0; i < count; i++) {
    // Four fixed transit hubs; concentrated positions occupy one 16-unit tile each.
    const hub = i % 4, baseX = extent / 4 * (1 + hub % 2), baseY = extent / 4 * (1 + (hub >> 1));
    x[i] = Math.floor(i < hubCount ? baseX + random() * 16 : random() * extent);
    y[i] = Math.floor(i < hubCount ? baseY + random() * 16 : random() * extent);
  }
  return { x, y, seed, extent, hubFraction, hubCount };
}
export function buildIndex(points, method, { tileSize = 16, hotTileCapacity = 256 } = {}) {
  integer(tileSize, 'tileSize', 1, 32768); integer(hotTileCapacity, 'hotTileCapacity', 1, 1000000);
  if (!['hash', 'sorted'].includes(method)) throw new RangeError('method');
  const { x, y } = points;
  if (!(x instanceof Int32Array) || !(y instanceof Int32Array) || x.length !== y.length || x.length > 1000000) throw new TypeError('positions');
  // Domain bounds make numeric tile keys injective, including negative coordinates.
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 32768 || Math.abs(y[i]) > 32768) throw new RangeError('coordinate');
  const stride = 65537;
  const key = (tx, ty) => (tx + 32768) * stride + ty + 32768;
  const tileKey = i => key(Math.floor(x[i] / tileSize), Math.floor(y[i] / tileSize));
  let bins, ids, keys, starts, counts;
  if (method === 'hash') {
    bins = new Map();
    for (let i = 0; i < x.length; i++) {
      const k = tileKey(i);
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(i);
    }
    counts = [...bins.values()].map(bin => bin.length);
  } else {
    ids = Uint32Array.from({ length: x.length }, (_, i) => i);
    ids.sort((a, b) => tileKey(a) - tileKey(b) || a - b);
    const k = [], s = [];
    for (let i = 0; i < ids.length; i++) {
      const value = tileKey(ids[i]);
      if (!i || value !== k[k.length - 1]) { k.push(value); s.push(i); }
    }
    s.push(ids.length); keys = Float64Array.from(k); starts = Uint32Array.from(s);
    counts = k.map((_, i) => starts[i + 1] - starts[i]);
  }
  const stats = { occupiedTiles: counts.length, maxOccupancy: counts.reduce((a,b) => Math.max(a,b), 0),
    hotTileCapacity, overflowTiles: counts.filter(n => n > hotTileCapacity).length,
    overflowAgents: counts.reduce((sum,n) => sum + Math.max(0,n-hotTileCapacity),0),
    droppedAgents: 0, typedIndexBytes: method === 'sorted' ? ids.byteLength + keys.byteLength + starts.byteLength : 0,
    storedIdCount: x.length };
  function visit(k, callback) {
    if (bins) { for (const id of bins.get(k) || []) callback(id); return; }
    let lo = 0, hi = keys.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (keys[mid] < k) lo = mid + 1; else hi = mid; }
    if (keys[lo] === k) for (let j = starts[lo]; j < starts[lo+1]; j++) callback(ids[j]);
  }
  return { stats, query(id, radius = 4) {
    integer(id, 'id', 0, x.length - 1); integer(radius, 'radius', 0, 32768);
    const neighbors = []; let candidates = 0;
    const minX = Math.max(-32768, Math.floor((x[id]-radius)/tileSize));
    const maxX = Math.min(32768, Math.floor((x[id]+radius)/tileSize));
    const minY = Math.max(-32768, Math.floor((y[id]-radius)/tileSize));
    const maxY = Math.min(32768, Math.floor((y[id]+radius)/tileSize));
    for (let tx = minX; tx <= maxX; tx++) for (let ty = minY; ty <= maxY; ty++) visit(key(tx,ty), other => {
      if (other === id) return;
      candidates++;
      const dx = x[id]-x[other], dy = y[id]-y[other];
      if (dx*dx + dy*dy <= radius*radius) neighbors.push(other);
    });
    return { neighbors, candidates };
  } };
}
export function bruteForce(points, id, radius) {
  const result = [];
  for (let j = 0; j < points.x.length; j++) {
    const dx = points.x[id]-points.x[j], dy = points.y[id]-points.y[j];
    if (j !== id && dx*dx+dy*dy <= radius*radius) result.push(j);
  }
  return result;
}
