import { canonicalEvent, exact, MAX_BATCH_EVENTS, MAX_EVENT_BYTES, validateDiagnostic } from './contract.js';
export const FIXTURE_VERSION = 'hbl.gameplay-diagnostic-fixture.v1';
const MAX_FIXTURE_BYTES = MAX_BATCH_EVENTS * MAX_EVENT_BYTES + 128;

/** Explicit local string export only; no download, persistence or network side effect. */
export function exportDiagnosticFixture(collector) {
  if (!collector.consented) return { ok: false, code: 'CONSENT_REQUIRED' };
  return { ok: true, json: JSON.stringify({ schemaVersion: FIXTURE_VERSION, events: collector.snapshot() }) };
}
/** Validate the complete batch before touching the destination; consent is never imported. */
export function importDiagnosticFixture(json, collector) {
  if (!collector.consented) return { ok: false, code: 'CONSENT_REQUIRED' };
  try {
    if (typeof json !== 'string' || json.length > MAX_FIXTURE_BYTES ||
        new TextEncoder().encode(json).length > MAX_FIXTURE_BYTES) throw new Error();
    const batch = JSON.parse(json);
    if (!exact(batch, { schemaVersion: value => value === FIXTURE_VERSION,
      events: value => Array.isArray(value) && value.length <= MAX_BATCH_EVENTS &&
        value.every(event => validateDiagnostic(event).ok) })) throw new Error();
    let accepted = 0;
    let duplicates = 0;
    for (const event of batch.events) {
      const result = collector.capture(canonicalEvent(event));
      if (result.duplicate) duplicates++; else accepted++;
    }
    return { ok: true, accepted, duplicates };
  } catch { return { ok: false, code: 'INVALID_FIXTURE' }; }
}
