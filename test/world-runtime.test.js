import {test,expect} from 'bun:test';
import {createWorldRuntime,restoreWorldRuntime,WORLD_RUNTIME_VERSION} from '../world/runtime/world-runtime.js';
import {createPopulationModel,stepPopulation,serializePopulation} from '../world/population/model.js';
import {createWorldHistoryStore} from '../world/runtime/history-store.js';
const worldContext={buildings:Array.from({length:12},(_,i)=>({id:`b${i}`,center:[i*180,i%3*200]}))};
const config={seed:42,culture:false,weather:false,population:{population:80},worldContext};
test('6am starts without overnight transitions; one population/economy authority and detached views',()=>{
 const r=createWorldRuntime(config),s=r.snapshot({visibleLimit:3});
 expect(s.version).toBe('world-v2');expect(s.clock.minute).toBe(360);expect(s.clock.elapsedMinutes).toBe(0);
 expect(s.population.minute).toBe(s.clock.minute);expect(s.population.timeSeries.map(p=>p.minute)).toEqual([360]);
 expect(s.population.history.coverage.fromMinute).toBeNull();expect(r.economy.day).toBe(0);expect(r.economy.totalRevenue).toBe(0);
 expect(r.economy).toBe(r.population.economy);expect(r.parameters.walkingSpeedKmh).toBe(2.4);
 expect(s.ownership.integrationMode).toBe('shadow');expect(s.ownership.legacyWrites).toBe(false);expect(s.ownership.parityGatePassed).toBe(false);
 expect(s.provenance.initialization.overnightBurnIn).toBe(false);expect(s.population.visibleAgents.length).toBe(3);
 expect(Object.isFrozen(s)).toBe(true);expect(Object.isFrozen(s.population.visibleAgents[0])).toBe(true);
 expect(()=>{s.economy.businesses[0].cash=0;}).toThrow();expect(r.economy.businesses[0].cash).toBeGreaterThan(0);
 r.destroy();
});
test('runtime advances exactly the existing population engine, including one daily economy advance',()=>{
 const r=createWorldRuntime(config),m=createPopulationModel({population:80,seed:42},worldContext);
 m.minute=360;m.lastDay=0;m.economy.day=0;m.timeSeries=[{tick:0,minute:360,...structuredClone(m.metrics)}];
 for(const selected of Object.values(m.activityHistory.selected))selected.trackingStartedMinute=360;
 r.step(1440,{visibleLimit:0});for(let minute=360;minute<1800;minute+=15)stepPopulation(m,{minutes:15});
 expect(serializePopulation(r.population)).toEqual(serializePopulation(m));
 expect(r.clock.minute).toBe(1800);expect(r.economy.day).toBe(1);expect(r.observe().businessRevenue).toBe(m.economy.totalRevenue);
 const cursor=r.eventsSince().cursor;r.snapshot();r.observe();r.snapshot();expect(r.eventsSince().cursor).toBe(cursor);
 r.destroy();
});
test('same seed and serialized continuation preserve residents, firms, policy, clocks and event cursor',()=>{
 const a=createWorldRuntime(config),b=createWorldRuntime(config);
 a.step(480,{visibleLimit:0});b.step(480,{visibleLimit:0});expect(a.serialize()).toEqual(b.serialize());
 a.applyScenario({id:'bus',parameters:{transitService:2,transitCapacity:900}});
 const saved=a.serialize(),restored=restoreWorldRuntime(saved);
 a.step(720,{visibleLimit:0});restored.step(720,{visibleLimit:0});expect(restored.serialize()).toEqual(a.serialize());
 const changed=createWorldRuntime({...config,seed:43});expect(changed.population.prefix).not.toBe(a.population.prefix);
 saved.core.population.people.x[0]=99999;expect(restored.population.people.x[0]).not.toBe(99999);
 for(const r of[a,b,restored,changed])r.destroy();
});
test('policies validate parameter inputs, preserve walking speed and cannot offset metrics or regenerate demographics',()=>{
 const r=createWorldRuntime(config),initial=r.observe();
 r.applyScenario({id:'better-bus',label:'Service input',parameters:{transitService:2,transitFare:1}});
 expect(r.observe().meanCommuteMinutes).toBe(initial.meanCommuteMinutes);expect(r.parameters.transitService).toBe(2);expect(r.parameters.walkingSpeedKmh).toBe(2.4);
 expect(r.eventsSince().events.at(-1).type).toBe('POLICY_ADOPTED');
 for(const patch of[{meanCommuteMinutes:-8},{population:100},{seed:7},{representedPopulation:10000},{initialBufferMonths:10},{transitService:-1},{events:[{type:'fake'}]}])expect(()=>r.applyScenario(patch)).toThrow();
 r.step(1440,{visibleLimit:0});expect(r.snapshot({visibleLimit:0}).policy.parameters.transitService).toBe(2);r.destroy();
});
test('inspections use existing residents/households/firms; pause and subscriptions share the model clock',()=>{
 const r=createWorldRuntime(config),person=r.inspectPerson(0),household=r.inspectHousehold(person.householdId),business=r.inspectBusiness(0);
 expect(household.members).toContain(person.id);expect(business.id).toBe(r.economy.businesses[0].id);expect(r.inspectBusiness('missing')).toBeNull();
 expect(r.inspectPerson('missing')).toBeNull();expect(r.inspectHousehold('missing')).toBeNull();
 const received=[],unsubscribe=r.subscribe(s=>received.push(s.clock.minute));r.pause();r.step(15);expect(r.clock.minute).toBe(360);r.resume();r.step(15);expect(received).toEqual([360,360,375]);
 unsubscribe();r.step(15);expect(received.length).toBe(3);expect(r.clock.minute).toBe(r.population.minute);r.destroy();expect(()=>r.step(1)).toThrow('destroyed');
});
test('bounded history discloses source loss and retention; source events are ingested once',()=>{
 const r=createWorldRuntime({...config,population:{population:300,maxLogEntries:10},history:{maxEvents:5,maxCheckpoints:2,maxMetricRows:3}});
 for(let i=0;i<3;i++)r.step(1440,{visibleLimit:0});
 const result=r.eventsSince();expect(result.events.length).toBeLessThanOrEqual(5);expect(result.retention.droppedEvents).toBeGreaterThan(0);expect(result.retention.sourceDroppedEvents).toBeGreaterThan(0);
 expect(result.truncated).toBe(true);expect(result.retention.checkpoints.length).toBe(2);expect(result.retention.droppedCheckpoints).toBe(2);expect(result.retention.metricRows).toBe(3);
 expect(r.eventsSince(result.cursor).events).toEqual([]);expect(new Set(result.events.map(e=>e.id)).size).toBe(result.events.length);
 const state=r.serialize(),restored=restoreWorldRuntime(state);expect(restored.eventsSince()).toEqual(result);r.destroy();restored.destroy();
});
test('registered subsystems get their own state and readonly inputs; duplicate domain authority is rejected',()=>{
 const system={id:'test-infrastructure',version:'1',owns:['infrastructure'],initialize:()=>({minutes:0}),step(state,ctx){state.minutes+=ctx.minutes;expect(Object.isFrozen(ctx.metrics)).toBe(true);ctx.emit({type:'INFRASTRUCTURE_OBSERVED',reasonCodes:['TEST_ACTUAL_STEP']});},observe:state=>({...state}),serialize:state=>({...state}),restore:state=>({...state})};
 const r=createWorldRuntime({...config,subsystems:[system]});r.step(30,{visibleLimit:0});
 expect(r.snapshot({visibleLimit:0}).subsystems['test-infrastructure'].observation.minutes).toBe(30);
 expect(r.ownership.domains.infrastructure).toBe('test-infrastructure');expect(r.economy).toBe(r.population.economy);
 expect(()=>r.registerSubsystem({...system,id:'duplicate'})).toThrow();expect(()=>r.registerSubsystem({...system,id:'money',owns:['economy']})).toThrow();
 const saved=r.serialize();expect(()=>restoreWorldRuntime(saved)).toThrow('subsystem');const restored=restoreWorldRuntime(saved,{subsystems:[system]});restored.step(15,{visibleLimit:0});r.step(15,{visibleLimit:0});expect(restored.serialize()).toEqual(r.serialize());r.destroy();restored.destroy();
});
test('restore rejects mismatched versions and clocks; malformed event cursors and limits fail explicitly',()=>{
 const r=createWorldRuntime(config),state=r.serialize();state.runtimeVersion='unavailable';expect(()=>r.restore(state)).toThrow('version');
 const bad=r.serialize();bad.core.population.minute=0;expect(()=>r.restore(bad)).toThrow('clock');
 expect(r.serialize().runtimeVersion).toBe(WORLD_RUNTIME_VERSION);expect(()=>r.eventsSince(999)).toThrow('cursor');expect(()=>r.step(0)).toThrow();expect(()=>r.snapshot({visibleLimit:2001})).toThrow();
 expect(()=>createWorldHistoryStore({maxEvents:10001})).toThrow();expect(()=>createWorldRuntime({...config,initialMinute:-1})).toThrow();r.destroy();
});
test('shadow policy envelope applies only real parameter and scheduled-event inputs and exposes its trace',()=>{
 const r=createWorldRuntime({...config,scenario:{populationPatch:{transitService:1.5},environmentPatch:{events:[{type:'storm',startMinute:400,durationMinutes:60,magnitude:.5}]},trace:{policy:'bus-input',supported:true}}});
 expect(r.parameters.transitService).toBe(1.5);expect(r.snapshot({visibleLimit:0}).policy.trace.policy).toBe('bus-input');
 r.step(90,{visibleLimit:0});expect(r.eventsSince().events.some(event=>event.type==='CITY_EVENT_PHASE'&&event.phase==='active')).toBe(true);
 expect(r.snapshot({visibleLimit:0}).environment.districtEffects.some(row=>row.roads<1)).toBe(true);
 expect(()=>r.applyScenario({populationPatch:{},environmentPatch:{floodRate:.4}})).toThrow('environment');
 expect(()=>r.applyScenario({populationPatch:null})).toThrow();r.destroy();
});
test('all source event kinds reach the canonical stream without inventing source detail or double counting',()=>{
 const r=createWorldRuntime({...config,history:{maxEvents:10000}});r.step(600,{visibleLimit:0});
 const recorded=r.eventsSince(),types=new Set(recorded.events.map(event=>event.type));
 expect(types.has('TRIP_STARTED')).toBe(true);expect(types.has('TRIP_COMPLETED')).toBe(true);
 const emitted=Object.values(r.population.eventCounts).reduce((n,value)=>n+value,0);
 expect(recorded.events.length+recorded.retention.sourceDroppedEvents).toBe(emitted);
 expect(recorded.events.every(event=>event.id&&event.synthetic&&event.schemaVersion==='world-event.v1')).toBe(true);
 expect(new Set(recorded.events.map(event=>event.id)).size).toBe(recorded.events.length);r.destroy();
});
test('culture receives only existing aggregate composition and source institutions, with no resident/economy references',async()=>{
 const {populationCultureContext}=await import('../world/runtime/culture-subsystem.js');
 const r=createWorldRuntime({...config,worldContext:{...worldContext,buildings:[...worldContext.buildings,{id:'museum',kind:'museum',center:[50,90]}]}});
 const composition=populationCultureContext(r.population,{buildings:[{id:'museum',kind:'museum',center:[50,90]}]});
 expect(Object.values(composition.ageBands).reduce((sum,n)=>sum+n,0)).toBe(r.population.people.age.length);
 expect(composition.households).toBe(r.population.households.size.length);expect(composition.institutions.map(row=>row.id)).toEqual(['museum']);
 expect(composition.people).toBeUndefined();expect(composition.economy).toBeUndefined();expect(composition.provenance.religion).toBe('not inferred');
 const original=r.population.districts[0].population;composition.districts[0].population=0;expect(r.population.districts[0].population).toBe(original);r.destroy();
});
function fixtureCultureFactory({seed,initialMinute,context,population,parameters}){
 let state={minute:initialMinute,seed,population:population.age.length,parameters:structuredClone(parameters),events:[],composition:structuredClone(context.populationComposition)};
 return{stepTo(minute){if(minute<state.minute)throw Error('regression');state.minute=minute;},snapshot(){return structuredClone({...state,activeEvents:state.events.filter(e=>e.startMinute<=state.minute&&state.minute<e.endMinute),upcomingEvents:state.events.filter(e=>e.startMinute>state.minute)});},configure(patch){state.parameters={...state.parameters,...patch};},scheduleEvent(event){const row={id:`fixture-${state.events.length}`,type:event.type,districtId:event.districtId??context.districts[0].id,startMinute:event.startMinute,endMinute:event.startMinute+60,effects:{demand:1.25,roads:.8}};state.events.push(row);return structuredClone(row);},serialize:()=>structuredClone(state),restore(saved){state=structuredClone(saved);}};
}
test('culture subsystem follows only committed minutes, maps supported event inputs and restores exact continuation',()=>{
 const r=createWorldRuntime({...config,cultureSimulationFactory:fixtureCultureFactory,culture:{parameters:{eventFrequency:0}}});
 expect(r.culture.minute).toBe(360);expect(r.ownership.domains.culture).toBe('culture');expect(r.culture.composition.population).toBe(80);
 const scheduled=r.scheduleCultureEvent({type:'festival',startMinute:382});
 const before=r.population.economy;r.snapshot();r.observe();expect(r.culture.minute).toBe(360);r.pause();r.step(30);expect(r.culture.minute).toBe(360);r.resume();r.step(30,{visibleLimit:0});
 expect(r.culture.minute).toBe(390);expect(r.economy).toBe(before);expect(r.economy.day).toBe(0);expect(r.economy.totalRevenue).toBe(0);
 const snapshot=r.snapshot({visibleLimit:0});expect(snapshot.culture.populationProjection.projected.length).toBe(2);expect(snapshot.environment.districtEffects.find(d=>d.districtId===scheduled.districtId).demand).toBe(1.25);
 expect(r.eventsSince().events.some(e=>e.type==='CULTURE_EVENT_STARTED'&&e.sourceMinute===382)).toBe(true);
 r.configureCulture({eventFrequency:1});const saved=r.serialize(),restored=restoreWorldRuntime(saved,{cultureSimulationFactory:fixtureCultureFactory});
 r.step(60,{visibleLimit:0});restored.step(60,{visibleLimit:0});expect(restored.serialize()).toEqual(r.serialize());
 expect(r.snapshot({visibleLimit:0}).culture.populationProjection.projected).toEqual([]);expect(r.parameters.events.some(e=>e.sourceEventId===scheduled.id)).toBe(false);
 expect(r.eventsSince().events.some(e=>e.type==='CULTURE_EVENT_ENDED')).toBe(true);r.destroy();restored.destroy();
});
test('production culture is enabled by default, uses actual model composition, drives mechanisms, and checkpoints restore',()=>{
 const defaultRuntime=createWorldRuntime({population:{population:10}});expect(defaultRuntime.culture.schemaVersion).toBe('culture.v1');defaultRuntime.destroy();
 const r=createWorldRuntime({...config,culture:{parameters:{eventFrequency:0,absurdEventsEnabled:false}}});
 const initial=r.snapshot({visibleLimit:0});expect(initial.culture.schemaVersion).toBe('culture.v1');expect(initial.culture.context.populationCount).toBe(80);expect(initial.culture.scenes.length).toBe(8);
 const counts={young:0,old:0};for(const age of r.population.people.age){counts.young+=age===0;counts.old+=age===2;}
 expect(initial.culture.context.youngShare).toBe(counts.young/80);expect(initial.culture.context.olderShare).toBe(counts.old/80);
 const event=r.scheduleCultureEvent({type:'parade',startMinute:382,districtId:r.population.districts[0].id});
 r.step(30,{visibleLimit:0});expect(r.culture.minute).toBe(390);expect(r.snapshot({visibleLimit:0}).culture.populationProjection.projected.some(row=>row.type==='road-closure')).toBe(true);
 expect(r.snapshot({visibleLimit:0}).environment.districtEffects[0].roads).toBe(.65);
 const restored=restoreWorldRuntime(r.serialize());r.step(150,{visibleLimit:0});restored.step(150,{visibleLimit:0});expect(restored.serialize()).toEqual(r.serialize());
 expect(r.culture.activeEvents.some(row=>row.id===event.id)).toBe(false);expect(r.snapshot({visibleLimit:0}).environment.districtEffects[0].roads).toBe(1);
 const before=r.clock.minute;expect(()=>r.step(.5)).toThrow('integer');expect(r.clock.minute).toBe(before);r.destroy();restored.destroy();
});
test('immediate culture starts are recorded once and failed mechanism projection rolls back the cultural command',()=>{
 const r=createWorldRuntime({...config,culture:{parameters:{eventFrequency:0}}});const facade=r.getCultureSimulation();expect(r.getCulture()).toBe(facade);expect(facade.stepTo).toBeUndefined();expect(facade.snapshot().minute).toBe(r.clock.minute);const event=facade.scheduleEvent({type:'parade'});
 expect(r.eventsSince().events.filter(row=>row.type==='CULTURE_EVENT_STARTED'&&row.cultureEventId===event.id).length).toBe(1);r.step(15,{visibleLimit:0});expect(r.eventsSince().events.filter(row=>row.type==='CULTURE_EVENT_STARTED'&&row.cultureEventId===event.id).length).toBe(1);r.destroy();
 const full=createWorldRuntime({...config,culture:{parameters:{eventFrequency:0}},population:{...config.population,events:Array.from({length:64},(_,i)=>({id:`external-${i}`,type:'festival',startMinute:2000,durationMinutes:60,magnitude:.01}))}});
 const before=full.serialize();expect(()=>full.scheduleCultureEvent({type:'parade'})).toThrow('64');expect(full.serialize()).toEqual(before);full.destroy();
});
test('all canonical observations preserve serialized state even with a selected untracked person and full tracking retention',()=>{
 const r=createWorldRuntime({...config,population:{population:1000}});
 try{
  for(let i=0;i<16;i++)r.trackPerson(i);
  r.step(90,{visibleLimit:0});const before=r.serialize(),selected=r.population.activityHistory.selected,hot=r.population.people,tracked=Object.keys(selected);
  for(let i=0;i<3;i++){
   const detail=r.inspectPerson(997);expect(detail.history.actorTimeline).toBeNull();expect(detail.id).toBe(`${r.population.prefix}-p997`);
   const frame=r.snapshot({visibleLimit:3,selectedPersonId:`${r.population.prefix}-p998`});expect(frame.population.visibleAgents.some(person=>person.index===998)).toBe(true);
   r.inspectHousehold(0);r.inspectBusiness(0);r.inspectPerson('unknown');r.observe();r.eventsSince();r.historySnapshot();r.snapshot({visibleLimit:0,selectedPersonId:`${r.population.prefix}-p999`});
  }
  expect(r.serialize()).toEqual(before);expect(r.population.people).toBe(hot);expect(r.population.activityHistory.selected).toBe(selected);expect(Object.keys(selected)).toEqual(tracked);expect(r.population.selectedIndex).toBe(15);
 }finally{r.destroy();}
});
test('explicit tracking starts future detail without advancing time; ordinary inspection leaves an absent selectedIndex absent',()=>{
 const r=createWorldRuntime(config);
 try{
  const before=r.serialize();expect(Object.hasOwn(r.population,'selectedIndex')).toBe(false);r.inspectPerson(7);r.snapshot({selectedPersonId:`${r.population.prefix}-p8`,visibleLimit:1});expect(Object.hasOwn(r.population,'selectedIndex')).toBe(false);expect(r.serialize()).toEqual(before);
  const minute=r.clock.minute;expect(r.trackPerson(7).id).toBe(`${r.population.prefix}-p7`);expect(r.clock.minute).toBe(minute);expect(r.population.selectedIndex).toBe(7);expect(r.trackPerson('bad')).toBeNull();r.step(15,{visibleLimit:0});
  const detail=r.inspectPerson(7);expect(detail.history.actorTimeline.intervals.length).toBeGreaterThan(0);expect(detail.history.actorTimeline.trackingStartedMinute).toBe(minute);expect(detail.history.actorTimeline.firstRecordedMinute).toBe(minute);
 }finally{r.destroy();}
});
