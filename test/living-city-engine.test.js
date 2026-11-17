import {test,expect} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {createEngine,addIntervention,scheduleShock} from '../world/city/engine.js';

test('resident identity, ties, goals and memories survive a year and checkpoint restart',()=>{
  const engine=createEngine(),initial=createCity({households:12});
  const first=engine.run(initial,6);
  const checkpoint=JSON.parse(JSON.stringify(first.state));
  const resumed=engine.run(checkpoint,6),whole=engine.run(initial,12);
  expect(resumed.state).toEqual(whole.state);
  for(const r of whole.state.residents.filter(r=>r.sinceMonth===0)){
    expect(r.memories).toHaveLength(12);
    expect(r.relationships.length).toBeGreaterThan(0);
    expect(r.goals).toHaveLength(2);
    expect(r.memories[0].eventId).toBeTruthy();
  }
  expect(initial.residents).toBeUndefined();
});

test('business demand closes loss-making firms and permits new firms',()=>{
  let city=createCity({households:60});
  city.businesses[0].operatingCost=1e9;
  const run=createEngine().run(city,12),events=run.steps.flatMap(s=>s.events);
  expect(events.some(e=>e.eventType==='BUSINESS_CLOSED'&&e.payload.businessId==='business-d0')).toBe(true);
  expect(events.some(e=>e.eventType==='BUSINESS_OPENED')).toBe(true);
  for(const event of events)expect(event.payload.rule.evidenceType).toBe('synthetic-assumption');
});

test('policy leaves lasting buildings with recorded causes and resident housing state',()=>{
  const city=createCity({households:9});city.parcels.forEach(p=>p.capacity=0);
  for(const u of city.utilities)u.capacity=1000;
  const engine=createEngine(),baseline=engine.run(city,24);
  const plan=engine.run(addIntervention(city,{type:'housing',districtId:'d0',amount:10,cost:100,delay:0}),24);
  expect(plan.state.units.length).toBeGreaterThan(baseline.state.units.length);
  const changes=plan.steps.flatMap(s=>s.events).filter(e=>e.eventType==='BUILDING_CHANGED');
  expect(changes.length).toBeGreaterThan(0);
  for(const change of changes){
    const step=plan.steps[change.simulationTime-1];
    expect(change.payload.causes.length).toBeGreaterThan(0);
    for(const id of change.payload.causes)expect(step.events.some(e=>e.id===id&&e.eventType==='PROJECT_COMPLETE')).toBe(true);
    expect(plan.state.buildings.some(b=>b.id===change.payload.buildingId)).toBe(true);
  }
  expect(plan.state.residents.every(r=>r.memories.length>=1)).toBe(true);
});

test('displacement changes resident needs with event dependencies',()=>{
  const initial=createCity({households:9});initial.districts.forEach(d=>d.floodRisk=1);initial.parcels.forEach(p=>p.capacity=0);
  let city=initial;
  for(const d of city.districts)city=scheduleShock(city,{type:'flood',districtId:d.id,start:1,duration:2,severity:1});
  const step=createEngine().run(city,1).steps[0];
  expect(step.state.residents.some(r=>r.needs.housing===0)).toBe(true);
  expect(step.events.filter(e=>e.system==='residents').every(e=>e.payload.contextEventIds.some(id=>step.events.find(e=>e.id===id)?.eventType==='FLOOD_DAMAGE'))).toBe(true);
});

test('departed identity and history persist and malformed resident inputs fail atomically',()=>{
  const engine=createEngine(),saved=engine.run(createCity({households:9}),1).state;
  const resident=saved.residents[0],worker=saved.workers.find(w=>w.id===resident.workerId);
  if(worker.jobId)saved.jobs.find(j=>j.id===worker.jobId).workerId=null;
  saved.workers=saved.workers.filter(w=>w.id!==worker.id);
  resident.status='departed';resident.jobId=null;
  const next=engine.step(saved);
  expect(next.state.residents.find(r=>r.id===resident.id).status).toBe('departed');
  expect(next.state.residents.find(r=>r.id===resident.id).memories).toHaveLength(2);
  const invalid=structuredClone(next.state);invalid.residents[0].needs.social=NaN;
  expect(()=>engine.step(invalid)).toThrow('Invalid resident state');
  expect(next.state.month).toBe(2);
});

test('unexplained building changes reject the private draft',()=>{
  const city=createCity({households:3});
  const pack={id:'test-mutation',version:city.version,cadence:1,dependencies:[],initialize(){},proposeStep(){return {};},
    resolve(old,p,next){next.buildings[0].floors++;},commit(){},observe(){return [];}};
  expect(()=>createEngine([pack]).step(city)).toThrow('Building change without construction cause');
  expect(city.buildings[0].floors).toBe(1);
});
