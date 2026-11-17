export const MODEL = 'flat-microagents.v1';
export const RULES = 'cell-contact-integer.v1';
export function scenario({ count = 10000, seed = 143, cap = 8 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 1000000 ||
      !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      !Number.isInteger(cap) || cap < 0 || cap > 32) throw new Error('Invalid scenario');
  const side = Math.ceil(Math.sqrt(count / 16));
  const x = new Uint32Array(count), y = new Uint32Array(count), energy = new Uint32Array(count);
  const offsets = new Uint32Array(side * side + 1);
  let random = seed;
  const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < count; i++) {
    x[i] = next() % side; y[i] = next() % side; energy[i] = next() % 1024;
    offsets[y[i] * side + x[i] + 1]++;
  }
  for (let c = 1; c < offsets.length; c++) offsets[c] += offsets[c - 1];
  const ids = new Uint32Array(count), cursor = offsets.slice();
  for (let i = 0; i < count; i++) ids[cursor[y[i] * side + x[i]]++] = i;
  return { count, seed, cap, side, x, y, energy, offsets, ids };
}
export function stepCPU(s, previous = s.energy) {
  const energy = new Uint32Array(s.count), contacts = new Uint32Array(s.count);
  for (let i = 0; i < s.count; i++) {
    const cell = s.y[i] * s.side + s.x[i];
    let sum = 0, used = 0;
    for (let p = s.offsets[cell]; p < s.offsets[cell + 1] && used < s.cap; p++) {
      const j = s.ids[p];
      if (j === i) continue;
      sum += previous[j]; used++;
    }
    energy[i] = (previous[i] + 1 + sum % 7) % 1024;
    contacts[i] = used;
  }
  return { energy, contacts };
}
