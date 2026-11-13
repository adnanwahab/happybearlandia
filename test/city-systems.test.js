import {describe,test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCity,createCityFromArea} from '../world/city/seed.js';
import {createEngine,addIntervention,scheduleShock,cityMetrics} from '../world/city/engine.js';
import {createSystemPacks} from '../world/city/systems.js';
import {CapacityRegistry,validateState} from '../world/city/contracts.js';
import {CityStore,queryDatabase,validateReadQuery} from '../world/city/storage.js';
import {createCityApi,normalizeExperiment} from '../world/city/api.js';
const temp=()=>mkdtempSync(join(tmpdir(),'hbl-city-test-'));
describe('Coupled city clock',()=>{
 test('all thirteen packs replay exactly, independent of registration order',()=>{
   const initial=createCity({households:30}),forward=createEngine(),reverse=createEngine(createSystemPacks().reverse());
   const a=forward.run(initial,24),b=reverse.run(initial,24);
   expect(a).toEqual(b);expect(initial.month).toBe(0);expect(a.state.month).toBe(24);expect(Object.keys(a.state.systems)).toHaveLength(13);
   expect(a.steps[11].events.some(e=>e.eventType==='ANNUAL_POPULATION_UPDATE')).toBe(true);
   for(const step of a.steps)expect(validateState(step.state)).toBe(true);
 });
 test('atomic reservations never consume partial resources',()=>{
   const r=new CapacityRegistry();for(const resource of ['water','sewer'])r.register({resource,time:1,capacity:10});
   expect(r.reserveAll([{resource:'water',time:1,amount:8},{resource:'sewer',time:1,amount:11}])).toBe(false);
   expect(r.query({resource:'water',time:1}).available).toBe(10);
   expect(()=>r.reserve({resource:'water',time:1},-1)).toThrow();
 });
 test('housing conflicts have one winner and record unsuccessful search alternatives',()=>{
   const s=createCity({households:3});s.parcels.forEach(p=>p.capacity=0);
   for(const u of s.units){u.householdId=null;u.status='under construction';}
   for(const h of s.households){h.unitId=null;h.income=10000;h.otherIncome=10000;h.bedrooms=1;}
   s.units[0].status='available';s.units[0].bedrooms=3;
   const step=createEngine().step(s);
   expect(step.state.units.filter(u=>u.householdId)).toHaveLength(1);
   expect(step.decisions.filter(d=>d.decisionType==='housing-search')).toHaveLength(2);
   expect(step.decisions.find(d=>d.decisionType==='housing-search').primaryReason).toBe('application lost');
 });
 test('funding is constrained and policy changes do not create instant homes',()=>{
   let s=createCity({households:9});const count=s.units.length;s.finance.balance=0;
   s=addIntervention(s,{type:'housing',districtId:'d0',amount:5000,cost:1e10});
   const result=createEngine().run(s,6);
   expect(result.state.units.length).toBe(count);expect(result.steps.flatMap(s=>s.events).some(e=>e.eventType==='CAPITAL_PROJECT_DELAYED')).toBe(true);
   expect(result.state.policies[0].stage).toBe('APPROVED');
 });
 test('utility headroom blocks completion; all required upgrades unlock construction',()=>{
   const base=createCity({households:9});base.parcels.forEach(p=>p.capacity=0);
   base.projects.push({id:'test-project',districtId:'d0',type:'housing',stage:'construction',units:20,amount:20,duration:1,progress:0,cost:100,costOverrun:0,displacedUnits:[],displacedBusinesses:[]});
   const blocked=createEngine().step(base);expect(blocked.state.projects[0].stage).toBe('construction');expect(blocked.events.some(e=>e.payload.reason==='utility capacity')).toBe(true);
   const expanded=structuredClone(base);for(const u of expanded.utilities)u.capacity+=100;
   const complete=createEngine().step(expanded);expect(complete.state.projects[0].stage).toBe('completion');expect(complete.state.units.length).toBe(base.units.length+20);
 });
 test('large projects progress gradually under limited labor instead of stalling forever',()=>{
   const s=createCity({households:9});s.parcels.forEach(p=>p.capacity=0);s.parameters.labor=2;
   for(const u of s.utilities)u.capacity=1000;
   s.projects.push({id:'large',districtId:'d0',type:'housing',units:20,amount:20,stage:'construction',progress:0,duration:1,cost:100,costOverrun:0,displacedUnits:[],displacedBusinesses:[]});
   const engine=createEngine(),first=engine.step(s);expect(first.state.projects[0].progress).toBeCloseTo(.1);
   const last=engine.run(s,10);expect(last.state.projects[0].stage).toBe('completion');
 });
 test('flood damage displaces households and utility capacity recovers',()=>{
   let s=createCity({households:30});s.parcels.forEach(p=>p.capacity=0);s.districts[1].floodRisk=1;
   s=scheduleShock(s,{type:'flood',districtId:'d1',start:1,duration:2,severity:1});
   const r=createEngine().run(s,6);
   expect(r.steps[0].events.some(e=>e.eventType==='FLOOD_DAMAGE'&&e.payload.units>0)).toBe(true);
   const during=r.steps[0].state.utilities.find(u=>u.districtId==='d1');const after=r.steps[3].state.utilities.find(u=>u.id===during.id);
   expect(during.effectiveCapacity).toBeLessThan(after.effectiveCapacity);expect(r.state.units.some(u=>u.status==='under renovation')).toBe(false);
 });
 test('network loads produce congestion and denied boarding with unreachable route handling',()=>{
   const s=createCity({households:12});s.parcels.forEach(p=>p.capacity=0);
   for(const l of s.links){l.capacity=1;if(l.mode==='road')l.freeTime=100;else l.freeTime=1;}
   s.workers.forEach((w,i)=>{const job=s.jobs.find(j=>j.districtId!==w.districtId&&!j.workerId);if(job){w.jobId=job.id;job.workerId=w.id;}});
   const step=createEngine().step(s);
   expect(step.events.some(e=>e.eventType==='DENIED_BOARDING')).toBe(true);
   expect(step.trips.some(t=>t.delayMinutes>0)).toBe(true);
 });
 test('OSM import preserves geometry and labels inferred inventory',()=>{
   const s=createCityFromArea({source:'osm',origin:{lat:29,lng:-95},radiusM:400,buildings:[{id:'w1',pts:[[29,-95],[29.001,-95],[29,-95.001]],levels:2}]},{households:9});
   expect(s.buildings[0].geometry.coordinates[0][0]).toEqual([-95,29]);expect(s.provenance.type).toBe('mixed-evidence');expect(s.parcels[0].source).toBe('synthetic-footprint-proxy');expect(validateState(s)).toBe(true);
 });
 test('invalid state and inputs are rejected',()=>{
   const s=createCity({households:3});s.units[0].rent=Infinity;expect(()=>validateState(s)).toThrow();
   expect(()=>normalizeExperiment({runs:1001})).toThrow();expect(()=>normalizeExperiment({retention:'full',runs:10})).toThrow();
   expect(()=>scheduleShock(createCity(),{type:'flood',start:0})).toThrow();
   expect(()=>createEngine([{id:'bad',dependencies:['missing']}])).toThrow();
 });
});
describe('SQLite evidence and analytics',()=>{
 test('transactional persistence, retention and read-only SQL',async()=>{
   const root=temp(),store=new CityStore(root);
   try {
     const manifest=normalizeExperiment({city:{households:9},runs:1,months:2,retention:'full'}),id='city_test';store.create(id,manifest);store.saveWorld(id,manifest.initial);
     const result=createEngine().run(manifest.initial,2);
     await store.saveRun(id,{runId:'baseline-0',scenarioId:'baseline',index:0,seed:42,metrics:cityMetrics(result.state),steps:result.steps,durationMs:1,retention:'full',manifest:result.manifest});
     expect(queryDatabase(store.path(id),'SELECT COUNT(*) AS n FROM runs').rows[0].n).toBe(1);
     expect(queryDatabase(store.path(id),'SELECT * FROM decisions').rows.length).toBeGreaterThan(0);
     expect(queryDatabase(store.path(id),'SELECT * FROM municipal_finance').rows).toHaveLength(2);
     const replay=createEngine().run(manifest.initial,2);expect(replay.state).toEqual(result.state);
     for(const sql of ['DELETE FROM runs','WITH x AS (SELECT 1) DELETE FROM runs','SELECT 1; DROP TABLE runs','PRAGMA writable_schema=ON',"SELECT load_extension('evil')",'ATTACH DATABASE x AS y'])expect(()=>validateReadQuery(sql)).toThrow();
     expect(queryDatabase(store.path(id),'WITH x AS (SELECT 1 AS n) SELECT n FROM x').rows[0].n).toBe(1);
     expect(store.export(id).subarray(0,15).toString()).toBe('SQLite format 3');
     expect(store.tables(id).some(t=>t.name==='utility_state')).toBe(true);
     const summaryId='city_summary';store.create(summaryId,manifest);
     await store.saveRun(summaryId,{runId:'baseline-0',scenarioId:'baseline',index:0,seed:42,metrics:cityMetrics(result.state),steps:result.steps,durationMs:1,retention:'summary',manifest:result.manifest});
     expect(queryDatabase(store.path(summaryId),'SELECT COUNT(*) AS n FROM decisions').rows[0].n).toBe(0);
     expect(queryDatabase(store.path(summaryId),'SELECT COUNT(*) AS n FROM observations').rows[0].n).toBeGreaterThan(0);
   }finally{store.close();rmSync(root,{recursive:true,force:true});}
 });
 test('API creates, polls, queries, exports, and exactly replays a future',async()=>{
   const root=temp(),store=new CityStore(root),handle=createCityApi({store});
   const call=(path,body)=>handle(new Request(`http://localhost${path}`,body===undefined?{}:{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'}}));
   try {
     const response=await call('/api/city-experiments',{city:{households:9},runs:1,months:12,retention:'analysis'});expect(response.status).toBe(202);const {id}=await response.json();
     let record;for(let i=0;i<100;i++){record=await (await call(`/api/city-experiments/${id}`)).json();if(!['queued','running'].includes(record.status))break;await new Promise(r=>setTimeout(r,20));}
     expect(record.error).toBeNull();expect(record.status).toBe('complete');expect(record.completed).toBe(2);
     const replay=await (await call(`/api/experiments/${id}/replay`,{runIndex:0,scenarioId:'baseline'})).json();
     expect(replay.state.residents[0].memories).toHaveLength(12);
     expect(replay.steps[11].events.some(e=>e.eventType==='RESIDENT_MONTH')).toBe(true);
     expect(replay.metrics).toEqual(cityMetrics(createEngine().run(record.manifest.initial,12).state));
     const query=await call(`/api/experiments/${id}/query`,{sql:'UPDATE runs SET seed=0'});expect(query.status).toBe(400);
     const data=await (await call(`/api/experiments/${id}/query`,{sql:'SELECT * FROM run_metrics'})).json();expect(data.rows.length).toBeGreaterThan(0);
     const timeout=await call(`/api/experiments/${id}/query`,{sql:'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT SUM(x) FROM n'});expect(timeout.status).toBe(400);expect((await timeout.json()).error).toContain('time limit');
     expect((await call(`/api/experiments/${id}/export`)).headers.get('content-type')).toBe('application/vnd.sqlite3');
     expect((await (await call(`/api/experiments/${id}/brief`)).text())).toContain('Scenario | Metric');
   }finally{store.close();rmSync(root,{recursive:true,force:true});}
 });
});
