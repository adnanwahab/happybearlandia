import { assertFrameIntegrity, assertHistoryIntegrity } from '../integrity.js';
import {compareCityStates, metricDelta} from './core.js';

// Keys and units match the coordinator's frozen future-machine.v1 contract.
const METRIC_UNITS = Object.freeze({population:'people',households:'households',housingUnits:'homes',availableUnits:'homes',meanRent:'USD/month',unhoused:'households',employed:'workers',jobs:'jobs',businesses:'businesses',meanTravelMinutes:'minutes/link',balance:'USD',debt:'USD',capitalSpending:'USD cumulative',completedProjects:'projects'});

function assertMonth(month) {
  if (!Number.isInteger(month) || month < 0 || month > 120) throw new Error('Month must be an integer from 0 through 120');
}

function stableState(value) {
  if (Array.isArray(value)) {
    const rows = value.every(row => row && typeof row.id === 'string') ? [...value].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : value;
    return `[${rows.map(stableState).join(',')}]`;
  }
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableState(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Compare a pair of read-only monthly snapshots. Metrics come from the snapshots,
 * including cumulative spending; absent measurements are never recomputed as zero. */
export function compareFrame(frame) {
  assertFrameIntegrity(frame);
  const {month, baseline, plan} = frame;
  for (const snapshot of [baseline, plan]) {
    if (snapshot && (snapshot.month !== month || snapshot.state?.month !== month)) throw new Error('Snapshot month does not match frame');
  }
  const metrics = Object.fromEntries(Object.entries(METRIC_UNITS).map(([key, unit]) => [key, metricDelta(baseline?.metrics?.[key], plan?.metrics?.[key], unit)]));
  if (!baseline || !plan) return {month, available:false, entities:[], metrics, physicalCount:0, changedCount:0,
    households:{status:'missing',rows:[]}, missing:[{kind:'snapshot',sides:[!baseline?'baseline':null,!plan?'plan':null].filter(Boolean)}]};
  const comparison = compareCityStates(baseline.state, plan.state);
  const entities = Object.values(comparison.entities).flatMap(group => ['added', 'removed', 'modified'].flatMap(type => group[type].map(change => ({
    collection:change.kind, id:change.id, kind:type === 'modified' ? 'changed' : type,
    before:change.baseline, after:change.plan, changedFields:change.fields.map(f => f.field),
    physical:['buildings', 'links'].includes(change.kind) && (type !== 'modified' || change.physical),
    buildingIds:change.buildingIds,
  })))).sort((a,b) => a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {month, available:comparison.missing.length === 0 && Object.values(metrics).every(m => m.status === 'available'),
    entities, metrics, physicalCount:entities.filter(e => e.physical).length, changedCount:entities.length,
    households:comparison.households, missing:comparison.missing};
}

/** Exactly 121 frame results, keyed by their recorded month rather than row order. */
export function compareHistory(history) {
  if (history?.experimentId) assertHistoryIntegrity(history);
  if (!history || !Array.isArray(history.baseline) || !Array.isArray(history.plan)) throw new Error('Two monthly histories required');
  function months(snapshots) {
    if (snapshots.length > 121) throw new Error('History exceeds 120 monthly steps');
    const result = new Map();
    for (const snapshot of snapshots) {
      if (snapshot == null) continue;
      assertMonth(snapshot.month);
      if (result.has(snapshot.month)) throw new Error('Duplicate history month');
      if (snapshot.state?.seed !== history.seed || snapshot.state?.version !== history.modelVersion) throw new Error('History seed/model version mismatch');
      result.set(snapshot.month, snapshot);
    }
    return result;
  }
  const baseline = months(history.baseline), plan = months(history.plan);
  // Month 0 represents the common pre-intervention original, including parameters,
  // finance, provenance and shocks. Inventory ordering has no identity semantics.
  if (baseline.has(0) && plan.has(0)) {
    const initial = compareFrame({month:0, baseline:baseline.get(0), plan:plan.get(0)});
    if (stableState(baseline.get(0).state) !== stableState(plan.get(0).state) || initial.changedCount || Object.values(initial.metrics).some(m => m.delta !== null && m.delta !== 0)) throw new Error('Month 0 must be a common initial state');
  }
  return Array.from({length:121}, (_,month) => compareFrame({month, baseline:baseline.get(month) ?? null, plan:plan.get(month) ?? null}));
}

export {compareCityStates, compareEntities, compareHouseholds, metricDelta} from './core.js';
