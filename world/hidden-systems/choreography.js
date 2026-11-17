// Presentation only: events must belong to this exact project and checkpoint.
export const DELAY_TYPES = new Set(['CAPACITY_DELAY', 'MATERIAL_DELAY', 'CAPITAL_PROJECT_DELAYED', 'IMPLEMENTATION_DELAY']);
const beats = new Map([
  ['CONSTRUCTION_STARTED', 'Site setup'],
  ['TOPPED_OUT', 'Topping out'],
  ['PROJECT_COMPLETE', 'Completion'],
]);
export function recordedBeat(snapshot, project) {
  if (!Number.isSafeInteger(snapshot?.month) || snapshot.month < 0 || !project) return null;
  const events = (project?.events ?? []).filter(event =>
    event.simulationTime === snapshot?.month && event.payload?.projectId === project.id);
  if (events.some(event => DELAY_TYPES.has(event.eventType))) return null;
  const event = [...events].reverse().find(event => beats.has(event.eventType));
  return event ? { event, label: beats.get(event.eventType) } : null;
}
