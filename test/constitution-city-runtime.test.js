import {test,expect} from 'bun:test';
import snapshot from '../world/constitution-city/dear-congress-plan.json';
import {normalizeDearCongressPlan} from '../world/constitution-city/plan.js';
import {createCity} from '../world/city/seed.js';
import {cityMetrics} from '../world/city/engine.js';
import {normalizeConstitutionRequest,executeConstitutionExperiment,simulateConstitutionCity,replayConstitutionFuture} from '../world/constitution-city/runtime-core.js';
import {createConstitutionRuntime} from '../world/constitution-city/runtime.js';
const plan=normalizeDearCongressPlan(snapshot);
const scenarios=[{id:'current',label:'Current',clauseIds:[]},{id:'proposal',label:'Proposal',clauseIds:['h_lots','f_drainage','t_brt']}];
const manifest=(options={})=>normalizeConstitutionRequest({initial:createCity({households:3}),plan,scenarios,runs:1,months:12,seed:42,...options});
test('paired seeds, frozen input and exact month0/360 replay',async()=>{
 const initial=createCity({households:3}),before=structuredClone(initial),m=manifest({initial,months:360});
 const result=await executeConstitutionExperiment(m);
 expect(result.runs.every(row=>row.status==='completed')).toBe(true);
 expect(result.runs[0].seed).toBe(result.runs[1].seed);
 expect(result.runs[0].metricsTimeline.length).toBe(361);
 expect(initial).toEqual(before);
 const zero=await replayConstitutionFuture(result,{runId:'current_0001',month:0});
 expect(cityMetrics(zero.state)).toEqual(result.runs[0].metricsTimeline[0].metrics);
 const future=await replayConstitutionFuture(result,{runId:'proposal_0001',month:360});
 expect(cityMetrics(future.state)).toEqual(result.runs[1].metricsTimeline[360].metrics);
 expect(cityMetrics(future.baselineState)).toEqual(result.runs[0].metricsTimeline[360].metrics);
 expect(result.runs[1].state).toBeUndefined();
},20000);
test('2/5/10 year sunsets reverse measured legal increments while keeping infrastructure and sunk expense',async()=>{
 for(const years of [5,10]){
  const m=manifest({months:years*12,scenarios:[{...scenarios[1],sunsetYears:years}]});
  const before=await simulateConstitutionCity(m,m.scenarios[0],42,{throughMonth:years*12-1,retainState:true});
  const after=await simulateConstitutionCity(m,m.scenarios[0],42,{retainState:true});
  expect(after.state.policies.length).toBe(0);
  expect(after.state.constitutionRuntime.expiredAtMonth).toBe(years*12);
  for(const parcel of after.state.parcels)expect(parcel.capacity).toBe(m.initial.parcels.find(p=>p.id===parcel.id).capacity);
  expect(after.state.finance.capitalExpense).toBe(before.state.finance.capitalExpense);
  expect(after.state.units.length).toBeGreaterThanOrEqual(before.state.units.length);
  expect(after.state.projects.length).toBeGreaterThanOrEqual(before.state.projects.length);
 }
},20000);
test('1000 actual short futures and honest workload bounds',async()=>{
 const m=manifest({runs:1000,months:1,scenarios:[scenarios[0]]});const r=await executeConstitutionExperiment(m);
 expect(r.runs.length).toBe(1000);expect(new Set(r.runs.map(row=>row.seed)).size).toBe(1000);
 expect(r.runs.every(row=>row.metricsTimeline.length===2&&row.status==='completed')).toBe(true);
 expect(()=>manifest({runs:1000,months:360})).toThrow('safe budget');
},20000);
test('real worker execution, partial cancellation, replay supersession and disposal',async()=>{
 const runtime=createConstitutionRuntime({initial:createCity({households:3}),plan});
 try{
  const result=await runtime.run({scenarios,runs:1,months:12});expect(result.runs.length).toBe(2);
  const stale=runtime.enterFuture({runId:'current_0001',month:12}).catch(error=>error);
  const fresh=await runtime.enterFuture({runId:'proposal_0001',month:0});expect(fresh.month).toBe(0);expect((await stale).name).toBe('AbortError');
  const partial=await runtime.run({scenarios,runs:100,months:12,onProgress:p=>{if(p.completed>0)runtime.cancel();}});
  expect(partial.status).toBe('cancelled');expect(partial.runs.length).toBeLessThan(200);
 }finally{runtime.destroy();}
 await expect(runtime.enterFuture({runId:'current_0001',month:0})).rejects.toThrow();
},20000);
test('sunset stops delayed authorizations without changing pre-existing legal policy',async()=>{
 const initial=createCity({households:3});
 initial.policies.push({id:'existing-upzone',type:'upzone',districtId:'d0',amount:17,cost:0,compliance:1,delay:0,stage:'PROPOSED'});
 const m=manifest({initial,months:60,scenarios:[{...scenarios[1],delayMonths:90,sunsetYears:5}]});
 const result=await simulateConstitutionCity(m,m.scenarios[0],42,{retainState:true});
 expect(result.state.policies.map(p=>p.id)).toEqual(['existing-upzone']);
 expect(result.state.parcels[0].capacity).toBe(initial.parcels[0].capacity+17);
 expect(result.state.finance.capitalExpense).toBe(0);
 expect(result.state.projects.some(p=>p.policyId&&p.policyId!=='existing-upzone')).toBe(false);
});
test('new runs invalidate in-flight catalogs and version mismatch cannot reinterpret replay',async()=>{
 const runtime=createConstitutionRuntime({initial:createCity({households:3}),plan});
 try{
  const old=runtime.run({scenarios,runs:100,months:12}).catch(error=>error);
  const fresh=await runtime.run({scenarios,runs:1,months:0,seed:77});
  expect((await old).name).toBe('AbortError');expect(fresh.manifest.seed).toBe(77);
  const forged=structuredClone(fresh);forged.manifest.modelVersion='missing-model';
  await expect(replayConstitutionFuture(forged,{runId:'current_0001',month:0})).rejects.toThrow('unavailable');
 }finally{runtime.destroy();}
});
