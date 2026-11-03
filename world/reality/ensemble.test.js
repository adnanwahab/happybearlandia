import {test,expect} from 'bun:test';
import {createCity,createCityFromArea} from '../city/seed.js';
import {compileRealityProposal} from './compiler.js';
import {normalizeRealityRequest,executeRealityExperiment,replayRealityFuture} from './runtime-core.js';
import {ensembleRealityFutures,REALITY_CLOCK_ANCHOR} from './ensemble-core.js';
import {createRealityRuntime} from './runtime.js';
const cityRequest=(extra={})=>({program:compileRealityProposal('Build housing'),initial:createCity({households:4}),runs:3,months:2,seed:42,parameterUncertainty:[],...extra});

test('ensemble aggregates only actual completed paired worlds at one clock with stable IDs and exact unit/rent sums',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest(cityRequest())),before=structuredClone(result),progress=[];
 const ensemble=await ensembleRealityFutures(result,{month:1,onProgress:p=>progress.push(p)});const firstReplay=await replayRealityFuture(result,{runId:result.runs[0].runId,month:1});expect(firstReplay.clock).toEqual(ensemble.clock);
 expect(result).toEqual(before);expect(ensemble.completedFutures).toBe(3);expect(ensemble.runs.map(r=>r.runId)).toEqual(result.runs.map(r=>r.runId));expect(new Set(ensemble.runs.map(r=>r.seed)).size).toBe(3);expect(ensemble.clock).toEqual({time:1,unit:'month',anchor:REALITY_CLOCK_ANCHOR});expect(progress.at(-1).completed).toBe(3);expect(ensemble.interpretation).toContain('not empirical probabilities');expect(ensemble.records.every(r=>!('state'in r))).toBe(true);
 for(const record of ensemble.records)for(const arm of ['baseline','treatment']){let sum=0,rents=0,count=0;const statuses={};for(const source of result.runs){const pair=await replayRealityFuture(result,{runId:source.runId,month:1});const units=pair[arm].state.units.filter(u=>record.buildingIds.includes(u.buildingId));sum+=units.length;for(const unit of units){rents+=unit.rent;count++;statuses[unit.status]=(statuses[unit.status]??0)+1;}}expect(record[arm].units.sum).toBe(sum);expect(record[arm].units.mean).toBe(sum/3);expect(record[arm].rent.mean).toBe(count?rents/count:null);expect(record[arm].currentStateCounts).toEqual(statuses);expect(record[arm].contributingRunIndices).toEqual([0,1,2]);expect(record[arm].presenceFrequency).toBe(1);}
});

test('source footprints retain exact supplied geometry; absent geometry never acquires a fictional anchor',async()=>{
 const initial=createCityFromArea({source:'osm',origin:{lat:35,lng:139},buildings:[{id:'actual-1',pts:[[0,0],[.001,0],[.001,.001],[0,0]]}]},{households:2});
 const result=await executeRealityExperiment(normalizeRealityRequest(cityRequest({initial,runs:1,months:1}))),snapshot=await ensembleRealityFutures(result,{month:0});
 const row=snapshot.records.find(r=>r.sourceId==='actual-1');expect(row.id).toBe('source:actual-1');expect(row.geometry).toEqual(initial.buildings[0].geometry);expect(row.buildingIds).toEqual([initial.buildings[0].id]);expect(row.baseline.units.mean).toBe(initial.units.length);
 const synthetic=await ensembleRealityFutures(await executeRealityExperiment(normalizeRealityRequest(cityRequest({runs:1,months:1})))),unanchored=synthetic.records.filter(r=>!r.geometry&&!r.center);expect(unanchored.length).toBeGreaterThan(0);expect(synthetic.coverage.unlocatedBuildingObservations).toBeGreaterThan(0);
});

test('100 futures are unique actual seed replays; selection reports omitted rows and errors never inflate denominator',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest(cityRequest({initial:createCity({households:1}),runs:100,months:1}))),ensemble=await ensembleRealityFutures(result,{month:1});expect(ensemble.completedFutures).toBe(100);expect(new Set(ensemble.runs.map(r=>r.seed)).size).toBe(100);expect(new Set(ensemble.runs.map(r=>r.runId)).size).toBe(100);
 result.runs[0]={...result.runs[0],status:'error'};const subset=await ensembleRealityFutures(result,{month:0,maxFutures:2});expect(subset.completedFutures).toBe(2);expect(subset.availableCompletedFutures).toBe(99);expect(subset.omittedCompletedFutures).toBe(97);expect(subset.runs.map(r=>r.runIndex)).toEqual([1,2]);
},30000);

test('bad versions, clock units, duplicate identities, corrupted seed/grid and geometry/work budgets reject',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest(cityRequest({runs:1,months:1})));
 for(const selection of [{minute:1},{month:2},{month:1.5},{maxFutures:101},{maxGeometryRecords:1}])await expect(ensembleRealityFutures(result,selection)).rejects.toThrow();
 const duplicate=structuredClone(result);duplicate.runs.push(duplicate.runs[0]);await expect(ensembleRealityFutures(duplicate)).rejects.toThrow('unique');
 const seed=structuredClone(result);seed.runs[0].seed++;await expect(ensembleRealityFutures(seed)).rejects.toThrow('identity');
 const grid=structuredClone(result);grid.runs[0].assumptions.changed=1;await expect(ensembleRealityFutures(grid)).rejects.toThrow('grid');
 const old=structuredClone(result);old.manifest.modelVersion='old';await expect(ensembleRealityFutures(old)).rejects.toThrow('version');
});

test('cooperative cancellation returns no completed or fabricated partial ensemble',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest(cityRequest())),seen=[];let stop=false;await expect(ensembleRealityFutures(result,{shouldCancel:()=>stop,onProgress:p=>{seen.push(p.completed);if(p.completed===1)stop=true;}})).rejects.toMatchObject({name:'AbortError'});expect(seen).toEqual([0,1]);
});

test('population ensemble uses actual onsite locations and activities without inventing units or rent',async()=>{
 const result=await executeRealityExperiment(normalizeRealityRequest({program:compileRealityProposal('Make public transit free'),populationConfig:{population:8},runs:2,minutes:15,parameterUncertainty:[],worldContext:{buildings:[{id:'home',kind:'home',center:[0,0]},{id:'work',kind:'work',center:[10,0]}]}}));
 const ensemble=await ensembleRealityFutures(result,{minute:0});expect(ensemble.engine).toBe('population');expect(ensemble.clock.time).toBe(0);expect(ensemble.records.every(r=>r.baseline.units===null&&r.baseline.rent.mean===null)).toBe(true);expect(ensemble.records.reduce((sum,r)=>sum+Object.values(r.baseline.currentStateCounts).reduce((a,b)=>a+b,0),0)+ensemble.coverage.unlocatedPeopleObservations/2).toBe(16);
});

test('worker API returns only aggregated snapshot and supports abort',async()=>{
 const runtime=createRealityRuntime();try{const result=await runtime.run(cityRequest({runs:2,months:1}));const snapshot=await runtime.ensemble({result,month:0});expect(snapshot.completedFutures).toBe(2);expect(snapshot.runs).toHaveLength(2);expect(snapshot.records[0].baseline.state).toBeUndefined();const abort=new AbortController();abort.abort();await expect(runtime.ensemble({result,signal:abort.signal})).rejects.toMatchObject({name:'AbortError'});const runningAbort=new AbortController();await expect(runtime.ensemble({result,signal:runningAbort.signal,onProgress:p=>{if(p.completed===1)runningAbort.abort();}})).rejects.toMatchObject({name:'AbortError'});}finally{runtime.destroy();}
});
