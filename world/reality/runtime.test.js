import {test,expect} from 'bun:test';
import {createCity} from '../city/seed.js';
import {compileRealityProposal} from './compiler.js';
import {normalizeRealityRequest,executeRealityExperiment,replayRealityFuture,challengeRealityResult,breakRealityPolicy,proposeRealityFix} from './runtime-core.js';
import {createRealityRuntime} from './runtime.js';
const fareTest={id:'fare-zero',metric:'transitFare',operator:'==',threshold:0,unit:'USD/trip'};
const free=()=>compileRealityProposal('Make public transit free');
const populationRequest=(extra={})=>({program:free(),populationConfig:{population:4},runs:2,minutes:30,seed:42,parameterUncertainty:[],tests:[fareTest],...extra});

test('compiler fare policy executes actual paired population configurations, units, and deterministic replay',async()=>{
 const manifest=normalizeRealityRequest(populationRequest({initial:createCity({households:2})}));
 expect(normalizeRealityRequest(manifest).id).toBe(manifest.id);
 const before=JSON.stringify(manifest),a=await executeRealityExperiment(manifest),b=await executeRealityExperiment(manifest);
 expect(a).toEqual(b);expect(a.summary).toMatchObject({completed:2,passed:2,errors:0,passRate:1});expect(JSON.stringify(manifest)).toBe(before);
 const replay=await replayRealityFuture(a,{runId:a.runs[0].id});
 expect(replay.baseline.state.config.transitFare).toBe(2.5);expect(replay.treatment.state.config.transitFare).toBe(0);
 expect(replay.baseline.state.people.age).toEqual(replay.treatment.state.people.age);
 expect(replay.baseline.state.households.start).toEqual(replay.treatment.state.households.start);
 expect(replay.treatment.snapshot.visibleAgents).toHaveLength(4);
 expect(replay.treatment.entities.households.length).toBeGreaterThan(0);
 expect(replay.treatment.council).toMatchObject({actualSamplePeople:4,syntheticPopulation:4});
 expect(replay.treatment.state.minute).toBe(30);
});

test('100 and1000 futures are distinct actual completed seed pairs, with explicit workload rejection',async()=>{
 const hundred=await executeRealityExperiment(normalizeRealityRequest(populationRequest({runs:100,minutes:1,populationConfig:{population:1}})));
 expect(hundred.runs).toHaveLength(100);expect(hundred.summary.completed).toBe(100);expect(new Set(hundred.runs.map(r=>r.seed)).size).toBe(100);
 const thousand=await executeRealityExperiment(normalizeRealityRequest({program:compileRealityProposal('Speed housing permits'),initial:createCity({households:1}),runs:1000,months:1,seed:2,parameterUncertainty:[],assumptionOverrides:{housingCapacityIncrease:0,compliance:1,delayMonths:0,permitCapacityFactor:2}}));
 expect(thousand.runs).toHaveLength(1000);expect(thousand.summary.completed).toBe(1000);expect(thousand.summary.errors).toBe(0);expect(new Set(thousand.runs.map(r=>r.seed)).size).toBe(1000);
 expect(thousand.runs.every(r=>r.treatment.metrics.population>0)).toBe(true);
 expect(()=>normalizeRealityRequest(populationRequest({runs:1000,minutes:10080,populationConfig:{population:10000}}))).toThrow('workload');
},30000);

test('city compiler applies a total capital envelope once even when one unit targets three districts',async()=>{
 const program=compileRealityProposal('Build housing'),initial=createCity({households:4}),before=JSON.stringify(initial);
 const result=await executeRealityExperiment(normalizeRealityRequest({program,initial,runs:1,months:1,parameterUncertainty:[],assumptionOverrides:{housingProjectUnits:1,housingProjectCost:99.01,compliance:1,delayMonths:0}}));
 const entered=await replayRealityFuture(result,{runId:result.runs[0].id,trajectory:{entities:[{collection:'households',id:initial.households[0].id}],times:[0,1]}});
 expect(entered.treatment.state.policies.reduce((n,p)=>n+p.cost,0)).toBe(99.01);
 expect(entered.treatment.state.policies.reduce((n,p)=>n+p.amount,0)).toBe(1);
 expect(entered.baseline.state.policies).toHaveLength(0);expect(JSON.stringify(initial)).toBe(before);
 expect(entered.treatment.checkpoints.map(p=>p.time)).toEqual([0,1]);
 expect(entered.treatment.entities.households).toHaveLength(4);expect(entered.treatment.entities.finance).toEqual(entered.treatment.state.finance);
});

test('unsupported or wrong-unit tests never pass and GWT records use actual conditions',async()=>{
 const request=populationRequest({tests:[{...fareTest,unit:'USD/year'},{id:'missing',metric:'emissions',operator:'<=',threshold:0,unit:'tonnes'},{id:'gwt',given:[{key:'unknown-growth',operator:'>=',threshold:.2,unit:'fraction'}],when:{programId:free().id},then:[fareTest]}]});
 const result=await executeRealityExperiment(normalizeRealityRequest(request));
 expect(result.summary).toMatchObject({passed:0,unavailable:2,passRate:null});
 expect(result.runs[0].tests.every(t=>t.status==='unavailable')).toBe(true);
});

test('background uncertainty and exogenous events are shared across arms and actually reach model inputs',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest(populationRequest({parameterUncertainty:[{id:'service',parameter:'transitService',min:.5,max:1.5,unit:'multiplier'}],stressConditions:[{type:'transit-outage',startMinute:0,durationMinutes:30,magnitude:.5}],assumptionOverrides:{service:.75}})));
 const pair=await replayRealityFuture(result,{runId:result.runs[0].id});
 expect(pair.baseline.state.config.transitService).toBe(.75);expect(pair.treatment.state.config.transitService).toBe(.75);
 expect(pair.baseline.state.config.events).toEqual(pair.treatment.state.config.events);
 expect(pair.assumptions.service).toBe(.75);
});

test('challenge and failure search execute actual bounded reruns with enterable failure IDs',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest(populationRequest({parameterUncertainty:[{id:'service',parameter:'transitService',min:.5,max:1.5,unit:'multiplier'}],tests:[{...fareTest,operator:'>',threshold:0}]})));
 const challenge=await challengeRealityResult(result,{metric:'transitFare',runs:1});
 expect(challenge.evaluations).toHaveLength(2);expect(challenge.evaluations.every(e=>e.result.summary.completed===1)).toBe(true);expect(challenge.rankings[0].sensitivity).toBe(0);
 const search=await breakRealityPolicy(result,{grid:[{id:'low',overrides:{service:.5}},{id:'high',overrides:{service:1.5}}],runs:1});
 expect(search.failures).toHaveLength(2);
 const failure=search.failures[0],catalog=search.evaluations.find(e=>e.id===failure.caseId).result;
 const entered=await replayRealityFuture(catalog,{runId:failure.runId});expect(entered.pass).toBe(false);expect(entered.assumptions.service).toBe(.5);
 expect(proposeRealityFix(entered,catalog.manifest).suggestions).toEqual([]);
 await expect(breakRealityPolicy(result,{grid:[{id:'invalid',overrides:{service:99}}],runs:1})).rejects.toThrow('implausible');
});

test('population checkpoints use existing commits, actual rows and exact replay metrics',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest(populationRequest())),entry=await replayRealityFuture(result,{runId:result.runs[0].id}),id=entry.treatment.entities.people[0].id;
 const replay=await replayRealityFuture(result,{runId:entry.id,trajectory:{entities:[{collection:'people',id}],times:[0,15,30]}});
 expect(replay.treatment.checkpoints.map(p=>p.time)).toEqual([0,15,30]);expect(replay.treatment.checkpoints.every(p=>p.entities[0].record.id===id)).toBe(true);
 await expect(replayRealityFuture(result,{runId:entry.id,trajectory:{entities:[{collection:'people',id}],times:[7]}})).rejects.toThrow('existing15-minute');
});

test('actual stalled city projects support only explicit existing capacity suggestions',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest({program:compileRealityProposal('Build housing'),initial:createCity({households:2}),runs:1,months:4,parameterUncertainty:[{id:'crew',parameter:'contractors',min:0,max:20},{id:'queue',parameter:'permits',min:0,max:4}],assumptionOverrides:{housingProjectUnits:1,housingProjectCost:0,compliance:1,delayMonths:0,crew:0,queue:0},tests:[{id:'finish',metric:'completedProjects',operator:'>',threshold:999,unit:'projects'}],stressConditions:[{type:'flood',districtId:'d1',start:1,duration:2,severity:1}]}));
 const entered=await replayRealityFuture(result,{runId:result.runs[0].id});
 expect(entered.baseline.state.shocks).toEqual(entered.treatment.state.shocks);
 expect(entered.treatment.projects.length).toBeGreaterThan(0);
 const fixes=proposeRealityFix(entered,result.manifest);
 expect(fixes.suggestions.map(row=>row.input)).toEqual(['city.parameters.contractors','city.parameters.permits']);
 expect(fixes.suggestions.every(row=>row.requiresRerun)).toBe(true);
});

test('cooperative cancellation reports only actually completed rows',async()=>{
 let stopped=false;const result=await executeRealityExperiment(normalizeRealityRequest(populationRequest({runs:100})),{shouldCancel:()=>stopped,onProgress:progress=>{if(progress.completed>=8)stopped=true;}});
 expect(result.status).toBe('cancelled');expect(result.runs).toHaveLength(8);expect(result.summary.completed).toBe(8);
});

test('compiled child policy uses registered observed-time metrics and refuses older population replay versions',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest({program:compileRealityProposal('Start school later'),populationConfig:{population:80,householdSize:4},worldContext:{districts:[{id:'d',x:0,z:0}]},runs:1,minutes:720,parameterUncertainty:[],tests:[{id:'sleep',metric:'teenSleepMinutes',operator:'>',threshold:0,comparison:'delta',unit:'teen-minutes'}]}));
 expect(result.summary.passed).toBe(1);expect(result.runs[0].delta.teenSleepMinutes).toBeGreaterThan(0);expect(result.runs[0].treatment.metrics.childObservedMinutes).toBeGreaterThan(0);
 const old=structuredClone(result);old.manifest.modelVersion='1.1.0';await expect(replayRealityFuture(old,{runId:old.runs[0].id})).rejects.toThrow('model version');
});

test('real worker client runs, reconstructs, isolates public data and cleans up on abort',async()=>{
 const runtime=createRealityRuntime({populationConfig:{population:3},workerFactory:()=>new Worker(new URL('./runtime.worker.js',import.meta.url).href,{type:'module'})});
 try{
  const result=await runtime.run(populationRequest({runs:1,minutes:15,populationConfig:{population:3}}));
  expect(result.summary.passed).toBe(1);result.runs[0].treatment.metrics.transitFare=99;
  const replay=await runtime.enterFuture({runId:result.runs[0].id});expect(replay.treatment.state.config.transitFare).toBe(0);
  const controller=new AbortController();controller.abort();await expect(runtime.run({...populationRequest(),signal:controller.signal})).rejects.toThrow('cancelled');
 }finally{runtime.destroy();}
},10000);
