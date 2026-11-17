/** Closed privacy contract; null evidence means unavailable. See README.md. */
export const SCHEMA_VERSION = 'hbl.gameplay-diagnostic.v1';
export const MAX_EVENT_BYTES = 1024;
export const MAX_BATCH_EVENTS = 128;
const choice = (...values) => value => values.includes(value);
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const model = choice(null, 'bakery-v1', 'city-systems.1.0.0', 'city-systems.1.1.0');
const data = choice(null, 'future-machine.v1');

// Never invoke getters or toJSON, accept symbols, or silently strip extra fields.
export function exact(value, rules) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === Object.keys(rules).length && keys.every(key => {
    if (typeof key !== 'string' || !Object.hasOwn(rules, key)) return false;
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d.enumerable && Object.hasOwn(d, 'value') && rules[key](d.value);
  });
}
const recipe = value => value === null || exact(value, {
  version: choice('bakery-v1'), seed: choice(2911),
  reopenMonth: value => value === null || Number.isInteger(value) && value >= 72 && value <= 240,
});
const replay = value => value === null || exact(value, {
  modelVersion: model, rulesVersion: choice(null), dataVersion: data,
  seed: uint32, recipe,
});
const fields = {
  schemaVersion: choice(SCHEMA_VERSION),
  route: choice('/world', '/world/future-machine.html', '/world/journeys/bakery.html', '/game/1'),
  surface: choice('world', 'future-machine', 'bakery', 'game'),
  symptom: choice('control-unresponsive', 'replay-mismatch', 'render-unavailable', 'scripted-step-failed'),
  source: choice('observed-error', 'synthetic-scripted'),
  renderer: choice(null, 'webgpu', 'webgl2', 'canvas2d', 'dom'),
  build: value => value === null || typeof value === 'string' && /^[0-9a-f]{40}$/.test(value),
  modelVersion: model, rulesVersion: choice(null), dataVersion: data,
  elapsedBucket: choice('under-10s', '10s-60s', '1m-5m', 'over-5m', 'unavailable'),
  status: choice('failed', 'recovered', 'unavailable'),
  replay,
};
const surfaces = {
  '/world': 'world', '/world/future-machine.html': 'future-machine',
  '/world/journeys/bakery.html': 'bakery', '/game/1': 'game',
};
/** Fixed error codes only; never echo rejected input. */
export function validateDiagnostic(event) {
  try {
    if (!exact(event, fields)) return { ok: false, code: 'INVALID_EVENT' };
    if (surfaces[event.route] !== event.surface ||
        event.symptom === 'scripted-step-failed' && event.source !== 'synthetic-scripted')
      return { ok: false, code: 'INVALID_CONTEXT' };
    const r = event.replay;
    if (r && (r.modelVersion === null || r.modelVersion !== event.modelVersion ||
        r.rulesVersion !== event.rulesVersion || r.dataVersion !== event.dataVersion ||
        r.recipe && (event.surface !== 'bakery' || r.recipe.version !== r.modelVersion || r.recipe.seed !== r.seed) ||
        r.modelVersion === 'bakery-v1' && r.seed !== 2911))
      return { ok: false, code: 'REPLAY_MISMATCH' };
    const normalized = canonicalEvent(event);
    if (new TextEncoder().encode(JSON.stringify(normalized)).length > MAX_EVENT_BYTES)
      return { ok: false, code: 'EVENT_TOO_LARGE' };
    return { ok: true };
  } catch { return { ok: false, code: 'INVALID_EVENT' }; }
}
/** Only call after validation. Fixed key order makes duplicate handling deterministic. */
export function canonicalEvent(event) {
  const copy = Object.fromEntries(Object.keys(fields).map(key => [key, event[key]]));
  if (copy.replay) {
    const r = copy.replay;
    copy.replay = { modelVersion: r.modelVersion, rulesVersion: r.rulesVersion,
      dataVersion: r.dataVersion, seed: r.seed, recipe: r.recipe === null ? null : {
        version: r.recipe.version, seed: r.recipe.seed, reopenMonth: r.recipe.reopenMonth,
      } };
  }
  return copy;
}
