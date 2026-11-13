import {test,expect} from '@playwright/test';

test('live scheduling pressure is observable without changing equal-tick state',async({page,browserName})=>{
 await page.goto('/world/bench/people');
 const evidence=await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js');
  const {readPopulationCheckpoint}=await import('/world/population/checkpoint.js');
  const workerFactory=(url,options)=>{
   const worker=new Worker(url,options);
   return {postMessage:message=>worker.postMessage(message),terminate:()=>worker.terminate(),addEventListener(type,callback){worker.addEventListener(type,event=>{
    if(type==='message'&&event.data.type==='TASK_DONE'&&event.data.result?.aggregate?.tick>0)setTimeout(()=>callback(event),120);else callback(event);
   });}};
  };
  const slow=createPopulationRuntime({config:{population:20,seed:42},workerFactory,intervalMs:50});
  const reference=createPopulationRuntime({config:{population:20,seed:42}});
  try{
   await Promise.all([slow.ready,reference.ready]);slow.setSpeed(32);slow.resume();
   const deadline=performance.now()+5000;
   while(slow.getSnapshot().runtime.scheduling.mode!=='reduced'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,10));
   slow.pause();const state=slow.getSnapshot();await reference.stepToTime(state.runtime.tick*30);
   const a=readPopulationCheckpoint(await slow.exportCheckpoint()).model,b=readPopulationCheckpoint(await reference.exportCheckpoint()).model;
   // Graph-encoded checkpoints preserve typed bytes and aliases deterministically.
   const {encodeCheckpointGraph}=await import('/world/population/checkpoint.js');
   return {scheduling:state.runtime.scheduling,tick:state.runtime.tick,seed:a.seed,population:a.people.age.length,equal:JSON.stringify(encodeCheckpointGraph(a))===JSON.stringify(encodeCheckpointGraph(b)),userAgent:navigator.userAgent};
  }finally{slow.destroy();reference.destroy();}
 });
 expect(evidence.scheduling.mode).toBe('reduced');expect(evidence.scheduling.transitions[0].tick).toBe(evidence.tick);
 expect(evidence.equal).toBe(true);expect(evidence.seed).toBe(42);expect(evidence.population).toBe(20);
 await test.info().attach('scheduling-evidence',{body:JSON.stringify({browserName,...evidence},null,2),contentType:'application/json'});
});
