import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CityStore} from '../world/city/storage.js';
import {createCityApi} from '../world/city/api.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {createExperiment,loadExperiment,initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {stateHash} from '../world/future-machine/data/core.js';
import {compareHistory} from '../world/future-machine/diff/index.js';
function replay(initial,policy){let state=policy?addIntervention(initial,policy):structuredClone(initial);const steps=[],engine=createEngine();for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return {steps};}
function manifest(recipe=DEFAULT_RECIPE){return {version:recipe.modelVersion,months:120,runs:1,initial:initialForRecipe(recipe),modelManifest:createEngine().manifest,scenarios:[{id:'baseline',interventions:[]},{id:'plan',interventions:recipe.intervention?[recipe.intervention]:[]}]};}
function response(m,path,options){return Response.json(path.endsWith('/replay')?{...replay(m.initial,JSON.parse(options.body).scenarioId==='plan'?m.scenarios[1].interventions[0]:null),identity:{experimentId:'city_boundary',scenarioId:JSON.parse(options.body).scenarioId,runIndex:0,runId:JSON.parse(options.body).scenarioId+'-0'}}:{id:'city_boundary',status:'complete',manifest:m});}
for(const seed of [0,4294967295])test(`persisted boundary seed ${seed} retains exact horizon and original`,async()=>{
 const root=mkdtempSync(join(tmpdir(),'fm-boundary-')),store=new CityStore(root),handle=createCityApi({store}),realFetch=globalThis.fetch;globalThis.fetch=(path,options)=>handle(new Request(`http://localhost${path}`,options));
 try{const recipe={...DEFAULT_RECIPE,seed},initial=initialForRecipe(recipe),initialHash=await stateHash(initial),pair=await createExperiment(recipe),reopened=await loadExperiment(pair.experimentId);
 expect(reopened).toEqual(pair);expect(pair.initialHash).toBe(initialHash);expect(await stateHash(initial)).toBe(initialHash);expect(pair.baseline).toHaveLength(121);expect(pair.plan).toHaveLength(121);expect(pair.baseline.map(s=>s.month)).toEqual(Array.from({length:121},(_,i)=>i));expect(pair.plan.map(s=>s.month)).toEqual(pair.baseline.map(s=>s.month));expect(pair.baseline[0].state).toEqual(pair.plan[0].state);expect(Object.isFrozen(pair.baseline[0].state.households[0])).toBe(true);expect(pair.baseline.every(s=>s.state.seed===seed)).toBe(true);expect(pair.plan.every(s=>s.state.seed===seed)).toBe(true);
 const baselineHash=await stateHash(pair.baseline),diffs=compareHistory(pair);expect(await stateHash(normalizeReplay(initial,replay(initial)).map(snapshot=>({...snapshot,identity:pair.baseline[0].identity})))).toBe(baselineHash);expect(await stateHash(pair.baseline)).toBe(baselineHash);console.log(JSON.stringify({seed,initialHash,baselineHash,firstPhysicalMonth:diffs.find(d=>d.physicalCount)?.month??null,homes:diffs[120].metrics.housingUnits,capital:diffs[120].metrics.capitalSpending,travel:diffs[120].metrics.meanTravelMinutes}));
 }finally{globalThis.fetch=realFetch;store.close();rmSync(root,{recursive:true,force:true});}
},15000);
test('reject stale saved identity and stale creation recipe before replay',async()=>{
 const realFetch=globalThis.fetch;try{let replays=0;globalThis.fetch=async(path)=>{if(path.endsWith('/replay'))replays++;return Response.json({id:'city_wrong',status:'complete',manifest:manifest()});};await expect(loadExperiment('city_boundary')).rejects.toThrow('identity');expect(replays).toBe(0);
 globalThis.fetch=async(path)=>{if(path==='/api/city-experiments')return Response.json({id:'city_boundary'});if(path.endsWith('/replay'))replays++;return Response.json({id:'city_boundary',status:'complete',manifest:manifest({...DEFAULT_RECIPE,seed:1})});};await expect(createExperiment()).rejects.toThrow('requested recipe');expect(replays).toBe(0);
 }finally{globalThis.fetch=realFetch;}
});
test('bad saved generator, versions and mismatched replay states fail explicitly',async()=>{
 const realFetch=globalThis.fetch;try{for(const change of [m=>m.initial.parameters.annualGrowth=0.01,m=>m.modelManifest[0].version='old',m=>m.months=119]){const m=manifest();change(m);globalThis.fetch=async(path,options)=>response(m,path,options);await expect(loadExperiment('city_boundary')).rejects.toThrow();}
 const initial=initialForRecipe();for(const change of [r=>r.steps.pop(),r=>r.steps.push(r.steps.at(-1)),r=>r.steps[3].state.seed=0,r=>r.steps[3].state.month=5,r=>r.steps[3].state.version='old']){const r=replay(initial);change(r);expect(()=>normalizeReplay(initial,r)).toThrow();}
 }finally{globalThis.fetch=realFetch;}
});
test('abort polling or delayed replay cannot leak stale results into retry',async()=>{
 const realFetch=globalThis.fetch,m=manifest();try{const polling=new AbortController();let requests=0;globalThis.fetch=async()=>{requests++;return Response.json({id:'city_boundary',status:'running',completed:0});};await expect(loadExperiment('city_boundary',{signal:polling.signal,onProgress:()=>polling.abort()})).rejects.toThrow('cancelled');expect(requests).toBe(1);
 const abort=new AbortController();let release,started;const entered=new Promise(resolve=>started=resolve);globalThis.fetch=async(path,options)=>{if(path.endsWith('/replay')){started();await new Promise(resolve=>release=resolve);}return response(m,path,options);};const stale=loadExperiment('city_boundary',{signal:abort.signal});await entered;abort.abort();globalThis.fetch=async(path,options)=>response(m,path,options);const retry=await loadExperiment('city_boundary');release();await expect(stale).rejects.toThrow('cancelled');expect(retry.seed).toBe(42);expect(retry.plan[120].metrics.housingUnits-retry.baseline[120].metrics.housingUnits).toBe(24);
 }finally{globalThis.fetch=realFetch;}
});
