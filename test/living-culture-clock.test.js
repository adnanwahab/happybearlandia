import {test,expect} from 'bun:test';
import {createLivingCultureClock} from '../world/culture/living-clock.js';
const frame=(minute,revision=1)=>({minute,config:{seed:7,population:10000},runtime:{id:'live',revision,paused:true}});
test('culture follows only committed active minutes and repeated pause snapshots do not generate events',()=>{
 const calls=[],created=[],updates=[];
 const clock=createLivingCultureClock({context:{id:'city'},createSimulation:options=>{created.push(options);return{snapshot:()=>({minute:options.initialMinute}),stepTo:minute=>calls.push(minute)};},onUpdate:s=>updates.push(s)});
 const first=clock.accept(frame(425));clock.accept(frame(425));clock.accept(frame(426),{active:false});expect(calls).toEqual([]);expect(clock.getSimulation()).toBe(first);
 clock.accept(frame(426));expect(calls).toEqual([426]);expect(created).toHaveLength(1);expect(created[0]).toMatchObject({seed:7,initialMinute:425,population:{populationCount:10000}});expect(updates).toHaveLength(2);
 clock.accept(frame(0,2));expect(created).toHaveLength(2);expect(clock.getSimulation()).not.toBe(first);clock.accept(null);expect(clock.getSimulation()).toBeNull();clock.destroy();clock.accept(frame(900));expect(clock.getSimulation()).toBeNull();
});

test('real culture engine advances with explicit model steps and stays immutable across repeated paused frames',async()=>{
 const {createCultureSimulation}=await import('../world/culture/culture-simulation.js');
 const clock=createLivingCultureClock({createSimulation:createCultureSimulation,context:{districts:[{id:'district-0',x:0,z:0}],buildings:[]}});
 clock.accept(frame(540));const simulation=clock.getSimulation(),before=simulation.serialize();clock.accept(frame(540));expect(simulation.serialize()).toEqual(before);
 clock.accept(frame(600),{active:false});expect(simulation.serialize()).toEqual(before);clock.accept(frame(600));expect(simulation.snapshot().minute).toBe(600);clock.destroy();
});

test('culture receives the actual aggregate count and retains user controls across population resets',async()=>{
 const {createCultureSimulation}=await import('../world/culture/culture-simulation.js');
 const clock=createLivingCultureClock({createSimulation:createCultureSimulation,context:{districts:[{id:'d',x:0,z:0}]}});
 clock.accept(frame(425));expect(clock.getSimulation().snapshot().context.populationCount).toBe(10000);
 clock.getSimulation().configure({eventFrequency:0,absurdEventsEnabled:false});clock.accept(null);clock.accept(frame(0,2));
 expect(clock.getSimulation().snapshot().parameters).toMatchObject({eventFrequency:0,absurdEventsEnabled:false});
 clock.destroy();
});
