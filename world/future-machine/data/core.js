import { VERSION, validateState } from '../../city/contracts.js';
import { cityMetrics } from '../../city/engine.js';

export const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function stateHash(state) {
  const bytes = new TextEncoder().encode(canonical(state));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function checkInitial(initial, {replay = false} = {}) {
  if (!initial || initial.version !== VERSION) throw new Error('Recorded model version unavailable');
  validateState(initial);
  if (!replay && initial.month !== 0) throw new Error('Future Machine requires original Month 0');
  if (initial.households.length > 120 || initial.units.length > 1000 || initial.jobs.length > 1000 || initial.links.length > 128 || initial.projects.length > 100 || initial.policies.length > 100 || initial.buildings.length > 1000) throw new Error('Future Machine city exceeds interactive bounds');
  if (JSON.stringify(initial).length > (replay ? 10000000 : 1000000)) throw new Error('Initial state exceeds byte limit');
}
export function checkCancelled(signal) {
  if (signal?.aborted) throw new DOMException('Future Machine run cancelled', 'AbortError');
}
export function frame(state, step = {}) {
  return { state, events: step.events || [], observations: step.observations || [], decisions: step.decisions || [], moves: step.moves || [], trips: step.trips || [], flows: step.flows || [], diagnostics: step.diagnostics || [], metrics: cityMetrics(state) };
}
