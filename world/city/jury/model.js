import {createCity} from '../seed.js';
import {createEngine, addIntervention, cityMetrics} from '../engine.js';
import {VERSION} from '../contracts.js';
import {evaluateLivingCouncil} from '../../living-city/council.js';

export const JURY_VERSION = 'zoning-jury.v1';
export const RECIPE = Object.freeze({seed:42, households:120, months:36});
export const OPTIONS = Object.freeze({
  housing:Object.freeze({type:'housing',districtId:'d1',amount:6,cost:840000}),
  zoning:Object.freeze({type:'upzone',districtId:'d1',amount:6,cost:20000}),
});
const ids = ['renters','services','treasury'];
export function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const v of Object.values(value)) freeze(v); }
  return value;
}
// An immutable metric checkpoint, scoped to this authored recipe and City clock.
export function checkpoint(state, arm) {
  return freeze({id:`${JURY_VERSION}:${arm}:42:36`, arm, modelVersion:VERSION,
    seed:state.seed, month:state.month, metrics:cityMetrics(state)});
}
export async function replayJury(option, {signal, yieldStep=()=>Promise.resolve()}={}) {
  if (!Object.hasOwn(OPTIONS, option)) throw Error('Unknown authored proposal');
  const engine=createEngine(), initial=createCity(RECIPE);
  let baseline=engine.initialize(initial), plan=engine.initialize(addIntervention(initial, OPTIONS[option]));
  for(let i=0;i<RECIPE.months;i++) {
    await yieldStep();
    if(signal?.aborted) throw Error('Cancelled; no vote recorded.');
    baseline=engine.step(baseline).state;
    plan=engine.step(plan).state;
  }
  return freeze({version:JURY_VERSION,option,recipe:{...RECIPE},proposal:{...OPTIONS[option]},
    baseline:checkpoint(baseline,'baseline'),plan:checkpoint(plan,option)});
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function scoreJury(record, expected) {
  const unavailable=reason=>({status:'unavailable',reason,positions:[],support:null,success:null});
  if(!record||!expected)return unavailable('No source data; load the pinned authored demo.');
  if(!Object.hasOwn(OPTIONS,record.option)||record.version!==JURY_VERSION||!equal(record,expected))
    return unavailable('Replay mismatch; no vote recorded.');
  const {baseline,plan}=record;
  if(baseline.modelVersion!==VERSION||plan.modelVersion!==VERSION||baseline.seed!==plan.seed||baseline.month!==plan.month||baseline.month!==RECIPE.months)
    return unavailable('Replay mismatch; same-version, same-month and matched-seed checkpoints required.');
  for(const metric of ['meanRent','overloadedServices','balance','housingUnits','unhoused'])
    if(!Number.isFinite(baseline.metrics?.[metric])||!Number.isFinite(plan.metrics?.[metric]))
      return unavailable('Missing housing or preference inputs; no vote recorded.');
  const positions=evaluateLivingCouncil({before:baseline.metrics,after:plan.metrics,proposal:record.proposal}).positions.filter(p=>ids.includes(p.id));
  const support=positions.filter(p=>p.current.vote==='support').length;
  return {status:'verified',positions,support,success:support===3,
    housing:{baseline:baseline.metrics.housingUnits,plan:plan.metrics.housingUnits,
      unhousedBefore:baseline.metrics.unhoused,unhousedAfter:plan.metrics.unhoused}};
}
