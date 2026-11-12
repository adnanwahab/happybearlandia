export const WEEK_MINUTES = 7 * 1440;
export const WEEK_VERSION = 'household-week.v1';
const EVENT_LIMIT = 2000;

// This is recorded playback of observed frames, not event-driven recomputation.
export function createWeekRecorder({ householdId, members, runId, snapshot }) {
  const step = snapshot.runtime?.stepMinutes;
  if (!householdId || !members?.length || !runId || !Number.isInteger(step) || step <= 0 || 1440 % step) {
    throw Error('A saved household and a fixed clock that represents exact days are required.');
  }
  const memberIds = new Set(members);
  const events = new Map();
  const initialIds = new Set((snapshot.events ?? []).map(event => event.id));
  const startMinute = snapshot.minute;
  if (!Number.isInteger(startMinute) || !Number.isInteger(snapshot.runtime.tick) || !snapshot.modelVersion || !Number.isInteger(snapshot.config?.seed)) {
    throw Error('The saved run is missing clock or model/seed provenance.');
  }
  const endMinute = startMinute + WEEK_MINUTES;
  let evicted = 0;
  const report = {
    schemaVersion: WEEK_VERSION, householdId, members: [...members], runId,
    modelVersion: snapshot.modelVersion, seed: snapshot.config?.seed,
    config: structuredClone(snapshot.config), startMinute, endMinute,
    startTick: snapshot.runtime.tick, endTick: snapshot.runtime.tick + WEEK_MINUTES / step,
    stepMinutes: step, observations: [], events: [],
    coverage: { eventLimit: EVENT_LIMIT, evicted: 0,
      limits: 'Synthetic Population model results. Worker frames retain bounded recent events; unobserved or evicted events cannot be reconstructed. Events already in the starting checkpoint are excluded. Daily needs and decision traces are samples, not a continuous history; empty traces mean no decision evidence retained. Members are the starting household cohort. No causal effect estimate or mapping to another model is provided.' },
  };
  return {
    report,
    capture(frame) {
      for (const event of frame.events ?? []) {
        if (!event.id || initialIds.has(event.id) || !Number.isFinite(event.minute) ||
          event.minute < startMinute || event.minute > endMinute) continue;
        if (event.householdId !== householdId && !memberIds.has(event.personId) &&
          !event.personIds?.some(id => memberIds.has(id))) continue;
        if (events.has(event.id)) continue;
        events.set(event.id, structuredClone(event));
        if (events.size > EVENT_LIMIT) { events.delete(events.keys().next().value); evicted++; }
      }
    },
    observe(minute, household, people) {
      if (household?.id !== householdId || people.length !== members.length || people.some(person => !person || !memberIds.has(person.id))) {
        throw Error('The recorded household or a member is unavailable.');
      }
      if (minute !== startMinute + report.observations.length * 1440 || minute > endMinute) {
        throw Error('Daily observation is missing or out of order.');
      }
      report.observations.push({ minute, savings: household.savings ?? household.budget?.savings ?? null,
        householdDecisionTrace: structuredClone(household.decisionTrace ?? []),
        people: people.map(person => ({ id: person.id, name: person.name, homeId: person.homeId ?? null,
          activity: person.currentActivity ?? null, needs: structuredClone(person.needs ?? null),
          locationId: person.locationId ?? null, travelMode: person.mode ?? null,
          position: { x: person.x ?? null, z: person.z ?? null }, commuteMinutes: person.commuteMinutes ?? null,
          decisionTrace: structuredClone(person.decisionTrace ?? []) })) });
    },
    finish(frame) {
      if (frame.minute !== endMinute || frame.runtime.tick !== report.endTick || report.observations.length !== 8) {
        throw Error('The household week is incomplete. Resume observation before saving.');
      }
      report.events = [...events.values()].sort((a, b) => a.minute - b.minute);
      report.coverage.evicted = evicted;
      return structuredClone(report);
    },
  };
}

export function validateWeekReport(report, householdId) {
  if (report?.schemaVersion !== WEEK_VERSION || report.householdId !== householdId ||
    !Array.isArray(report.events) || !Array.isArray(report.observations) || report.observations.length !== 8 ||
    report.endMinute - report.startMinute !== WEEK_MINUTES || !report.members?.length || !report.coverage?.limits ||
    report.observations.some((row, day) => row.minute !== report.startMinute + day * 1440) ||
    report.events.some((event, index) => !event.id || !Number.isFinite(event.minute) || event.minute < report.startMinute ||
      event.minute > report.endMinute || (index > 0 && event.minute < report.events[index - 1].minute))) {
    throw Error('This checkpoint has no complete week for the selected household.');
  }
  return report;
}
