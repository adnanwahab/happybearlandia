import {createHash} from 'node:crypto';
import {createPopulationModel,stepPopulation} from '../population/model.js';
import {POPULATION_VERSION} from '../population/contracts.js';
import {peopleBenchmarkContext} from '../bench/people-context.js';
import {attachTransportExperiment,TRANSPORT_ARMS,TRANSPORT_RULES} from '../population/transport-experiment.js';
import {createTransportObserver} from './transport-graph.js';
import {pairedSeedBand} from './paired-seeds.js';
export const EXPERIMENT_VERSION='population-transport-ablation.v1';
export const HEADLINES=Object.freeze(['commuteMinutes','employmentRate','occupancy','monthlyRent']);
export const UNITS=Object.freeze({commuteMinutes:'planned minutes per work-bound departure',employmentRate:'employed / adult residents',occupancy:'households / assumed housing units',monthlyRent:'USD per household per month'});
// Hash actual state, including typed bytes and reference identity, without a
// huge JSON allocation or relying on the model's bounded retained event list.
export function stateDigest(value){
 const hash=createHash('sha256'),seen=new Map();
 const token=v=>hash.update(JSON.stringify(v)+'\n');
 function visit(v){
  if(v===undefined){token(['undefined']);return;}
  if(v===null||typeof v!=='object'){token([typeof v,v]);return;}
  if(seen.has(v)){token(['reference',seen.get(v)]);return;}seen.set(v,seen.size);
  if(ArrayBuffer.isView(v)){token([v.constructor.name,v.byteLength]);hash.update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));return;}
  if(v instanceof ArrayBuffer){token(['ArrayBuffer',v.byteLength]);hash.update(new Uint8Array(v));return;}
  if(v instanceof Map){token(['Map',v.size]);for(const [k,x]of v){visit(k);visit(x);}return;}
  if(v instanceof Set){token(['Set',v.size]);for(const x of v)visit(x);return;}
  const keys=Object.keys(v).sort();token([Array.isArray(v)?'Array':'Object',keys]);for(const k of keys)visit(v[k]);
 }
 visit(value);return hash.digest('hex');
}
export function normalizeExperiment({populations=[10000,100000],seeds=[42,43,44,45,46],days=1,...rest}={}){
 if(Object.keys(rest).length)throw Error('Unknown experiment options');
 for(const [name,values,max]of [['populations',populations,100000],['seeds',seeds,0xffffffff]]){
  if(!Array.isArray(values)||!values.length||values.length>(name==='seeds'?32:4)||new Set(values).size!==values.length||values.some(n=>!Number.isInteger(n)||n<(name==='seeds'?0:1)||n>max))throw Error(`Invalid ${name}`);
 }
 if(!Number.isInteger(days)||days<1||days>31)throw Error('Days must be 1–31');
 return {populations:[...populations],seeds:[...seeds],days};
}
export function runTransportArm({population,seed,days,arm}){
 normalizeExperiment({populations:[population],seeds:[seed],days});
 if(!TRANSPORT_ARMS.includes(arm))throw Error('Unknown transport arm');
 const worldContext=peopleBenchmarkContext(),model=createPopulationModel({population,seed},worldContext);
 if(model.validation.gate.accepted===false)throw Error('Population initialization validation failed');
 const initialDigest=stateDigest(model),observer=createTransportObserver(population);
 attachTransportExperiment(model,arm,observer);
 for(let tick=1;tick<=days*24;tick++)stepPopulation(model,{tick,minutes:60});
 const measured=observer.result(),hh=model.households;
 const rent=hh.rent.reduce((s,v)=>s+v,0)/hh.size.length;
 const housing=model.districts.reduce((s,d)=>s+d.housingUnits*model.config.housingCapacityMultiplier,0);
 return {population,seed,days,arm,initialDigest,finalDigest:stateDigest(model),
  modelVersion:model.modelVersion,config:model.config,worldContext,
  clock:{initialMinute:0,finalMinute:model.minute,completedTicks:model.tick,minutesPerCall:60,internalIntervalMaxMinutes:15},
  outcomes:{commuteMinutes:measured.commute.meanMinutes,employmentRate:model.metrics.employmentRate,
   occupancy:housing>0?hh.size.length*model.weight/housing:null,monthlyRent:Number.isFinite(rent)?rent:null},
  denominators:{workBoundDepartures:measured.commute.departures,adults:model.people.age.filter(a=>a===1).length,households:hh.size.length,housingUnits:housing},
  graph:measured.graph,validation:model.validation};
}
export function summarizeExperiment(settings,runs){
 const {populations,seeds,days}=normalizeExperiment(settings);
 if(runs.length!==populations.length*seeds.length*TRANSPORT_ARMS.length)throw Error('Missing or extra runs');
 const indexed=new Map();
 for(const row of runs){
  const key=`${row.population}/${row.seed}/${row.arm}`;
  if(indexed.has(key)||!populations.includes(row.population)||!seeds.includes(row.seed)||!TRANSPORT_ARMS.includes(row.arm)||row.days!==days||row.modelVersion!==POPULATION_VERSION)throw Error('Unexpected, duplicate or incompatible run');
  for(const outcome of HEADLINES)if(row.outcomes?.[outcome]!==null&&!Number.isFinite(row.outcomes?.[outcome]))throw Error('Invalid or missing outcome');
  if(!/^[a-f0-9]{64}$/.test(row.initialDigest))throw Error('Missing initial state digest');
  indexed.set(key,row);
 }
 const comparisons=populations.map(population=>{
  for(const seed of seeds){const digests=TRANSPORT_ARMS.map(arm=>indexed.get(`${population}/${seed}/${arm}`).initialDigest);if(new Set(digests).size!==1)throw Error('Seed-matched initial states differ');}
  const controls=TRANSPORT_ARMS.slice(1).map(arm=>({arm,outcomes:Object.fromEntries(HEADLINES.map(metric=>[metric,pairedSeedBand(seeds.map(seed=>({seed,full:indexed.get(`${population}/${seed}/full`).outcomes[metric],control:indexed.get(`${population}/${seed}/${arm}`).outcomes[metric]})))]))}));
  const significant=Object.entries(controls[0].outcomes).filter(([,band])=>band.excludesZero).map(([metric])=>metric);
  return {population,controls,transportOnlyStatisticalCriterion:significant.length>=2,significantTransportOnlyOutcomes:significant,
   e2Pass:false,claim:'withheld: complete no-interaction arm is unavailable'};
 });
 return {schemaVersion:EXPERIMENT_VERSION,modelVersion:POPULATION_VERSION,rulesVersion:TRANSPORT_RULES,
  settings:{populations,seeds,days,arms:TRANSPORT_ARMS},units:UNITS,
  source:{type:'synthetic-analyst-assumptions',empiricallyCalibrated:false,fixture:'world/bench/people-context.js'},
  intervention:{full:'Unchanged current rules', 'frozen-transport':'Freeze transport reads at initial free flow, zero transit demand and crowding',
   'shuffled-transport':'Permute district demand feedback each internal interval; same district resource multiset; no partner rewiring',
   'half-transport':'Scale congestion excess, crowding and boarding demand by 0.5',
   'double-transport':'Scale congestion excess, crowding and boarding demand by 2'},
  coverage:{completeNoInteraction:false,ablated:['lagged road congestion','lagged transit crowding','same-step transit boarding demand'],
   remaining:['household shared budget and needs','guardian/child and care capacity','housing vacancies and moves','employer capacity, staffing, payroll and shared demand','social encounters and traditions'],
   partnerShuffle:false,actualShards:false},
  comparisons,runs,
  limitations:['This is a transport-channel feasibility slice, not completed E2 or a release gate for interacting residents.',
   '95% bands describe variation across stated synthetic seeds, not empirical uncertainty. At least three complete pairs required; missing observations invalidate a band.',
   'Work-bound planned travel is not experienced commute duration. Occupancy is aggregate housing utilization; district rents are exogenous.',
   'Graph measures sampled transport resource incidence, not state-changing resident pair events. Cross-shard share is unavailable on the single runtime.',
   'Recipe regeneration only; experiment controls are intentionally not part of production checkpoints. No million-resident, GPU, rendering or empirical validation claim.']};
}
