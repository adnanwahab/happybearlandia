import {test,expect} from 'bun:test';
import {createPopulationRuntime} from '../world/population/runtime.js';
test('actual worker activity history conserves time and querying cannot advance or reset the live run',async()=>{
 const runtime=createPopulationRuntime({config:{population:100,seed:42},workerCount:1});
 try{
  await runtime.ready;runtime.pause();await runtime.stepToTime(120);
  const before=runtime.getSnapshot(),history=await runtime.getActivityHistory();
  expect(history.totals.agentMinutes).toBe(12000);
  expect(history.buckets.reduce((sum,row)=>sum+row.agentMinutes,0)).toBe(12000);
  expect(runtime.getSnapshot()).toEqual(before);
  const id=before.visibleAgents[0].id,person=await runtime.getActivityHistory({actorId:id,filters:{personId:id}});
  expect(person.actorCurrentState.id).toBe(id);
  expect(person.actorTimeline.intervals.length).toBeGreaterThan(0);
  expect(person.totals).toBeNull();
  expect(runtime.getSnapshot().minute).toBe(before.minute);
  await expect(runtime.getActivityHistory({filters:{personId:'constructor'}})).rejects.toThrow();
  await expect(runtime.getActivityHistory({arbitrary:true})).rejects.toThrow();
 }finally{runtime.destroy();}
});
test('history reads observe population resets rather than mixing earlier lifetime counters',async()=>{
 const runtime=createPopulationRuntime({config:{population:40,seed:42},workerCount:1});
 try{await runtime.ready;await runtime.step();expect((await runtime.getActivityHistory()).totals.agentMinutes).toBe(1200);await runtime.updateConfig({population:80,seed:42});const history=await runtime.getActivityHistory();expect(history.totals.agentMinutes).toBe(0);expect(history.source.population).toBe(80);expect(history.source.revision).toBe(runtime.getSnapshot().runtime.revision);}finally{runtime.destroy();}
});
