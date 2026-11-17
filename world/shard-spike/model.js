// Synthetic conservative ring flow, integer units; no production city adapter.
export const VERSION = 'synthetic-ring-flow.v1';
export function initialState(count, seed) {
  if (!Number.isInteger(count) || count < 8 || count > 65536 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid count/uint32 seed');
  let x = seed;
  return Array.from({length: count}, () => { x = (Math.imul(x,1664525)+1013904223)>>>0; return x%101; });
}
export function scalarStep(state) {
  return state.map((value,i) => value - (value > 0 ? 1 : 0) + (state[(i+state.length-1)%state.length] > 0 ? 1 : 0));
}
export function tileStep({version,tick,start,values,left}) {
  if (version !== VERSION || !Number.isInteger(tick) || tick < 0 || !Number.isInteger(start) || start < 0 || !Array.isArray(values) || !values.length || ![left,...values].every(v => Number.isInteger(v) && v >= 0 && v <= 100)) throw Error('Invalid tile/version');
  return {version,tick,start, values:values.map((v,i)=>v-(v>0?1:0)+((i?values[i-1]:left)>0?1:0))};
}
export function hash(state) {
  let h=2166136261;
  for (const value of state) h=Math.imul(h^value,16777619)>>>0;
  return h.toString(16).padStart(8,'0'); // diagnostic, not cryptographic trust
}
