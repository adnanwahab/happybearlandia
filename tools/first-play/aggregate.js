export const STAGES = ['landing', 'start', 'choice', 'first_change', 'share', 'return'];
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

// Read-only export adapter. Never infers missing transitions or cross-session identity.
export function aggregateFirstPlay(input) {
  if (input?.schemaVersion !== 'first-play-export.v1' || !text(input.source) ||
      !['recorded', 'synthetic-fixture'].includes(input.kind) || !Array.isArray(input.events) || input.events.length > 100000)
    throw Error('Expected a bounded first-play-export.v1 export with source and kind.');
  const from = timestamp(input.observationStart), until = timestamp(input.observationEnd);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) throw Error('Invalid observation interval.');
  const ids = new Map(), sessions = new Map();
  let duplicates = 0, bots = 0;
  for (const event of input.events) {
    const time = timestamp(event.timestamp);
    if (!text(event.id) || !text(event.sessionId) || !STAGES.includes(event.type) ||
        !Number.isFinite(time) || time < from || time >= until || typeof event.bot !== 'boolean')
      throw Error('Invalid event or event outside the observation interval.');
    const canonical = JSON.stringify([event.sessionId, event.type, time, event.bot]);
    if (ids.has(event.id)) {
      if (ids.get(event.id) !== canonical) throw Error('Conflicting duplicate event ID.');
      duplicates++; continue;
    }
    ids.set(event.id, canonical);
    if (!sessions.has(event.sessionId)) sessions.set(event.sessionId, []);
    sessions.get(event.sessionId).push({...event, time});
  }
  const counts = STAGES.map(() => 0), rawCounts = STAGES.map(() => 0), cohorts = new Map();
  for (const rows of sessions.values()) {
    // A known bot anywhere excludes the entire session, including earlier emissions.
    if (rows.some(row => row.bot)) { bots++; continue; }
    rows.sort((a,b) => a.time-b.time || STAGES.indexOf(a.type)-STAGES.indexOf(b.type));
    let stage = 0;
    for (const row of rows) {
      rawCounts[STAGES.indexOf(row.type)]++;
      if (row.type === STAGES[stage]) { counts[stage]++; stage++; }
    }
    const landing = rows.find(row => row.type === 'landing');
    if (!landing) continue;
    const date = new Date(landing.time).toISOString().slice(0,10);
    if (!cohorts.has(date)) cohorts.set(date, {date, landingSessions:0, startedSessions:0, changedSessions:0});
    const cohort = cohorts.get(date);
    cohort.landingSessions++;
    if (stage >= 2) cohort.startedSessions++;
    if (stage >= 4) cohort.changedSessions++;
  }
  return {
    schemaVersion:'first-play-dashboard.v1', source:input.source, kind:input.kind,
    observationStart:input.observationStart, observationEnd:input.observationEnd,
    uniqueEvents:ids.size, duplicateEvents:duplicates, excludedBotSessions:bots,
    stages:STAGES.map((type,i)=>({type, events:rawCounts[i], sessions:counts[i],
      conversion:i === 0 ? null : counts[i-1] ? counts[i]/counts[i-1] : null})),
    cohorts:[...cohorts.values()].sort((a,b)=>a.date.localeCompare(b.date)),
    retention:{day1:null, day7:null, reason:'Unavailable: no verified consented cross-session identity or complete follow-up contract. Return is an explicitly recorded same-session funnel transition, not retention.'},
    limitations:['Counts describe anonymous sessions, not people. Funnel requires ordered transitions within one session.',
      'Cohorts use first observed landing date in UTC within this export; earlier visits and missing emissions are unknown.',
      'No population inference, simulator outcome inference, or extrapolation beyond the supplied observation interval.']
  };
}
