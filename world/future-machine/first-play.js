import {FIRST_PLAY_CURRENT_SCHEMA_VERSION, createFirstPlaySessionId, validateFirstPlayEvent} from '../first-play-events.js';

// Versioned UI build identity, independent of simulation/model versions.
export const FIRST_PLAY_APP_VERSION = 'future-machine.ui.1';
const renderers = new Set(['webgpu', 'webgl', 'canvas2d', 'inventory-fallback']);

/** Seven local, first-only milestones. No persistence, event bus or transmission. */
export function createFirstPlayFunnel({now = () => performance.now(), renderer} = {}) {
  let sessionId;
  try { sessionId = createFirstPlaySessionId(); } catch { /* fail closed */ }
  const start = now(), rows = [], seen = new Set(), pending = new Map();
  function append(event, backend) {
    rows.push({schemaVersion:'hbl.first-play-ui.v1',appVersion:FIRST_PLAY_APP_VERSION,
      scenarioId:'future-machine',renderer:backend,event:structuredClone(event)});
    seen.add(event.type);
  }
  function flush() {
    if (!sessionId) return;
    if (now()-start > 86_400_000) { pending.clear(); return; }
    const backend=renderer?.();
    if (!renderers.has(backend)) return;
    for (const event of pending.values()) if (!seen.has(event.type)) append(event,backend);
    pending.clear();
  }
  return {
    record(type, payload, {deferUntilReady=false}={}) {
      flush();
      if (!sessionId || seen.has(type) || pending.has(type)) return false;
      const elapsedMs = Math.floor(now() - start), backend = renderer?.();
      const event = {schemaVersion:FIRST_PLAY_CURRENT_SCHEMA_VERSION, type, sessionId, elapsedMs, payload};
      if (!validateFirstPlayEvent(event).ok) return false;
      if (!renderers.has(backend)) {
        // At most seven validated, first-only payloads. Preserve action time and
        // settled share results while the progressive renderer is still loading.
        if (deferUntilReady && backend==='pending') pending.set(type,structuredClone(event));
        return false;
      }
      append(event,backend);return true;
    },
    flush,
    snapshot: () => structuredClone(rows),
    dispose() { rows.length = 0; seen.clear(); pending.clear(); sessionId = null; },
  };
}

/** Only report supported, actually displayed recorded comparison facts. */
export function visibleDivergence(history, diffs, month) {
  if (history?.schemaVersion !== 'future-machine.v1' || history.modelVersion !== 'city-systems.1.1.0') return null;
  const first = diffs.find(diff => diff.month > 0 && diff.available &&
    (diff.physicalCount > 0 || Object.values(diff.metrics).some(metric => metric.status === 'available' && metric.delta !== 0)));
  if (!first || month < first.month || !diffs[month]?.available) return null;
  return {source:'recorded-paired-history', modelVersion:history.modelVersion,
    dataVersion:history.schemaVersion, seed:history.seed, month:first.month, scenario:'plan', synthetic:true};
}
