import { canonicalEvent, MAX_BATCH_EVENTS, validateDiagnostic } from './contract.js';

/** Page-memory only. No timers, event listeners, storage or transport. */
export function createDiagnosticCollector({ capacity = 32 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_BATCH_EVENTS)
    throw new RangeError('Invalid diagnostic capacity');
  let consent = false;
  const slots = new Array(capacity);
  let start = 0;
  let size = 0;
  const keys = new Set();
  function clear() {
    consent = false;
    slots.fill(undefined);
    keys.clear();
    start = size = 0;
  }
  return Object.freeze({
    optIn() { consent = true; },
    clear,
    withdraw: clear,
    get consented() { return consent; },
    get size() { return size; },
    capture(event) {
      // Do not even inspect payloads while disabled.
      if (!consent) return { ok: false, code: 'CONSENT_REQUIRED' };
      const validation = validateDiagnostic(event);
      if (!validation.ok) return validation;
      const copy = canonicalEvent(event);
      const key = JSON.stringify(copy);
      if (keys.has(key)) return { ok: true, duplicate: true };
      if (size === capacity) {
        keys.delete(JSON.stringify(slots[start]));
        slots[start] = copy;
        start = (start + 1) % capacity;
      } else { slots[(start + size++) % capacity] = copy; }
      keys.add(key);
      return { ok: true, duplicate: false };
    },
    snapshot() {
      return Array.from({ length: size }, (_, i) => canonicalEvent(slots[(start + i) % capacity]));
    },
  });
}
