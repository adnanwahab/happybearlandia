import {test,expect} from 'bun:test';
import {defaultPopulationConfig,validatePopulationConfig} from '../world/population/contracts.js';
import {createPopulationEdit,validatePopulationEdit,createPopulationExperiment} from '../world/population/edit-schema.js';
import {explainPopulationEntity} from '../world/population/copilot.js';
import {populationConfigIsUnchanged,runPopulationStudioExperiment,populationComparisonSeries,populationBehaviorFilter,populationCountRows} from '../world/population/studio.js';
const config=validatePopulationConfig(defaultPopulationConfig).values;
test('proposals are detached and reject stale approvals',()=>{const before=structuredClone(config),p=createPopulationEdit(config,{rentMultiplier:.8});expect(config).toEqual(before);expect(validatePopulationEdit(p,config).valid).toBe(true);expect(validatePopulationEdit(p,{...config,seed:43}).valid).toBe(false);expect(()=>createPopulationEdit(config,{rentMultiplier:-1})).toThrow();});
test('experiment adapter bounds actual configs and pairs seed indices',async()=>{const request=createPopulationExperiment(config,{runs:2});let args,cancelled=false;const job=runPopulationStudioExperiment({runExperiments(input){args=input;return{ready:Promise.resolve({rows:[],manifest:{configs:input.configs}}),cancel(){cancelled=true;}};}},request);const result=await job.ready;expect(args.configs.every(c=>c.population===2000)).toBe(true);expect(args.seeds).toEqual([42,(42+2654435761)>>>0]);expect(result.studioPopulation).toBe(2000);expect(config.population).toBe(10000);job.cancel();expect(cancelled).toBe(true);});
test('trajectory chart averages only actually recorded matching points',()=>{const series=populationComparisonSeries({manifest:{configs:[config]},rows:[{status:'completed',manifest:{configIndex:0},summary:{timeSeries:[{minute:0,burden:2},{minute:30,burden:6}]}},{status:'completed',manifest:{configIndex:0},summary:{timeSeries:[{minute:0,burden:4}]}}]});expect(series[0].rows[0].metrics.burden).toBe(3);expect(series[0].rows[1].metrics.burden).toBeUndefined();expect(populationComparisonSeries({manifest:{configs:[config]},rows:[]})[0].rows).toEqual([]);});
test('grounded answers use canonical decisionTrace and never invent missing reasons',()=>{const record={decisionType:'mode-choice',reasonCodes:['CHEAPER']};expect(explainPopulationEntity({id:'p1',decisionTrace:[record]}).records).toEqual([record]);expect(explainPopulationEntity({id:'p2'}).available).toBe(false);});
test('missing filter flags and count telemetry stay unavailable',()=>{for(const filter of ['movers','stressed','mode-switchers','displaced'])expect(populationBehaviorFilter({id:'p'},filter)).toBe(false);expect(populationCountRows({visibleAgents:[{}]})[0][1]).toBeUndefined();expect(populationCountRows({visibleAgents:[{}]})[4][1]).toBe(1);});

test('actual worker runtime produces paired changed trajectories without mutating live state',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');
 const runtime=createPopulationRuntime({config:{population:1000,seed:42},workerCount:1});
 try{await runtime.ready;const live=JSON.stringify(runtime.getSnapshot());const base=runtime.getSnapshot().config;
 const request=createPopulationExperiment(base,{leverA:'rentMultiplier',valueA:1.5,leverB:'transitService',valueB:2,runs:1,days:1});
 const result=await runPopulationStudioExperiment(runtime,request).ready;
 expect(result.status).toBe('completed');expect(result.rows.every(r=>r.status==='completed')).toBe(true);
 const series=populationComparisonSeries(result);expect(series).toHaveLength(3);expect(series.every(s=>s.rows.length>2&&s.rows.length<=64)).toBe(true);
 expect(series[1].rows.at(-1).metrics.meanHousingBurden).toBeGreaterThan(series[0].rows.at(-1).metrics.meanHousingBurden);
 expect(JSON.stringify(runtime.getSnapshot())).toBe(live);
 }finally{runtime.destroy();}
},20000);

test('largest designer request stays within actual engine agent-step budget',()=>{const request=createPopulationExperiment(config,{runs:6,days:14});expect(request.population*request.scenarios.length*request.runs*request.days*48).toBeLessThanOrEqual(20000000);});


test('actual validation rejection preserves reasons and yields no fabricated trajectories',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');
 const runtime=createPopulationRuntime({config:{population:1000,seed:42,targets:{population:999999}},workerCount:1});
 try{await runtime.ready;const request=createPopulationExperiment(runtime.getSnapshot().config,{runs:1,days:1});const result=await runPopulationStudioExperiment(runtime,request).ready;
 expect(result.status).toBe('failed');expect(result.rows).toHaveLength(3);expect(result.rows.every(r=>r.status==='failed'&&r.validation.gate.accepted===false)).toBe(true);expect(result.rows[0].validation.gate.reasons.length).toBeGreaterThan(0);expect(populationComparisonSeries(result).every(s=>s.rows.length===0)).toBe(true);
 }finally{runtime.destroy();}
},20000);


test('unchanged settings normalize defaults and key order while invalid or changed settings never skip',()=>{
 expect(populationConfigIsUnchanged(defaultPopulationConfig,config)).toBe(true);
 expect(populationConfigIsUnchanged({...config,provenance:{confidence:'low',type:'synthetic'}},config)).toBe(true);
 expect(populationConfigIsUnchanged({...config,rentMultiplier:1.5},config)).toBe(false);
 expect(populationConfigIsUnchanged({...config,rentMultiplier:NaN},config)).toBe(false);
 expect(populationConfigIsUnchanged({...config,events:[{type:'storm',startMinute:0,durationMinutes:60,magnitude:.5,recoveryMinutes:0}]},config)).toBe(false);
});

test('replacement futures settle cancellation and superseded queued requests never start',async()=>{
 const {createPopulationStudioRunner}=await import('../world/population/studio.js');let resolve,active=false,starts=0;
 const runner=createPopulationStudioRunner({},()=>{expect(active).toBe(false);active=true;starts++;return{ready:new Promise(r=>resolve=()=>{active=false;r(starts);}),cancel(){}};});
 const first=runner.run({});const second=runner.run({});const third=runner.run({});const rejected=second.catch(error=>error.message);expect(starts).toBe(1);resolve();expect(await first).toBe(1);expect(await rejected).toContain('superseded');await Promise.resolve();expect(starts).toBe(2);resolve();expect(await third).toBe(2);
});

test('paired curves exclude a seed rejected by any scenario',()=>{const row=(configIndex,seed,value,status='completed')=>({manifest:{configIndex,seed},status,summary:{timeSeries:[{minute:0,metrics:{value}}]}});const series=populationComparisonSeries({manifest:{configs:[{},{}]},rows:[row(0,1,10),row(0,2,1000),row(1,1,20),row(1,2,0,'failed')]});expect(series[0].rows[0].metrics.value).toBe(10);expect(series[1].rows[0].metrics.value).toBe(20);expect(series[0].label).toContain('1 common accepted seeds');});

test('explanations distinguish recorded reasons from constraints, planned travel and utility',async()=>{const {explainPopulationEntity}=await import('../world/population/copilot.js');const answer=explainPopulationEntity({id:'p1',commuteMinutes:12,experiencedTravelMinutes:18,satisfaction:.7,constraints:{vehicle:false},decisionTrace:[{reasonCodes:['PRICE'],chosen:'walk'}],currentAlternatives:{type:'inspect-only',alternatives:[]}});expect(answer.records[0].reasonCodes).toEqual(['PRICE']);expect(answer.sections.find(s=>s.label.startsWith('Planned')).data.commuteMinutes).toBe(12);expect(answer.sections.find(s=>s.label.startsWith('Experienced')).data.experiencedTravelMinutes).toBe(18);expect(answer.sections.some(s=>s.label.startsWith('Activity satisfaction'))).toBe(false);expect(answer.sections.find(s=>s.label.startsWith('Modeled utility')).data.satisfaction).toBe(.7);});
