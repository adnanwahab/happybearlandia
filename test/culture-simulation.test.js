import {test,expect} from 'bun:test';
import {createCultureSimulation,cultureEffectsForDistrict,CULTURE_SCENES,CULTURE_EVENT_TYPES} from '../world/culture/culture-simulation.js';
const DAY=1440;
const context={districts:[{id:'north',x:0,z:0},{id:'south',x:1000,z:0}]};
const create=(extra={})=>createCultureSimulation({seed:42,initialMinute:360,context,...extra});
const scene=(simulation,id)=>simulation.snapshot().scenes.find(row=>row.id===id);

test('eight bounded scenes and same seed produce repeatable actual events and states',()=>{
 const a=create(),b=create();a.stepTo(60*DAY);b.stepTo(60*DAY);
 expect(a.serialize()).toEqual(b.serialize());expect(a.snapshot().history.length).toBeGreaterThan(0);
 expect(a.snapshot().scenes.map(s=>s.id)).toEqual(CULTURE_SCENES.map(s=>s.id));expect(CULTURE_SCENES).toHaveLength(8);
 for(const row of a.snapshot().scenes){expect(row.strength).toBeGreaterThanOrEqual(0);expect(row.strength).toBeLessThanOrEqual(1);}
 const different=create({seed:43});different.stepTo(60*DAY);expect(different.serialize().scenes).not.toEqual(a.serialize().scenes);
});

test('hour and event boundaries give identical state for one jump and irregular chunks',()=>{
 const a=create(),b=create();for(const simulation of [a,b])simulation.scheduleEvent({type:'parade',startMinute:391,districtId:'south'});
 const target=14*DAY+17;a.stepTo(target);for(let minute=397;minute<target;minute+=137)b.stepTo(minute);b.stepTo(target);
 expect(b.serialize()).toEqual(a.serialize());
});

test('read-only snapshots and unchanged committed time preserve state while paused',()=>{
 const simulation=create(),before=simulation.serialize();
 for(let i=0;i<5;i++)simulation.stepTo(360);
 const detached=simulation.snapshot();detached.scenes[0].strength=999;detached.parameters.eventFrequency=999;detached.eventTypes[0].effects.roads=999;
 expect(simulation.serialize()).toEqual(before);
});

test('serialized continuation restores actual events, scene dynamics and manual ID sequence',()=>{
 const a=create();a.scheduleEvent({type:'concert',startMinute:405});a.stepTo(1500);
 const saved=a.serialize(),b=create({seed:'unrelated',initialMinute:0});b.restore(saved);saved.scenes[0].strength=999;
 expect(b.snapshot().scenes[0].strength).not.toBe(999);
 const nextA=a.scheduleEvent({type:'marathon',startMinute:1601}),nextB=b.scheduleEvent({type:'marathon',startMinute:1601});expect(nextB).toEqual(nextA);
 a.stepTo(9*DAY);b.stepTo(9*DAY);expect(b.serialize()).toEqual(a.serialize());
});

test('temporary local effects multiply only while active and expire exactly at the end minute',()=>{
 const simulation=create({parameters:{eventFrequency:0}});
 const first=simulation.scheduleEvent({type:'traffic-jam',startMinute:400,districtId:'north'});
 simulation.scheduleEvent({type:'parade',startMinute:400,districtId:'north'});
 expect(cultureEffectsForDistrict(simulation.snapshot(),'north')).toEqual({roads:1,transit:1,services:1,demand:1});
 simulation.stepTo(400);expect(cultureEffectsForDistrict(simulation.snapshot(),'north').roads).toBeCloseTo(.6*.65,12);
 expect(cultureEffectsForDistrict(simulation.snapshot(),'south')).toEqual({roads:1,transit:1,services:1,demand:1});
 simulation.stepTo(first.endMinute);expect(cultureEffectsForDistrict(simulation.snapshot(),'north').roads).toBe(.65);
 simulation.stepTo(550);expect(cultureEffectsForDistrict(simulation.snapshot(),'north')).toEqual({roads:1,transit:1,services:1,demand:1});
 expect(simulation.snapshot().history.filter(row=>row.type==='EVENT_ENDED')).toHaveLength(2);
});

test('histories and live queues stay bounded with explicit retention and capacity rejection',()=>{
 const simulation=create({parameters:{eventFrequency:0}});
 for(let i=0;i<140;i++){simulation.scheduleEvent({type:'traffic-jam'});simulation.stepTo(360+(i+1)*120);}
 const state=simulation.snapshot();expect(state.history).toHaveLength(state.retention.maxHistory);expect(state.retention.droppedHistory).toBe(24);
 const queue=create({parameters:{eventFrequency:0}});for(let i=0;i<128;i++)queue.scheduleEvent({type:'concert',startMinute:1000});
 expect(()=>queue.scheduleEvent({type:'concert',startMinute:1000})).toThrow('capacity');expect(queue.serialize().pending).toHaveLength(128);expect(queue.snapshot().retention.droppedEvents).toBe(1);
});

test('disabled absurd generation produces no spontaneous absurd records; explicit scenarios remain manual',()=>{
 const simulation=create({parameters:{eventFrequency:3,absurdEventsEnabled:false}});
 for(let i=1;i<=4;i++)simulation.stepTo(360+i*365*DAY);
 const records=[...simulation.serialize().pending,...simulation.snapshot().activeEvents,...simulation.snapshot().history.map(row=>row.event)];
 expect(records.length).toBeGreaterThan(0);expect(records.some(row=>row.category==='absurd')).toBe(false);
 const manual=simulation.scheduleEvent({type:'inflatable-bear'});expect(manual.category).toBe('absurd');expect(manual.source).toBe('manual');
 expect(simulation.snapshot().activeEvents.some(row=>row.id===manual.id)).toBe(true);
});

test('venue tags, modeled age composition and declared interests change scene dynamics',()=>{
 const neutral=create({parameters:{eventFrequency:0}}),venues=create({parameters:{eventFrequency:0},context:{...context,buildings:Array.from({length:20},()=>({kind:'music',name:'Concert arts venue'}))}}),young=create({parameters:{eventFrequency:0},population:Array.from({length:20},()=>({age:20,interests:['music']}))});
 for(const simulation of [neutral,venues,young])simulation.stepTo(360+7*DAY);
 expect(scene(venues,'music').influences.institutions).toBe(20);expect(scene(venues,'music').strength).toBeGreaterThan(scene(neutral,'music').strength);
 expect(scene(young,'music').influences.youngShare).toBe(1);expect(scene(young,'music').influences.declaredInterestShare).toBe(1);expect(scene(young,'music').strength).toBeGreaterThan(scene(neutral,'music').strength);
 const frozen=create({parameters:{eventFrequency:0,culturalChangeRate:0}}),before=frozen.serialize().scenes;frozen.stepTo(360+3*DAY);expect(frozen.serialize().scenes).toEqual(before);
});

test('invalid clocks, parameters, district scopes, event types and oversized saves fail explicitly',()=>{
 for(const initialMinute of [-1,.5,NaN,Infinity])expect(()=>create({initialMinute})).toThrow();
 const simulation=create();for(const target of [359,360.5,NaN,Infinity,360+367*DAY])expect(()=>simulation.stepTo(target)).toThrow();
 const before=simulation.serialize();for(const patch of [{eventFrequency:-1},{culturalChangeRate:4},{absurdEventsEnabled:1},{notAParameter:1}])expect(()=>simulation.configure(patch)).toThrow();expect(simulation.serialize()).toEqual(before);
 for(const input of [{type:'unknown'},{type:'concert',districtId:'missing'},{type:'concert',startMinute:359},{type:'concert',startMinute:360+367*DAY}])expect(()=>simulation.scheduleEvent(input)).toThrow();
 expect(()=>create({context:{districts:[{id:'a'},{id:'a'}]}})).toThrow();expect(()=>simulation.restore({schemaVersion:'wrong'})).toThrow();
 const oversized=simulation.serialize();oversized.history=Array(257).fill({});expect(()=>simulation.restore(oversized)).toThrow();
 expect(CULTURE_EVENT_TYPES.filter(row=>row.category==='absurd')).toHaveLength(3);
});

test('accepted Living frames drive actual culture once per committed minute and reset on generation changes',async()=>{
 const {createLivingCultureClock}=await import('../world/culture/living-clock.js');const updates=[];
 const binding=createLivingCultureClock({createSimulation:createCultureSimulation,context,onUpdate:s=>updates.push(s)});
 const frame={minute:360,runtime:{id:'run',revision:0},config:{seed:42,population:30}};
 const simulation=binding.accept(frame),initial=simulation.serialize();for(let i=0;i<10;i++)binding.accept(frame);
 expect(simulation.serialize()).toEqual(initial);expect(updates).toHaveLength(1);
 binding.accept({...frame,minute:420},{active:false});expect(simulation.serialize()).toEqual(initial);
 binding.accept({...frame,minute:420});expect(simulation.snapshot().minute).toBe(420);expect(updates).toHaveLength(2);
 const fresh=binding.accept({...frame,runtime:{id:'run',revision:1}});expect(fresh).not.toBe(simulation);expect(fresh.snapshot().minute).toBe(360);
 binding.destroy();expect(binding.getSimulation()).toBeNull();
});

test('actual culture events project supported local population inputs, preserve economy ownership and remove effects at expiry',async()=>{
 const {createPopulationModel,serializePopulation,stepPopulation}=await import('../world/population/model.js');
 const {eventEffects}=await import('../world/population/behavior.js');
 const {applyCulturePopulationEvents}=await import('../world/culture/population-effects.js');
 const model=createPopulationModel({population:30,seed:42},context),culture=create({parameters:{eventFrequency:0}});
 const event=culture.scheduleEvent({type:'concert',startMinute:400,districtId:'north'});culture.stepTo(400);
 stepPopulation(model,{minutes:400});
 const before=serializePopulation(model),report=applyCulturePopulationEvents(model,culture.snapshot().activeEvents,{minute:400}),after=serializePopulation(model);
 expect({...after,config:before.config}).toEqual(before);expect(report.unsupported).toEqual([]);expect(report.projected.length).toBe(3);
 const north=model.districts.findIndex(d=>d.id==='north'),south=model.districts.findIndex(d=>d.id==='south');
 expect(eventEffects(model,400)[north]).toMatchObject({roads:.85,transit:.95,demand:1.18});expect(eventEffects(model,400)[south]).toMatchObject({roads:1,transit:1,demand:1});
 const repeat=applyCulturePopulationEvents(model,culture.snapshot().activeEvents,{minute:400});expect(repeat.changed).toBe(false);
 culture.stepTo(event.endMinute);stepPopulation(model,{minutes:event.endMinute-model.minute});const expired=applyCulturePopulationEvents(model,culture.snapshot().activeEvents,{minute:event.endMinute});expect(expired.removedIds).toHaveLength(3);
 expect(eventEffects(model,event.endMinute)[north]).toMatchObject({roads:1,transit:1,demand:1});
 const outageState=serializePopulation(model),outage=culture.scheduleEvent({type:'power-outage',districtId:'north'}),unsupported=applyCulturePopulationEvents(model,[outage],{minute:outage.startMinute});
 expect(unsupported.projected).toEqual([]);expect(unsupported.unsupported.map(row=>row.mechanism).sort()).toEqual(['demand','services']);expect(model.minute).toBe(outageState.minute);expect(model.economy).toEqual(outageState.economy);
});
