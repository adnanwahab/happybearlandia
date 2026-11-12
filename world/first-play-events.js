/** Pure first-play contract. See docs/first-play-event-contract.md. */
export const FIRST_PLAY_SCHEMA_VERSION = 'hbl.first-play.v1';
export const MAX_FIRST_PLAY_EVENT_BYTES = 1024;
const choice = (...values) => value => values.includes(value);
const integer = max => value => Number.isSafeInteger(value) && value >= 0 && value <= max;
const session = value => typeof value === 'string' && /^fps_[0-9a-f]{32}$/.test(value);
const fields = Object.freeze({
  landing: { entry: choice('direct', 'shared', 'internal') },
  demo_start: { mode: choice('fresh', 'saved') },
  first_input: { control: choice('policy', 'timeline', 'scenario', 'playback') },
  first_divergence: { facts: value => exact(value, {
    source: choice('recorded-paired-history'), modelVersion: choice('city-systems.1.0.0'),
    dataVersion: choice('future-machine.v1'), seed: integer(0xffffffff),
    month: value => integer(120)(value) && value > 0,
    scenario: choice('plan'), synthetic: choice(true),
  }) },
  why_opened: { target: choice('recorded-event', 'recorded-divergence') },
  share: { method: choice('copy', 'native', 'download'), result: choice('succeeded', 'canceled', 'failed') },
  return: { entry: choice('shared', 'internal', 'resume') },
});
export const FIRST_PLAY_EVENT_TYPES = Object.freeze(Object.keys(fields));

// Inspect descriptors so validation never invokes user-provided getters/toJSON.
function exact(value, rules) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== Object.keys(rules).length) return false;
  return keys.every(key => {
    if (typeof key !== 'string' || !Object.hasOwn(rules, key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor.enumerable && Object.hasOwn(descriptor, 'value') && rules[key](descriptor.value);
  });
}

/** Returns {ok:true} or a fixed, non-sensitive error code; never echoes input. */
export function validateFirstPlayEvent(event) {
  try {
    if (!exact(event, {
      schemaVersion: choice(FIRST_PLAY_SCHEMA_VERSION),
      type: value => typeof value === 'string' && Object.hasOwn(fields, value),
      sessionId: session,
      elapsedMs: integer(86_400_000),
      payload: value => Boolean(value && typeof value === 'object'),
    })) return { ok: false, code: 'INVALID_ENVELOPE' };
    if (!exact(event.payload, fields[event.type])) return { ok: false, code: 'INVALID_PAYLOAD' };
    if (new TextEncoder().encode(JSON.stringify(event)).byteLength > MAX_FIRST_PLAY_EVENT_BYTES)
      return { ok: false, code: 'EVENT_TOO_LARGE' };
    return { ok: true };
  } catch {
    return { ok: false, code: 'INVALID_EVENT' };
  }
}

/** Generate once per page session, retain in memory only. No weak RNG fallback. */
export function createFirstPlaySessionId() {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness unavailable');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `fps_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
