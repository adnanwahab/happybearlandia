import {test,expect} from 'bun:test';
import {createPopulationRuntime} from './runtime.js';
import {createPopulationModel,serializePopulation,restorePopulation,stepPopulation,inspectPerson} from './model.js';
import {createPopulationCheckpoint,readPopulationCheckpoint,encodeCheckpointGraph,decodeCheckpointGraph,MAX_CHECKPOINT_BYTES} from './checkpoint.js';

test('codec preserves typed bytes, aliases, maps, special numbers and rejects arbitrary constructors',()=>{
 const typed=new Float64Array([NaN,Infinity,-0,1.25]),source={typed,alias:typed,map:new Map([['x',typed]]),missing:undefined};
 const graph=JSON.parse(JSON.stringify(encodeCheckpointGraph(source))),out=decodeCheckpointGraph(graph);
 expect(out.typed).toBeInstanceOf(Float64Array);expect(out.alias).toBe(out.typed);expect(out.map.get('x')).toBe(out.typed);expect([...new Uint8Array(out.typed.buffer)]).toEqual([...new Uint8Array(typed.buffer)]);expect(Object.hasOwn(out,'missing')).toBe(true);
 expect(()=>decodeCheckpointGraph({root:['r',0],nodes:[['t','Function','']]})).toThrow();
 expect(()=>decodeCheckpointGraph({root:['r',0],nodes:[['o',[['__proto__',null]]]]})).toThrow();
 expect(()=>decodeCheckpointGraph({root:['r',4],nodes:[]})).toThrow();
 expect(()=>encodeCheckpointGraph('x'.repeat(MAX_CHECKPOINT_BYTES))).toThrow();
});

test('full serialized model remains exact through JSON and deterministic continuation',()=>{
 const model=createPopulationModel({population:80,seed:18});inspectPerson(model,0);
 for(let tick=1;tick<=20;tick++)stepPopulation(model,{tick,minutes:30});
 const restored=restorePopulation(decodeCheckpointGraph(JSON.parse(JSON.stringify(encodeCheckpointGraph(serializePopulation(model))))));
 expect(serializePopulation(restored)).toEqual(serializePopulation(model));
 expect(restored.people.employer).toBe(restored.employment.employer);
 for(let tick=21;tick<=23;tick++){stepPopulation(model,{tick,minutes:30});stepPopulation(restored,{tick,minutes:30});expect(serializePopulation(restored)).toEqual(serializePopulation(model));}
});

test('worker checkpoints restore full state and continue identically at 10 and 30 minutes',async()=>{
 const original=createPopulationRuntime({config:{population:80,seed:27},stepMinutes:1,clockMode:'minutes-per-second'}),restored=createPopulationRuntime({config:{population:30,seed:99}});
 try{
  await Promise.all([original.ready,restored.ready]);const first=await original.inspectPerson(original.getSnapshot().visibleAgents[0].id);expect(first.social.nearby.length).toBeGreaterThan(0);await original.socialAction(first.id,first.social.nearby[0].id,'talk');await original.stepToTime(600);const id=original.getSnapshot().visibleAgents[0].id;await original.inspectPerson(id);original.setView({x:12,z:34});original.setSpeed(4);
  await original.configureWeather({rainIntensity:.7});
  const saved=JSON.parse(JSON.stringify(await original.exportCheckpoint()));expect(saved.modelVersion).toBe('1.3.0');
  const state=readPopulationCheckpoint(saved);expect(state.runtime.tick).toBe(600);expect(state.runtime.socialTimeline).toHaveLength(1);expect(Object.keys(state.model.social.ties).length).toBeGreaterThan(0);expect(state.runtime.series.length).toBeGreaterThan(0);expect(state.model.people.age.length).toBe(80);
  await restored.restoreCheckpoint(saved);
  expect(readPopulationCheckpoint(await restored.exportCheckpoint())).toEqual(state);
  expect(restored.getSnapshot().runtime).toMatchObject({tick:600,stepMinutes:1,clockMode:'minutes-per-second',paused:true,speed:4});
  for(let minute=1;minute<=30;minute++){await original.step();await restored.step();if(minute===10||minute===30){const a=readPopulationCheckpoint(await original.exportCheckpoint()),b=readPopulationCheckpoint(await restored.exportCheckpoint());expect(b).toEqual(a);}}
  const before=await restored.exportCheckpoint();const malformed=structuredClone(saved);malformed.state.nodes[0]=['o',[]];await expect(restored.restoreCheckpoint(malformed)).rejects.toThrow();await expect(restored.restoreCheckpoint({...saved,modelVersion:'old'})).rejects.toThrow();expect(await restored.exportCheckpoint()).toEqual(before);
 }finally{original.destroy();restored.destroy();}
},30000);

test('export waits for an admitted step and never captures a partial target tick',async()=>{
 const runtime=createPopulationRuntime({config:{population:80},stepMinutes:1});try{await runtime.ready;const step=runtime.step();const checkpoint=runtime.exportCheckpoint();await step;const saved=readPopulationCheckpoint(await checkpoint);expect(saved.runtime.tick).toBe(1);expect(saved.model.minute).toBe(1);}finally{runtime.destroy();}
});

test('render-loop view updates coalesce during checkpoint capture and restore without changing captured view or continuation',async()=>{
 const a=createPopulationRuntime({config:{population:80,seed:71},view:{x:1,z:2},stepMinutes:1}),b=createPopulationRuntime({config:{population:30}});
 try{await Promise.all([a.ready,b.ready]);await a.step();const capture=a.exportCheckpoint();expect(a.checkpointPending).toBe(true);expect(()=>{a.setView({x:10,z:20});a.setView({x:30,z:40});a.setView({x:NaN,z:50});}).not.toThrow();const saved=await capture;expect(a.checkpointPending).toBe(false);expect(readPopulationCheckpoint(saved).runtime.view).toEqual({x:1,z:2});expect(readPopulationCheckpoint(await a.exportCheckpoint()).runtime.view).toEqual({x:30,z:40});
 const restore=b.restoreCheckpoint(JSON.parse(JSON.stringify(saved)));expect(b.checkpointPending).toBe(true);expect(()=>{b.setView({x:50,z:60});b.setView({x:30,z:40});}).not.toThrow();await restore;expect(b.checkpointPending).toBe(false);expect(readPopulationCheckpoint(await b.exportCheckpoint()).runtime.view).toEqual({x:30,z:40});await a.step();await b.step();expect(readPopulationCheckpoint(await b.exportCheckpoint())).toEqual(readPopulationCheckpoint(await a.exportCheckpoint()));
 }finally{a.destroy();b.destroy();}
});
