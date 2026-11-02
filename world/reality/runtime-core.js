/** Actual paired futures. Programs contain explicit engine inputs, never prose
 * effects. Retain one frozen manifest and bounded per-run summaries; regenerate
 * detailed worlds on demand. City and population authorities remain separate. */
import {createEngine,cityMetrics,addIntervention,scheduleShock} from '../city/engine.js';
import {validateState,VERSION as CITY_VERSION} from '../city/contracts.js';
import {createPopulationModel,stepPopulation,serializePopulation,restorePopulation,snapshotPopulation,inspectPerson,inspectHousehold} from '../population/model.js';
import {populationParameters,normalizePopulationConfig,hash,draw,POPULATION_VERSION} from '../population/contracts.js';
import {resolveRealityPolicy,materializeRealityInterventions} from './compiler.js';
import {evaluatePolicyTests} from './testing.js';
import {CHILD_METRIC_UNITS} from '../population/children.js';
export const REALITY_RUNTIME_VERSION='reality-runtime.v1';
export const REALITY_LIMITS=Object.freeze({maxRuns:1000,maxMonths:120,maxMinutes:10080,maxCityEntities:12000,maxLiveCityEntities:20000,maxHouseholdMonths:2000000,maxPopulation:10000,maxAgentMinutes:20000000,maxAssumptions:16,maxSearchCases:32,maxAnalysisPairs:4000,maxAnalysisWork:4000000,maxManifestBytes:8000000,maxEvents:128,maxDecisions:128,maxTrajectoryEntities:8,maxTrajectorySamples:24});
export const CITY_INPUT_BOUNDS=Object.freeze({contractors:[0,500],labor:[0,500],materials:[0,500],equipment:[0,500],permits:[0,50],administration:[0,50],interestRate:[0,.25],constructionCost:[10000,1000000],annualGrowth:[-.1,.2]});
export const REALITY_METRICS=Object.freeze({city:{population:'people',households:'households',housingUnits:'units',availableUnits:'units',meanRent:'USD/month',medianRent:'USD/month',unhoused:'households',employed:'people',jobs:'jobs',businesses:'businesses',meanTravelMinutes:'minutes',overloadedServices:'facilities',utilityFailures:'utilities',balance:'USD',debt:'USD',completedProjects:'projects',publicCost:'USD',capitalCost:'USD'},population:{...CHILD_METRIC_UNITS,syntheticPopulation:'people',households:'households',employmentRate:'fraction',meanHouseholdIncome:'USD/year',meanHousingBurden:'fraction',meanStress:'index',modeledUtility:'index',meanCommuteMinutes:'minutes',meanExperiencedTravelMinutes:'minutes',deniedBoardings:'boardings',trips:'trips',completedTrips:'trips',moves:'moves',displacementRiskHouseholds:'households',businessRevenue:'USD',businessClosures:'businesses',congestion:'index',transitCrowding:'index',transitShare:'fraction',transitTrips:'trips',transitFare:'USD/trip'}});
const clone=value=>structuredClone(value),finite=Number.isFinite;
const abort=()=>Object.assign(new Error('Reality operation cancelled'),{name:'AbortError'});
const yieldLoop=()=>new Promise(resolve=>setTimeout(resolve,0));
function checked(condition,message){if(!condition)throw new Error(message);}
function boundedInteger(value,min,max,label){checked(Number.isInteger(value)&&value>=min&&value<=max,`${label} must be ${min}–${max}`);return value;}
function bounds(engine,key){if(engine==='city')return CITY_INPUT_BOUNDS[key];const row=populationParameters.find(p=>p.id===key);return row?[row.min,row.max]:null;}
function patch(engine,input={}){checked(input&&typeof input==='object'&&!Array.isArray(input),'Input patch must be an object');for(const [key,value]of Object.entries(input)){const range=bounds(engine,key);checked(range&&finite(value)&&value>=range[0]&&value<=range[1],`Unsupported or out-of-bounds ${engine} input ${key}`);if(engine==='population')checked(!['population','seed','householdSize','medianIncome','incomeSpread','employmentRate','representedPopulation','maxLogEntries'].includes(key),`${key} is an initial condition, not a treatment input`);}return clone(input);}
function defaultUncertainty(engine,initial,parameters,program){
 const keys=engine==='city'?['contractors','labor','permits','annualGrowth']:['transitCapacity','transitService','carCostPerKm'];
 const values=engine==='city'?initial?.parameters:normalizePopulationConfig(initial??{});
 const used=new Set((program.assumptions??[]).map(a=>a.parameter??a.input));
 return keys.filter(key=>!Object.hasOwn(parameters,key)&&!used.has(key)).map(key=>{const [low,high]=bounds(engine,key),value=values?.[key];checked(finite(value),'Initial background parameters required');return{id:`background.${key}`,parameter:key,value,min:Math.max(low,key==='annualGrowth'?value-.01:value*.5),max:Math.min(high,key==='annualGrowth'?value+.01:value*1.5),source:'Declared synthetic sensitivity interval around the frozen initial input; no empirical distribution',confidence:'uncalibrated',unit:engine==='city'?'model input':populationParameters.find(row=>row.id===key)?.unit};});
}
function testsFor(tests,engine){checked(Array.isArray(tests)&&tests.length<=32,'At most32 policy tests');const ids=new Set();return tests.map((test,index)=>{const id=test.id??`test-${index+1}`;checked(typeof id==='string'&&id.length<=96&&!ids.has(id),'Policy test IDs must be unique and bounded');ids.add(id);const assertions=test.then===undefined?[test]:Array.isArray(test.then)?test.then:[test.then];checked(assertions.length>0&&assertions.length<=16,'Use1–16 THEN assertions');for(const assertion of assertions){const op=assertion.operator??assertion.op,comparison=assertion.comparison??'treatment';checked(['<','<=','>','>=','=='].includes(op)&&['treatment','current','baseline','delta','percentChange','relativeChange'].includes(comparison)&&finite(assertion.threshold??assertion.value),'Tests require an explicit comparison, operator and finite threshold');checked(typeof(assertion.metric??assertion.metricId)==='string'&&typeof assertion.unit==='string','Tests require metric and unit');}return{...clone(test),id};});}
export function normalizeRealityRequest(request){
 const {program,initial,worldContext={},runs=100,seed=42,assumptionOverrides={},samplePolicyUncertainty=false}=request;
 checked(typeof samplePolicyUncertainty==='boolean','samplePolicyUncertainty must be explicit boolean');
 checked(program&&typeof program==='object'&&['city','population'].includes(program.engine),'Executable program.engine must be city or population');
 checked(program.executable!==false,'Program is not executable');
 const engine=program.engine;
 if(program.policy){checked(program.policy.engine===engine,'Compiler policy engine mismatch');checked(engine==='city'?!Object.keys(program.policy.populationPatch??{}).length&&!Object.keys(program.policy.populationFactors??{}).length:!Object.keys(program.policy.cityParameters??{}).length&&!Object.keys(program.policy.cityParameterFactors??{}).length&&!program.policy.interventions?.length,'Program mixes unsupported engine inputs');}
 boundedInteger(runs,1,REALITY_LIMITS.maxRuns,'Runs');boundedInteger(seed,0,4294967295,'Seed');
 const months=engine==='city'?boundedInteger(request.months??12,1,120,'Months'):null,minutes=engine==='population'?boundedInteger(request.minutes??1440,1,10080,'Minutes'):null;
 const parameters=patch(engine,engine==='city'?(program.policy?.cityParameters??program.city?.parameterPatch??program.parameterPatch??{}):(program.policy?.populationPatch??program.population?.configPatch??program.populationPatch??{}));
 const interventions=clone(program.policy?.interventions??program.city?.interventions??program.cityInterventions??[]);
 checked(Array.isArray(interventions)&&interventions.length<=32,'At most32 city interventions');
 checked(engine==='city'||interventions.length===0,'Population programs cannot contain city interventions');
 checked(interventions.length||Object.keys(parameters).length||Object.keys(program.policy?.cityParameterFactors??{}).length||Object.keys(program.policy?.populationFactors??{}).length,'Program has no supported executable inputs');
 const uncertainty=request.parameterUncertainty??program.parameterUncertainty??defaultUncertainty(engine,engine==='population'?(request.populationConfig??initial):initial,parameters,program);
 const assumptions=[...clone(program.assumptions??[]).map(a=>({...a,kind:program.policy?'policy':'background'})),...clone(uncertainty).map(a=>({...a,kind:'background'}))];checked(assumptions.length<=16,'At most16 assumptions');
 const ids=new Set(),inputKeys=new Set();for(const a of assumptions){checked(typeof a.id==='string'&&/^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/.test(a.id)&&!['__proto__','constructor','prototype'].includes(a.id)&&!ids.has(a.id),'Unique safe assumption IDs required');ids.add(a.id);checked(finite(a.min)&&finite(a.max)&&a.min<=a.max,`Declare plausible bounded assumption ${a.id}`);if(a.kind==='policy')checked(finite(a.value)&&a.value>=a.min&&a.value<=a.max,'Compiled policy assumptions require explicit bounded values');if(a.kind==='background'){const key=a.parameter??a.input,range=bounds(engine,key);checked(range&&a.min>=range[0]&&a.max<=range[1],`Unsupported uncertainty input ${a.id}`);patch(engine,{[key]:a.min});a.parameter=key;checked(!inputKeys.has(key),'Duplicate background uncertainty input');inputKeys.add(key);checked(!Object.hasOwn(parameters,key),'An uncertainty input cannot also be a treatment lever');}a.source??='Declared synthetic assumption';a.confidence??='uncalibrated';}
 checked(assumptionOverrides&&typeof assumptionOverrides==='object'&&!Array.isArray(assumptionOverrides),'Assumption overrides must be an object');
 for(const [id,value]of Object.entries(assumptionOverrides)){const a=assumptions.find(a=>a.id===id);checked(a&&finite(value)&&value>=a.min&&value<=a.max&&(!a.integer||Number.isInteger(value)),`Unknown or implausible assumption override ${id}`);}
 let frozenInitial,work;
 if(engine==='city'){validateState(initial);checked(initial.month===0,'Provide a frozen month0 CityState');checked(Object.values(initial).filter(Array.isArray).reduce((n,rows)=>n+rows.length,0)<=12000,'Initial city exceeds entity budget');frozenInitial=clone(initial);work=runs*2*months*Math.max(1,initial.households.length);checked(work<=2000000,'City household-month workload exceeds2000000');if(!program.policy)for(const action of interventions)addIntervention(initial,action);}
 else {const populationInitial=request.populationConfig??initial;checked(populationInitial&&typeof populationInitial==='object'&&(!populationInitial.schemaVersion||populationInitial.schemaVersion==='population-config.v1'),'Supply populationConfig for a population program when initial is a CityState; no silent cross-engine conversion');frozenInitial=normalizePopulationConfig(populationInitial);boundedInteger(frozenInitial.population,1,10000,'Population');work=runs*2*minutes*frozenInitial.population;checked(work<=20000000,'Population workload exceeds20000000 agent-minutes');normalizePopulationConfig({...frozenInitial,...parameters});}
 const tests=testsFor(request.tests??program.tests??[],engine);
 const stressConditions=clone(request.stressConditions??[]);checked(Array.isArray(stressConditions)&&stressConditions.length<=16,'At most16 explicit engine-specific stress conditions');if(engine==='city')for(const shock of stressConditions)scheduleShock(initial,shock);else normalizePopulationConfig({...frozenInitial,events:[...frozenInitial.events,...stressConditions]});
 const manifest={schemaVersion:'reality-manifest.v1',runtimeVersion:REALITY_RUNTIME_VERSION,modelVersion:engine==='city'?CITY_VERSION:POPULATION_VERSION,engine,program:clone(program),parameters,interventions,assumptions,parameterUncertainty:clone(uncertainty),samplePolicyUncertainty,assumptionOverrides:clone(assumptionOverrides),initial:frozenInitial,worldContext:clone(worldContext),runs,months,minutes,seed,tests,stressConditions,work,limits:clone(REALITY_LIMITS),limitations:['Synthetic conditional scenarios, not calibrated forecasts or legal enactment.','Paired seeds and frozen initial conditions do not prove a causal law; only wired model mechanisms are exercised.','City and population outcomes retain their own definitions and units. No cross-engine economy is synthesized.','Background uncertainty is uniform within declared bounds and identical in both arms, not an empirical posterior. Compiled policy values remain fixed unless samplePolicyUncertainty is explicitly enabled or a sensitivity override is supplied. Policy-strength changes affect treatment only.','Only completed engine runs are counted; unavailable tests never pass.']};
 checked(new TextEncoder().encode(JSON.stringify(manifest)).length<=8000000,'Manifest exceeds8MB; reduce explicit geography/entities');
 manifest.id=`reality-${hash(JSON.stringify(manifest)).toString(16)}`;return manifest;
}
export function verifyRealityManifest(manifest){checked(manifest?.runtimeVersion===REALITY_RUNTIME_VERSION,'Stored reality runtime version is unavailable');checked(manifest.modelVersion===(manifest.engine==='city'?CITY_VERSION:POPULATION_VERSION),'Stored model version is unavailable; refusing to reinterpret this future');const verified=normalizeRealityRequest(manifest);checked(verified.id===manifest.id,'Frozen reality manifest changed');return verified;}
function sample(manifest,index){const seed=hash(`${manifest.seed}:future:${index}`),assumptions={},inputs={};for(const a of manifest.assumptions){let value=manifest.assumptionOverrides[a.id]??(a.kind==='policy'&&!manifest.samplePolicyUncertainty?a.value:a.min+draw(manifest.seed,index,0,hash(a.id))*(a.max-a.min));if(a.integer)value=Math.round(value);assumptions[a.id]=value;if(a.kind==='background')inputs[a.parameter]=value;}return{seed,assumptions,inputs};}
const median=values=>{const rows=[...values].sort((a,b)=>a-b),i=Math.floor(rows.length/2);return rows.length?(rows.length%2?rows[i]:(rows[i-1]+rows[i])/2):null;};
const canonical=value=>JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])):row);
function policyFor(manifest,values,inputs){
 if(!manifest.program.policy)return null;
 return resolveRealityPolicy(manifest.program,{
  cityParameters:manifest.engine==='city'?{...manifest.initial.parameters,...inputs}:{},
  populationConfig:manifest.engine==='population'?{...manifest.initial,...inputs}:{},
  assumptions:Object.fromEntries(manifest.assumptions.filter(a=>a.kind==='policy').map(a=>[a.id,values[a.id]])),
 });
}
function cityPolicy(state,policy){
 state.parameters={...state.parameters,...patch('city',policy.cityParameters??{})};
 for(const intervention of materializeRealityInterventions(policy.interventions,state))state=addIntervention(state,intervention);
 return state;
}
function trajectoryOptions(manifest,trajectory,target){
 if(!trajectory)return null;
 checked(Array.isArray(trajectory.entities)&&trajectory.entities.length>0&&trajectory.entities.length<=8&&Array.isArray(trajectory.times)&&trajectory.times.length>0&&trajectory.times.length<=24,'Trajectories require1–8 actual entities and1–24 explicit sample times');
 const allowed=manifest.engine==='city'?['households','workers','businesses','projects','links','utilities']:['people','households'];
 for(const row of trajectory.entities)checked(allowed.includes(row.collection)&&typeof row.id==='string','Select an actual supported entity collection and ID');
 for(const t of trajectory.times)boundedInteger(t,0,target,'Trajectory sample time');
 if(manifest.engine==='population')checked(trajectory.times.every(t=>t%15===0||t===target),'Population trajectories sample existing15-minute commits or the final requested time; no extra stepping/interpolation');
 return{entities:clone(trajectory.entities),times:[...new Set(trajectory.times)].sort((a,b)=>a-b)};
}
function sampleEntities(state,spec,time,engine){
 if(!spec?.times.includes(time))return null;
 return{time,unit:engine==='city'?'month':'minute',entities:spec.entities.map(({collection,id})=>({collection,id,record:engine==='city'?clone(state[collection].find(row=>row.id===id)??null):collection==='people'?inspectPerson(state,id,{track:false}):inspectHousehold(state,id)})),source:'Actual committed replay checkpoint; absent entities remain null. No interpolation.'};
}
async function cityWorld(manifest,seed,inputs,treatment,{shouldCancel,retain,through,policy,trajectory}={}){
 const engine=createEngine();let state=clone(manifest.initial);state.seed=seed;state.parameters={...state.parameters,...inputs,...(treatment?manifest.parameters:{})};
 for(const shock of manifest.stressConditions)state=scheduleShock(state,shock);
 if(treatment){if(policy)state=cityPolicy(state,policy);else for(const intervention of manifest.interventions)state=addIntervention(state,intervention);}
 state=engine.initialize(state);let publicCost=0,capitalCost=0,events=[],decisions=[],droppedEvents=0,droppedDecisions=0;const checkpoints=[];const first=sampleEntities(state,trajectory,0,'city');if(first)checkpoints.push(first);
 for(let month=0;month<(through??manifest.months);month++){if(shouldCancel?.())throw abort();const result=engine.step(state);state=result.state;checked(state.households.length+state.units.length+state.projects.length<=20000,'Live city growth exceeds20000 entities');const finance=result.resolutions.find(r=>r.system==='finance')?.value;publicCost+=finance?.publicCost??0;capitalCost+=finance?.capitalExpense??0;
  if(retain){events.push(...result.events);decisions.push(...result.decisions);if(events.length>128){droppedEvents+=events.length-128;events=events.slice(-128);}if(decisions.length>128){droppedDecisions+=decisions.length-128;decisions=decisions.slice(-128);}}
  const checkpoint=sampleEntities(state,trajectory,month+1,'city');if(checkpoint)checkpoints.push(checkpoint);if(month%4===3)await yieldLoop();
 }
 const metrics={...cityMetrics(state),medianRent:median(state.units.map(u=>u.rent)),publicCost,capitalCost};
 return{metrics,...(retain?{state,events,projects:state.projects,decisions,checkpoints,entities:Object.fromEntries(['households','workers','businesses','projects','links','utilities','finance'].map(key=>[key,state[key]])),council:{actualHouseholds:state.households.length,actualPeople:metrics.population,voteUnit:'household',sizeWeights:'Household size represents people, never independent votes.',source:'Actual replayed city entities'},retention:{droppedEvents,droppedDecisions,maxEvents:128,maxDecisions:128}}:{})};
}
async function populationWorld(manifest,seed,inputs,treatment,{shouldCancel,retain,through,policy,trajectory}={}){
 // Generate from the same exogenous inputs BEFORE applying either treatment.
 const initial=createPopulationModel({...manifest.initial,...inputs,seed,events:[...manifest.initial.events,...manifest.stressConditions]},manifest.worldContext);
 const model=restorePopulation(serializePopulation(initial));if(treatment){const config={...model.config,...manifest.parameters,...patch('population',policy?.populationPatch??{})};for(const [key,factor]of Object.entries(policy?.populationFactors??{})){checked(finite(factor)&&factor>=0,'Invalid population factor');Object.assign(config,patch('population',{[key]:config[key]*factor}));}model.config=normalizePopulationConfig(config);}
 const checkpoints=[];const first=sampleEntities(model,trajectory,0,'population');if(first)checkpoints.push(first);
 const target=through??manifest.minutes;for(let elapsed=0;elapsed<target;){if(shouldCancel?.())throw abort();const next=trajectory?.times.find(t=>t>elapsed)??target,minutes=Math.min(15,target-elapsed,next-elapsed);stepPopulation(model,{minutes});elapsed+=minutes;const checkpoint=sampleEntities(model,trajectory,elapsed,'population');if(checkpoint)checkpoints.push(checkpoint);if(model.tick%16===0)await yieldLoop();}
 const transitTrips=(model.totals.tripCountsByMode.bus??0)+(model.totals.tripCountsByMode.rail??0);
 const metrics={...model.metrics,transitTrips,transitShare:model.totals.trips?transitTrips/model.totals.trips:null,transitFare:model.config.transitFare};
 const snapshot=retain?snapshotPopulation(model,{visibleLimit:1000,trackSelected:false}):null;
 return{metrics,...(retain?{state:serializePopulation(model),snapshot,checkpoints,entities:{people:snapshot.visibleAgents,households:[...new Set(snapshot.visibleAgents.map(row=>row.householdId))].map(id=>inspectHousehold(model,id))},council:{actualSamplePeople:snapshot.visibleAgents.length,syntheticPopulation:metrics.syntheticPopulation,representedPopulation:metrics.representedPopulation,personWeight:model.weight,voteUnit:'sampled synthetic person',denominator:'Actual deterministic sample, at most1000 people. Household size and represented-person weights are not independent votes.'},events:clone(model.events.slice(-128)),projects:[],decisions:[...model.traces.values()].flat().slice(-128),people:[inspectPerson(model,0,{track:false})],retention:{maxEvents:128,maxDecisions:128,source:'Model-bounded traces and events; no complete event archive.'}}:{})};
}
export async function simulateRealityPair(manifest,index,{shouldCancel=()=>false,retain=false,through,trajectory:requestedTrajectory}={}){
 checked(manifest?.runtimeVersion===REALITY_RUNTIME_VERSION,'Unavailable reality runtime version');boundedInteger(index,0,manifest.runs-1,'Future index');
 checked(manifest.modelVersion===(manifest.engine==='city'?CITY_VERSION:POPULATION_VERSION),'Unavailable engine version');
 if(through!==undefined)boundedInteger(through,0,manifest.engine==='city'?manifest.months:manifest.minutes,'Replay time');
 const trajectory=trajectoryOptions(manifest,requestedTrajectory,through??(manifest.months??manifest.minutes));
 const sampled=sample(manifest,index),simulate=manifest.engine==='city'?cityWorld:populationWorld;
 const policy=policyFor(manifest,sampled.assumptions,sampled.inputs);
 const baseline=await simulate(manifest,sampled.seed,sampled.inputs,false,{shouldCancel,retain,through,policy,trajectory}),treatment=await simulate(manifest,sampled.seed,sampled.inputs,true,{shouldCancel,retain,through,policy,trajectory});
 const period={from:0,to:through??(manifest.months??manifest.minutes),unit:manifest.engine==='city'?'month':'minute'},geography=manifest.worldContext?.id??manifest.initial.provenance?.populationSnapshot??'explicit-frozen-world';
 const conditions={...sampled.inputs,...sampled.assumptions},conditionRegistry=Object.fromEntries(manifest.assumptions.map(a=>[a.id,a.unit??'model input']));for(const a of manifest.assumptions)if(a.parameter)conditionRegistry[a.parameter]=a.unit??'model input';
 const testReport=evaluatePolicyTests({engine:manifest.engine,baseline,treatment,program:manifest.program,metricRegistry:REALITY_METRICS,period,geography,conditions,conditionRegistry},manifest.tests),tests=testReport.checks,pass=testReport.status==='pass'?true:testReport.status==='fail'?false:null;
 const delta=Object.fromEntries(Object.keys(REALITY_METRICS[manifest.engine]).map(key=>[key,finite(baseline.metrics[key])&&finite(treatment.metrics[key])?treatment.metrics[key]-baseline.metrics[key]:null]));
 return{id:`${manifest.id}-future-${index+1}`,runId:`${manifest.id}-future-${index+1}`,runIndex:index,seed:sampled.seed,assumptions:sampled.assumptions,status:'completed',pass,testStatus:testReport.status,tests,testReport,baseline:{...baseline,period,geography},treatment:{...treatment,period,geography},delta};
}
export async function executeRealityExperiment(manifest,{onProgress=()=>{},shouldCancel=()=>false}={}){
 manifest=verifyRealityManifest(manifest);
 const rows=[];onProgress({completed:0,total:manifest.runs});
 for(let i=0;i<manifest.runs;i++){if(shouldCancel())return finish('cancelled');try{rows.push(await simulateRealityPair(manifest,i,{shouldCancel}));}catch(error){if(error.name==='AbortError'||shouldCancel())return finish('cancelled');rows.push({id:`${manifest.id}-future-${i+1}`,runId:`${manifest.id}-future-${i+1}`,runIndex:i,status:'error',pass:null,error:error.message});}
  if((i+1)%8===0||i===manifest.runs-1){onProgress({completed:rows.length,total:manifest.runs,passed:rows.filter(r=>r.pass===true).length,failed:rows.filter(r=>r.pass===false).length});await yieldLoop();}
 }
 return finish('completed');
 function finish(status){const completed=rows.filter(r=>r.status==='completed'),tested=completed.filter(r=>r.pass!==null),statistics=values=>{const sorted=values.filter(finite).sort((a,b)=>a-b);const q=p=>sorted.length?sorted[Math.floor((sorted.length-1)*p)]:null;return{n:sorted.length,mean:mean(sorted),min:q(0),p10:q(.1),median:q(.5),p90:q(.9),max:q(1)};};const metrics=Object.fromEntries(Object.entries(REALITY_METRICS[manifest.engine]).map(([key,unit])=>[key,{unit,baseline:statistics(completed.map(r=>r.baseline.metrics[key])),treatment:statistics(completed.map(r=>r.treatment.metrics[key])),delta:statistics(completed.map(r=>r.delta[key]))}]));return{schemaVersion:'reality-results.v1',manifest,runs:rows,status,summary:{requested:manifest.runs,completed:completed.length,errors:rows.length-completed.length,passed:completed.filter(r=>r.pass===true).length,failed:completed.filter(r=>r.pass===false).length,unavailable:completed.filter(r=>r.tests.length&&r.pass===null).length,untested:completed.filter(r=>!r.tests.length).length,passRate:tested.length?tested.filter(r=>r.pass===true).length/tested.length:null,metrics,denominator:'Completed paired futures with evaluated pass/fail tests. Unavailable tests and simulation errors are reported separately and never pass.',distribution:'Recorded finite synthetic futures only; order-statistic ranges are not empirical confidence intervals.'}};}
}
export async function replayRealityFuture(result,{runId,month,minute,trajectory}={},options={}){
 result={...result,manifest:verifyRealityManifest(result?.manifest)};
 const row=result?.runs?.find(row=>row.runId===runId);checked(row&&row.status==='completed','Select an actually completed future');checked(result.manifest.engine==='city'?minute===undefined:month===undefined,'Replay clock unit does not match engine');const pair=await simulateRealityPair(result.manifest,row.runIndex,{...options,retain:true,trajectory,through:result.manifest.engine==='city'?month:minute});
 if(month===undefined&&minute===undefined)checked(canonical([pair.baseline.metrics,pair.treatment.metrics,pair.assumptions,pair.seed])===canonical([row.baseline.metrics,row.treatment.metrics,row.assumptions,row.seed]),'Replay did not reproduce selected future metrics');return{schemaVersion:'reality-replay.v1',manifestId:result.manifest.id,engine:result.manifest.engine,...pair,limitations:result.manifest.limitations};
}
function analysisManifest(result,overrides,runs,stressConditions=result.manifest.stressConditions){return normalizeRealityRequest({...result.manifest,program:result.manifest.program,assumptionOverrides:{...result.manifest.assumptionOverrides,...overrides},stressConditions,runs});}
export async function challengeRealityResult(result,{metric,runs=Math.min(4,result.manifest.runs),onProgress=()=>{},shouldCancel=()=>false}={}){
 checked(REALITY_METRICS[result.manifest.engine][metric],'Choose an implemented sensitivity metric');const cases=result.manifest.assumptions.flatMap(a=>[{id:`${a.id}:low`,assumptionId:a.id,value:a.min,overrides:{[a.id]:a.min}},{id:`${a.id}:high`,assumptionId:a.id,value:a.max,overrides:{[a.id]:a.max}}]);
 return analysis(result,cases,{runs,onProgress,shouldCancel,metric,kind:'one-assumption-at-a-time'});
}
export async function breakRealityPolicy(result,{grid,runs=Math.min(4,result.manifest.runs),onProgress=()=>{},shouldCancel=()=>false}={}){
 checked(result.manifest.tests.length,'Failure search needs at least one explicit policy test');
 const cases=grid??result.manifest.assumptions.flatMap(a=>[{id:`${a.id}:low`,overrides:{[a.id]:a.min}},{id:`${a.id}:high`,overrides:{[a.id]:a.max}}]);
 return analysis(result,cases,{runs,onProgress,shouldCancel,kind:'explicit-bounded-grid'});
}
async function analysis(result,cases,{runs,onProgress,shouldCancel,metric,kind}){
 checked(Array.isArray(cases)&&cases.length>0&&cases.length<=32,'Search requires1–32 explicit bounded cases');boundedInteger(runs,1,result.manifest.runs,'Analysis paired runs');checked(cases.length*runs<=4000,'Analysis exceeds4000 paired futures');checked(new Set(cases.map(c=>c.id)).size===cases.length,'Search case IDs must be unique');
 const manifests=cases.map(item=>analysisManifest(result,item.overrides??{},runs,item.stressConditions));checked(manifests.reduce((sum,m)=>sum+m.work,0)<=4000000,'Analysis exceeds4000000 workload units; reduce cases/runs/horizon');
 const evaluations=[];for(let i=0;i<cases.length;i++){if(shouldCancel())throw abort();const output=await executeRealityExperiment(manifests[i],{shouldCancel});if(output.status==='cancelled')throw abort();evaluations.push({...clone(cases[i]),result:output,meanDelta:metric?mean(output.runs.filter(r=>r.status==='completed').map(r=>r.delta[metric]).filter(finite)):null});onProgress({completed:i+1,total:cases.length});}
 const rankings=kind==='one-assumption-at-a-time'?result.manifest.assumptions.map(a=>{const rows=evaluations.filter(e=>e.assumptionId===a.id);return{assumptionId:a.id,metric,unit:REALITY_METRICS[result.manifest.engine][metric],low:rows[0].meanDelta,high:rows[1].meanDelta,sensitivity:rows.every(r=>finite(r.meanDelta))?Math.abs(rows[1].meanDelta-rows[0].meanDelta):null};}).sort((a,b)=>(b.sensitivity??-1)-(a.sensitivity??-1)):[];
 return{schemaVersion:'reality-analysis.v1',kind,evaluations,rankings,failures:evaluations.flatMap(e=>e.result.runs.filter(r=>r.pass===false).map(row=>({runId:row.runId,caseId:e.id,runIndex:row.runIndex,tests:row.tests}))),limitations:['Actual reruns over the listed finite cases only; not a global optimum or empirical causal attribution.','Every grid value is checked against its declared plausible bounds.','No failure is invented when the searched cases pass.']};
}
const mean=rows=>rows.length?rows.reduce((a,b)=>a+b,0)/rows.length:null;
export function proposeRealityFix(replay,manifest){
 checked(replay?.status==='completed','Select a completed failure world');checked(replay.pass===false,'Fix suggestions require an actually nonpassing policy test');
 const suggestions=[];if(manifest.engine==='city'&&replay.treatment.projects.some(p=>!['completion','abandoned'].includes(p.stage))){for(const key of ['contractors','permits']){const a=manifest.assumptions.find(a=>a.parameter===key);if(a&&replay.assumptions[a.id]<a.max)suggestions.push({assumptionId:a.id,input:`city.parameters.${key}`,from:replay.assumptions[a.id],to:a.max,assumptionOverrides:{[a.id]:a.max},reason:'Unfinished projects exist; this raises an implemented capacity input. It does not establish that this resource caused the delay.',requiresRerun:true});}}
 if(manifest.engine==='population'){const a=manifest.assumptions.find(a=>a.parameter==='transitCapacity');if(a&&replay.treatment.metrics.deniedBoardings>0)suggestions.push({assumptionId:a.id,input:'population.config.transitCapacity',from:replay.assumptions[a.id],to:a.max,assumptionOverrides:{[a.id]:a.max},reason:'Actual denied boardings were recorded; test a declared capacity increase.',requiresRerun:true});}
 return{schemaVersion:'reality-fix.v1',runId:replay.runId,suggestions,notice:'Only existing model input changes are proposed. No training, guaranteed success, physical workforce skill or new causal mechanism is invented.'};
}
