/** Constitution City runtime contract v1.
 * createConstitutionRuntime({initial,plan}) in runtime.js ->
 * {run({scenarios,runs=2,months=120,seed=42,onProgress,signal}),
 * enterFuture({runId,month}),cancel(),destroy()}.
 * Scenarios: {id,label,clauseIds:[],compliance:1,delayMonths:0,
 * sunsetYears:0|2|5|10,costScale:0.0001}. Baseline has clauseIds:[].
 * Runs count is PER scenario; runIndex seeds match across scenarios.
 * Monthly metric rows include month0. Full city state is never retained for
 * every month/run: enterFuture regenerates the exact frozen manifest+seed.
 * Worker protocol RUN/PROGRESS/RESULT/ERROR/REPLAY/REPLAY_RESULT/CANCEL.
 * All plan edits use Models' applyClausePlan; no duplicated policy model.
 * Sunsets stop future authorization and reverse only recorded reversible legal
 * lever deltas. Infrastructure and spent money are never deleted/refunded.
 */
import {createEngine,cityMetrics} from '../city/engine.js';
import {VERSION,validateState} from '../city/contracts.js';
import {deriveSeed} from '../world-generator.js';
import {applyClausePlan} from './plan.js';
export const CONSTITUTION_RUNTIME_VERSION='constitution-runtime.1.0.0';
export const CONSTITUTION_LIMITS=Object.freeze({maxRuns:1000,maxScenarios:8,maxMonths:360,maxEvaluations:4000,maxMetricRows:150000,maxHouseholdMonths:2000000,maxInitialEntities:12000,maxLiveEntities:20000,maxEventsPerRun:96,maxDiagnosticsPerRun:48});
const copy=value=>structuredClone(value);
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value);
const entityCount=state=>['households','workers','units','buildings','parcels','projects','jobs','businesses'].reduce((sum,key)=>sum+(state[key]?.length||0),0);
export function normalizeConstitutionRequest({initial,plan,scenarios,runs=2,months=120,seed=42}){
 validateState(initial);
 if(initial.month!==0)throw new Error('Constitution experiments require an explicit month0 initial city snapshot');
 if(initial.version!==VERSION)throw new Error('Initial city model version is unavailable');
 if(plan?.schemaVersion!=='constitution-city-plan.v1'||!Array.isArray(plan.clauses)||plan.clauses.length>128)throw new Error('A normalized, bounded Constitution City policy plan is required');
 if(!Number.isInteger(runs)||runs<1||runs>1000||!Number.isInteger(months)||months<0||months>360||!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Use1–1000 runs per scenario,0–360 months and a uint32 seed');
 if(!Array.isArray(scenarios)||!scenarios.length||scenarios.length>8)throw new Error('Use1–8 scenarios');
 const ids=new Set(),clauseIds=new Set(plan.clauses.map(clause=>clause.id));
 const normalized=scenarios.map((scenario)=>{
  if(!safeId(scenario?.id)||ids.has(scenario.id))throw new Error('Scenario IDs must be unique safe identifiers');ids.add(scenario.id);
  const clauseList=scenario.clauseIds??plan.clauses.map(clause=>clause.id);
  if(!Array.isArray(clauseList)||clauseList.length>128||new Set(clauseList).size!==clauseList.length||clauseList.some(id=>!clauseIds.has(id)))throw new Error('Scenario clauseIds contain unknown or duplicate policy IDs');
  const compliance=scenario.compliance??1,delayMonths=scenario.delayMonths??0,sunsetYears=scenario.sunsetYears??0,costScale=scenario.costScale??.0001;
  if(!Number.isFinite(compliance)||compliance<0||compliance>1||!Number.isInteger(delayMonths)||delayMonths<0||delayMonths>360||![0,2,5,10].includes(sunsetYears)||!Number.isFinite(costScale)||costScale<0||costScale>.01)throw new Error('Invalid compliance/delay/cost scale; sunset is permanent(0),2y,5y or10y');
  if(typeof scenario.label!=='string'||!scenario.label.trim()||scenario.label.length>200)throw new Error('Scenario label must contain1–200 characters');
  return{id:scenario.id,label:scenario.label,clauseIds:copy(clauseList),compliance,delayMonths,sunsetYears,costScale};
 });
 const evaluations=runs*normalized.length,metricRows=evaluations*(months+1),work=evaluations*Math.max(1,months)*Math.max(1,initial.households.length);
 if(evaluations>4000||metricRows>150000||work>2000000||entityCount(initial)>12000)throw new Error(`Constitution workload exceeds safe budget (${evaluations} futures, ${metricRows} metric rows, ${work} household-months). Limits:4000 futures/150000 rows/2000000 household-months; reduce scenarios,runs,horizon,or explicit city size. No silent truncation.`);
 return{schemaVersion:'constitution-city-manifest.v1',runtimeVersion:CONSTITUTION_RUNTIME_VERSION,modelVersion:VERSION,seed,runs,months,initial:copy(initial),plan:copy(plan),scenarios:normalized,assumptions:['City entities/economics are illustrative assumptions unless separately sourced; policy clauses are proposals, not enacted constitutional text.','National clause costs are distinct from explicitly scaled synthetic local capital costs.','Seeds pair future allocation draws; the same frozen city snapshot is shared across scenarios. No calibrated parameter uncertainty is added.','Sunset expires at month24/60/120 from experiment start, not implementation completion. Built assets and sunk spending remain; only attributable upzone legal deltas reverse.','District transport is coarse network allocation, not lane-level traffic physics.'],budgets:copy(CONSTITUTION_LIMITS)};
}
function event(month,type,payload){return{schemaVersion:'SystemEvent.v1',id:`constitution-${month}-${type}`,simulationTime:month,system:'constitution-runtime',eventType:type,geographyId:'city',severity:1,payload,modelId:'constitution-runtime',modelVersion:CONSTITUTION_RUNTIME_VERSION};}
function prepare(manifest,scenario,seed){
 const initial=copy(manifest.initial);initial.seed=seed;
 const ids=new Set(initial.policies.map(policy=>policy.id));
 const applied=applyClausePlan(initial,manifest.plan,{...scenario,scenarioId:scenario.id,sunsetYears:0});validateState(applied);
 const added=applied.policies.filter(policy=>!ids.has(policy.id)).map(policy=>policy.id);
 const legal=[];for(const parcel of applied.parcels){const before=initial.parcels.find(row=>row.id===parcel.id);if(before)for(const field of ['capacity','far'])if(Number.isFinite(parcel[field])&&Number.isFinite(before[field])&&parcel[field]!==before[field])legal.push({parcelId:parcel.id,field,delta:parcel[field]-before[field]});}
 return{state:createEngine().initialize(applied),added,legal,expired:false,expiry:scenario.sunsetYears?scenario.sunsetYears*12:null,initialPolicyIds:ids};
}
function legalActivations(before,after,context){
 // Replay the engine's sorted upzone legal increments, recording only newly
 // introduced policy deltas even when pre-existing policies activate that month.
 const parcels=new Map(before.parcels.map(parcel=>[parcel.id,{capacity:parcel.capacity,far:parcel.far}]));
 for(const policy of [...before.policies].sort((a,b)=>a.id.localeCompare(b.id))){if(policy.type!=='upzone'||policy.stage!=='FUNDED'||after.policies.find(row=>row.id===policy.id)?.stage!=='ACTIVE')continue;
  for(const parcel of before.parcels.filter(row=>row.districtId===policy.districtId)){const prior=parcels.get(parcel.id),next={capacity:prior.capacity+Math.floor(policy.amount),far:Math.min(20,prior.far+policy.amount/1000)};if(context.added.includes(policy.id))for(const field of ['capacity','far'])if(next[field]!==prior[field])context.legal.push({policyId:policy.id,parcelId:parcel.id,field,delta:next[field]-prior[field]});parcels.set(parcel.id,next);}
 }
}
function expire(context,month){if(context.expired||context.expiry===null||month<context.expiry)return[];
 const state=context.state,removed=state.policies.filter(policy=>context.added.includes(policy.id));
 state.policies=state.policies.filter(policy=>!context.added.includes(policy.id));
 for(const delta of context.legal){const parcel=state.parcels.find(row=>row.id===delta.parcelId);if(parcel)parcel[delta.field]=Math.max(0,parcel[delta.field]-delta.delta);}
 state.constitutionRuntime={...(state.constitutionRuntime||{}),expiredAtMonth:month,expiredPolicies:copy(removed),reversedLegalDeltas:copy(context.legal)};
 context.expired=true;return[event(month,'POLICY_SUNSET',{policyIds:removed.map(policy=>policy.id),reversedLegalDeltas:copy(context.legal),retainedProjects:state.projects.filter(project=>context.added.includes(project.policyId)).map(project=>project.id),capitalExpenseRetained:state.finance.capitalExpense,note:'No built infrastructure removed and no spent money refunded.'})];
}
const yieldLoop=()=>new Promise(resolve=>setTimeout(resolve,0));
export async function simulateConstitutionCity(manifest,scenario,seed,{throughMonth=manifest.months,shouldCancel=()=>false,onMonth,retainState=false}={}){
 if(manifest.modelVersion!==VERSION||manifest.runtimeVersion!==CONSTITUTION_RUNTIME_VERSION)throw new Error('Stored model/runtime version is unavailable; refusing reinterpretation');
 if(!Number.isInteger(throughMonth)||throughMonth<0||throughMonth>manifest.months)throw new Error('Requested month is outside the frozen experiment horizon');
 const engine=createEngine(),context=prepare(manifest,scenario,seed),metricsTimeline=[{month:0,metrics:cityMetrics(context.state)}],events=[],diagnostics=[],eventCounts={};
 let droppedEvents=0,droppedDiagnostics=0,last={events:[],decisions:[],flows:[]};
 for(let month=1;month<=throughMonth;month++){
  if(shouldCancel())throw new Error('Constitution simulation cancelled');
  const sunsetEvents=expire(context,month),before=context.state,result=engine.step(before);context.state=result.state;legalActivations(before,result.state,context);
  if(entityCount(context.state)>20000)throw new Error('City entity growth exceeded20000; run stopped without truncating city state');
  const emitted=[...sunsetEvents,...result.events];for(const item of emitted){eventCounts[item.eventType]=(eventCounts[item.eventType]||0)+1;events.push(item);if(events.length>96){events.shift();droppedEvents++;}}
  for(const item of result.diagnostics){diagnostics.push({month,...item});if(diagnostics.length>48){diagnostics.shift();droppedDiagnostics++;}}
  metricsTimeline.push({month,metrics:cityMetrics(context.state)});last={...result,events:emitted};
  onMonth?.(month);if(month%4===0)await yieldLoop();
 }
 return{metricsTimeline,events,diagnostics,eventCounts,retention:{events:96,diagnostics:48,droppedEvents,droppedDiagnostics,fullStates:'regenerated on demand from frozen manifest'},...(retainState?{state:context.state,selectedEvents:last.events,decisions:last.decisions||[],flows:last.flows||[]}:{} )};
}
export async function executeConstitutionExperiment(manifest,{onProgress=()=>{},shouldCancel=()=>false}={}){
 const rows=[],total=manifest.runs*manifest.scenarios.length,start=performance.now();let failed=0,pending=[],lastProgress=0;
 const publish=()=>{onProgress({completed:rows.length,total,successful:rows.length-failed,failed,elapsedMs:Math.round(performance.now()-start),runs:pending});pending=[];lastProgress=performance.now();};publish();
 for(let runIndex=0;runIndex<manifest.runs;runIndex++)for(const scenario of manifest.scenarios){if(shouldCancel()){publish();return{schemaVersion:'constitution-city-results.v1',manifest,runs:rows,scenarios:manifest.scenarios,status:'cancelled'};}
  const seed=deriveSeed(manifest.seed,runIndex),id=`${scenario.id}_${String(runIndex+1).padStart(4,'0')}`;let row;
  try{const output=await simulateConstitutionCity(manifest,scenario,seed,{shouldCancel});row={id,scenarioId:scenario.id,runIndex,seed,status:'completed',...output};}
  catch(error){if(shouldCancel()){publish();return{schemaVersion:'constitution-city-results.v1',manifest,runs:rows,scenarios:manifest.scenarios,status:'cancelled'};}failed++;row={id,scenarioId:scenario.id,runIndex,seed,status:'failed',metricsTimeline:[],events:[],diagnostics:[{message:error.message}],error:error.message};}
  rows.push(row);pending.push(row);if(pending.length>=16||performance.now()-lastProgress>100||rows.length===total)publish();await yieldLoop();
 }
 return{schemaVersion:'constitution-city-results.v1',manifest,runs:rows,scenarios:manifest.scenarios,status:rows.some(row=>row.status==='completed')?'completed':'failed'};
}
export async function replayConstitutionFuture(result,{runId,month},{shouldCancel=()=>false}={}){
 const source=result.runs.find(row=>row.id===runId&&row.status==='completed');if(!source)throw new Error('Select a recorded successful Constitution City future');
 const scenario=result.manifest.scenarios.find(row=>row.id===source.scenarioId);if(!scenario)throw new Error('Frozen scenario is unavailable');
 if(source.seed!==deriveSeed(result.manifest.seed,source.runIndex))throw new Error('Run seed does not match frozen paired manifest');
 const replay=await simulateConstitutionCity(result.manifest,scenario,source.seed,{throughMonth:month,retainState:true,shouldCancel});
 const baseline=result.manifest.scenarios.find(row=>!row.clauseIds.length);let baselineState,baselineEvents=[],baselineDecisions=[],baselineFlows=[];
 if(baseline){const control=await simulateConstitutionCity(result.manifest,baseline,source.seed,{throughMonth:month,retainState:true,shouldCancel});baselineState=control.state;baselineEvents=control.selectedEvents;baselineDecisions=control.decisions;baselineFlows=control.flows;}
 return{runId,scenarioId:source.scenarioId,seed:source.seed,month,state:replay.state,events:replay.selectedEvents,decisions:replay.decisions,flows:replay.flows,baselineState,baselineEvents,baselineDecisions,baselineFlows,manifest:{modelVersion:result.manifest.modelVersion,runtimeVersion:result.manifest.runtimeVersion,seed:source.seed,sourceRunId:runId,month}};
}
