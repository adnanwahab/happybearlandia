// Synthetic benchmark only. Stable IDs are typed-array indices; ticks are abstract.
export const VERSION = 'hbl.synthetic-paired-transfer.v1';
export function validate({ size, steps, seed }) {
  if (![10000, 100000, 1000000].includes(size)) throw new Error('size must be 10000, 100000 or 1000000');
  if (!Number.isInteger(steps) || steps < 1 || steps > 600) throw new Error('steps must be 1..600');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be uint32');
}
export function createState(options) {
  validate(options);
  return { energy: new Uint32Array(options.size).fill(10), random: options.seed, tick: 0 };
}
export function step(state) {
  state.random = (Math.imul(state.random, 1664525) + 1013904223) >>> 0;
  const offset = state.random % state.energy.length;
  let interactions = 0;
  for (let j = 0; j < state.energy.length; j += 2) {
    const a = (j + offset) % state.energy.length, b = (a + 1) % state.energy.length;
    if (state.energy[a]) { state.energy[a]--; state.energy[b]++; interactions++; }
  }
  state.tick++;
  return { agentUpdates: interactions * 2, interactions };
}
export function digest(state) {
  let hash = 2166136261, total = 0;
  for (const value of state.energy) { hash = Math.imul(hash ^ value, 16777619) >>> 0; total += value; }
  return { hash: hash.toString(16).padStart(8, '0'), totalEnergy: total, tick: state.tick, random: state.random };
}
