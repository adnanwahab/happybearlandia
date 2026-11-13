import { POPULATION_VERSION, ACTIVITIES, MODES } from './contracts.js';
import { householdMembers } from './household-members.js';

export const AUDIT_VERSION = 'population-invariants.v1';
const sum = values => Array.from(values).reduce((a,b)=>a+b,0);
const count = value => Number.isSafeInteger(value) && value >= 0;

/** Read-only checks of committed full state, independent of the render sample.
 * Failures describe internal consistency, never empirical validity.
 */
export function auditPopulation(model) {
  if (model?.modelVersion !== POPULATION_VERSION) throw Error('Unsupported population model version');
  const failures = [];
  const check = (ok, rule, detail) => { if (!ok) failures.push({rule,detail}); };
  const p = model.people, hh = model.households, n = p.age.length, h = hh.size.length;
  const d = model.districts.length, weight = model.weight;
  check(Number.isFinite(weight) && weight > 0, 'weight', weight);
  // Generation may later add births; config.population is not a lifetime invariant.
  check(n === model.metrics.syntheticPopulation, 'population-total', n);
  check(n * weight === model.metrics.representedPopulation, 'represented-total', n * weight);
  const seen = new Uint8Array(n), homes = new Uint32Array(d), workers = new Uint32Array(d);
  const activity = Object.fromEntries(ACTIVITIES.map(k=>[k,0]));
  const modes = Object.fromEntries(MODES.map(k=>[k,0]));
  let traveling = 0, employed = 0;
  for (const [key, values] of Object.entries(p)) {
    if (ArrayBuffer.isView(values)) check(values.length === n, 'person-column-length', key);
  }
  for (let j=0;j<h;j++) {
    const members = householdMembers(model,j);
    check(members.length === hh.size[j], 'household-size', j);
    for (const i of members) {
      const valid = Number.isInteger(i) && i>=0 && i<n;
      check(valid && !seen[i] && p.household[i]===j, 'household-membership', {household:j,person:i});
      if (valid) seen[i]=1;
    }
    check(hh.home[j]<d, 'housing-district', j);
    if (hh.home[j]<d) homes[hh.home[j]]++;
    for (const key of ['income','rent','savings']) check(Number.isFinite(hh[key][j]) && hh[key][j]>=0, 'household-resource', {household:j,key});
  }
  check(seen.every(v=>v===1), 'population-membership', n);
  for (let i=0;i<n;i++) {
    check(p.age[i]<=2 && p.employed[i]<=1, 'demographic-code', i);
    check(ACTIVITIES[p.activity[i]]!==undefined && MODES[p.mode[i]]!==undefined, 'activity-mode-code', i);
    if (ACTIVITIES[p.activity[i]]) activity[ACTIVITIES[p.activity[i]]]++;
    if (MODES[p.mode[i]]) modes[MODES[p.mode[i]]]++;
    for (const key of ['home','work','current','from','to']) check(p[key][i]<d, 'person-district', {person:i,key});
    for (const key of ['x','z','remaining','tripTotal']) check(Number.isFinite(p[key][i]) && (!['remaining','tripTotal'].includes(key)||p[key][i]>=0), 'travel-resource', {person:i,key});
    for (const key of ['hunger','energy','fun','social']) check(Number.isFinite(p[key][i]) && p[key][i]>=0 && p[key][i]<=100, 'need-bound', {person:i,key});
    if (p.remaining[i]>0) traveling++;
    if (p.employed[i]) { employed++; if (p.work[i]<d) workers[p.work[i]]++; }
  }
  for (let j=0;j<d;j++) {
    const district=model.districts[j];
    check(homes[j]*weight <= district.housingUnits*model.config.housingCapacityMultiplier+1e-8, 'housing-capacity', district.id);
    check(workers[j]*weight <= district.jobs+1e-8, 'labor-capacity', district.id);
    check(Number.isFinite(district.services) && district.services>=0 && district.services<=1, 'service-access', district.id);
  }
  for (const [key,value] of Object.entries(activity)) check(value===model.activityCounts[key], 'activity-total', key);
  for (const [key,value] of Object.entries(modes)) check(value===model.modeCounts[key], 'mode-total', key);
  check(employed===model.metrics.employed, 'employment-total', employed);
  const trips=model.totals;
  for (const key of ['trips','completedTrips','cancelledTrips']) check(count(trips[key]??(key==='cancelledTrips'?0:NaN)), 'trip-counter', key);
  check(Object.entries(trips.tripCountsByMode).every(([key,v])=>MODES.includes(key)&&count(v)), 'trip-mode-counter', trips.tripCountsByMode);
  check(sum(Object.values(trips.tripCountsByMode))===trips.trips, 'trip-mode-balance', trips.trips);
  check(trips.trips===trips.completedTrips+(trips.cancelledTrips||0)+traveling, 'trip-flow-balance', traveling);
  check(sum(model.odFlows.map(row=>row.count))===traveling, 'od-flow-balance', traveling);
  check(sum(model.cohorts.map(row=>row.count))===h, 'income-cohort-total', h);
  let lastMinute=-Infinity, lastTick=-Infinity;
  for (const event of model.events) {
    check(Number.isFinite(event.minute) && event.minute>=lastMinute && event.minute<=model.minute && Number.isSafeInteger(event.tick) && event.tick>=lastTick && event.tick<=model.tick, 'event-order', event.id);
    lastMinute=event.minute; lastTick=event.tick;
  }
  for (const rows of model.traces.values()) for (const trace of rows) {
    if (trace.type !== 'MODE_CHOICE') continue;
    const alternatives=trace.alternatives;
    const feasible=Array.isArray(alternatives) && alternatives.some(row=>row.available);
    const validChoice=feasible ? alternatives.some(row=>row.id===trace.chosen && row.available) : trace.chosen===null && trace.reasonCodes?.includes('NO_FEASIBLE_ALTERNATIVE');
    check(Array.isArray(alternatives) && validChoice && alternatives.every(row=>Number.isFinite(row.probability) && row.probability>=0 && row.probability<=1 && (row.available || row.probability===0)) && Math.abs(sum(alternatives.map(row=>row.probability))-(feasible?1:0))<1e-8, 'mode-choice', trace.id);
  }
  return {schemaVersion:AUDIT_VERSION,modelVersion:model.modelVersion,seed:model.seed,minute:model.minute,tick:model.tick,
    passed:failures.length===0,failures,totals:{people:n,households:h,representedPeople:n*weight,employed,traveling},
    distributions:{activity,modes,tripDepartures:{...trips.tripCountsByMode},income:Object.fromEntries(model.cohorts.map(row=>[row.id,row.count]))},
    provenance:{type:'synthetic-model-result',observations:[],source:'world/population/MODEL_CARD.md',calibrated:false}};
}

/** Total variation distance of normalized histograms; empty support is unavailable. */
export function distributionDrift(before, after) {
  for (const row of [before,after]) if (!row || Object.values(row).some(v=>!Number.isFinite(v)||v<0)) throw Error('Nonnegative finite histogram required');
  const a=sum(Object.values(before)), b=sum(Object.values(after));
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw Error('Histogram total must be finite');
  if (!a || !b) return null;
  return [...new Set([...Object.keys(before),...Object.keys(after)])].reduce((v,k)=>v+Math.abs((before[k]||0)/a-(after[k]||0)/b),0)/2;
}
