/** Editorial rules only. This module has no simulator, RNG, or command access. */
export const DIRECTOR_VERSION = 'cinematic-city.v1';
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const milestones = new Set(['CONSTRUCTION_STARTED','TOPPED_OUT','PROJECT_COMPLETE']);
const conflicts = new Set(['HOUSEHOLD_BUDGET_STRESS','CAPITAL_PROJECT_DELAYED','BUDGET_DEFICIT']);

export function selectMoments(history, {limit = 24} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('Invalid moment limit');
  const candidates = [];
  for (const arm of ['baseline','plan']) {
    const records = new Map(), months = new Set();
    for (const frame of history[arm] || []) {
      if (!Number.isInteger(frame.month) || frame.month < 0 || frame.month > 120 || months.has(frame.month)) throw Error('Invalid or duplicate recorded month');
      months.add(frame.month);
    }
    for (const frame of history[arm] || []) for (const event of frame.events || []) {
      if (typeof event.id !== 'string' || !event.id || event.simulationTime !== frame.month) continue;
      if (records.has(event.id)) throw Error('Ambiguous event identity');
      records.set(event.id, event);
    }
    for (const frame of history[arm] || []) {
      for (const event of frame.events || []) {
        if (records.get(event.id) !== event) continue;
        const dependencies = (event.dependencies || []).filter(id => typeof id === 'string');
        const parents = dependencies.map(id => records.get(id));
        const chain = dependencies.length > 0 && parents.every(parent => parent && parent.simulationTime < event.simulationTime);
        const kind = milestones.has(event.eventType) ? 'construction' : conflicts.has(event.eventType) ? 'goal-conflict' : chain ? 'chain' : null;
        if (!kind) continue;
        candidates.push({kind, arm, month:frame.month, source:{kind:'event',id:event.id}, record:structuredClone(event), dependencies:chain ? structuredClone(parents) : [], missingDependencies:dependencies.filter(id => !records.has(id))});
      }
      // City decisions have no event ID: preserve their exact immutable record index.
      (frame.decisions || []).forEach((decision,index) => {
        if (decision.actorType !== 'jobs' || decision.decisionType !== 'job-match' || decision.simulationTime !== frame.month || !decision.actorId) return;
        candidates.push({kind:'character-decision',arm,month:frame.month,source:{kind:'decision',index,actorId:decision.actorId},record:structuredClone(decision),dependencies:[],missingDependencies:[]});
      });
    }
  }
  candidates.sort((a,b) => a.month-b.month || compare(a.arm,b.arm) || compare(JSON.stringify(a.source),JSON.stringify(b.source)));
  const seen = new Set();
  const unique = candidates.filter(moment => {
    const entity = moment.record.payload?.projectId || moment.record.payload?.householdId || moment.record.actorId || moment.record.eventType;
    const key = JSON.stringify([moment.arm,moment.kind,entity,moment.record.eventType || moment.record.decisionType]);
    if (seen.has(key)) return false;
    seen.add(key);return true;
  });
  // Reserve a place for each available kind before filling chronologically.
  const representatives = [...new Set(unique.map(row => row.kind))].map(kind => unique.find(row => row.kind === kind));
  const selected = [...representatives, ...unique.filter(row => !representatives.includes(row))].slice(0,limit);
  selected.sort((a,b) => candidates.indexOf(a)-candidates.indexOf(b));
  return selected.map(moment => ({...moment,id:JSON.stringify([DIRECTOR_VERSION,history.experimentId ?? null,moment.arm,moment.month,moment.source]),rulesVersion:DIRECTOR_VERSION,experimentId:history.experimentId ?? null,seed:history.seed ?? null,modelVersion:history.modelVersion ?? moment.record.modelVersion ?? null}));
}
