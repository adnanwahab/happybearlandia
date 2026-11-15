import { CULTURE_EVENT_TYPES } from '../../culture/catalog.js';

export const CROWD_CAP = 48;
export const FILE_LIMIT = 1024 * 1024;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const minute = value => Number.isSafeInteger(value) && value >= 0;
const festivals = new Map(CULTURE_EVENT_TYPES.filter(row => row.category === 'festival').map(row => [row.type, row]));

// Read only records of starts, never infer a gathering from a scheduled event.
export function readGatherings(snapshot) {
  if (snapshot?.schemaVersion !== 'culture.v1' || !text(snapshot.seed) || !minute(snapshot.minute) ||
      !Array.isArray(snapshot.activeEvents) || snapshot.activeEvents.length > 128 ||
      !Array.isArray(snapshot.history) || snapshot.history.length > 256) {
    throw new Error('Expected a bounded culture.v1 snapshot with seed and simulation minute.');
  }
  const events = new Map();
  const sources = [...snapshot.history.filter(row => row?.type === 'EVENT_STARTED' && row.minute === row.event?.startMinute).map(row => row.event), ...snapshot.activeEvents];
  for (const event of sources) {
    if (!event || !festivals.has(event.type)) continue;
    if (event.synthetic !== true || !text(event.id) || !text(event.districtId) ||
        !['manual', 'scheduled', 'emergent'].includes(event.source) ||
        !minute(event.startMinute) || !minute(event.endMinute) || event.endMinute <= event.startMinute ||
        event.startMinute > snapshot.minute) throw new Error('Invalid recorded gathering.');
    const row = { id: event.id, type: event.type, title: festivals.get(event.type).label,
      districtId: event.districtId, source: event.source, startMinute: event.startMinute, endMinute: event.endMinute };
    if (events.has(row.id) && JSON.stringify(events.get(row.id)) !== JSON.stringify(row)) throw new Error('Conflicting gathering identity.');
    events.set(row.id, row);
  }
  return { seed: snapshot.seed, minute: snapshot.minute, records: [...events.values()].sort((a,b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id)) };
}

export function squareState(archive, index, at, fictional = false, title = '') {
  if (fictional) return { title: title.trim().slice(0,120) || 'My community day', label: 'Fictional tour · decorative festival · no modeled event', figures: CROWD_CAP };
  const row = archive?.records[index];
  if (!row) return { title: 'Quiet square', label: 'No recorded gatherings loaded. No crowd inferred.', figures: 0 };
  const active = at >= row.startMinute && at < row.endMinute;
  return { title: row.title, label: `User-supplied synthetic culture record · ${active ? 'within recorded interval' : 'outside recorded interval'}`, figures: active ? CROWD_CAP : 0, row };
}
