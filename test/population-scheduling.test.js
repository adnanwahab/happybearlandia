import {test,expect} from 'bun:test';
import {readPopulationCheckpoint} from '../world/population/checkpoint.js';
import {createSchedulingGuard} from '../world/population/scheduling-guard.js';
import {createPopulationClock,createPopulationRuntime} from '../world/population/runtime.js';

test('pressure boundaries, recovery hysteresis, invalid measurements and detached bounded logs',()=>{
 const g=createSchedulingGuard();let now=0;
 const record=durationMs=>g.record({durationMs,now:now+=500,tick:now/500,revision:1});
 record(99);expect(g.getSnapshot().mode).toBe('normal');record(100);
 expect(g.allows(now+399)).toBe(false);expect(g.allows(now+400)).toBe(true);
 const before=g.getSnapshot();for(const duration of [NaN,Infinity,-1])expect(record(duration)).toBe(false);
 expect(g.getSnapshot()).toEqual(before);
 for(let i=0;i<7;i++)record(40);record(41);for(let i=0;i<7;i++)record(40);
 expect(g.getSnapshot().mode).toBe('reduced');record(40);expect(g.getSnapshot().mode).toBe('normal');
 for(let i=0;i<40;i++){record(100);for(let j=0;j<8;j++)record(0);}
 expect(g.getSnapshot().transitions).toHaveLength(64);expect(g.getSnapshot().transitionCount).toBe(82);
 g.getSnapshot().transitions.length=0;expect(g.getSnapshot().transitions).toHaveLength(64);
});

test('guarded polls discard elapsed cooldown instead of accruing a catch-up burst',()=>{
 const clock=createPopulationClock({clockMode:'minutes-per-second',stepMinutes:1}),g=createSchedulingGuard();
 clock.reset(0);g.record({durationMs:100,now:0,tick:1,revision:1});
 for(const now of [100,200,300])expect(clock.poll(now,{busy:!g.allows(now),speed:10})).toBe(0);
 expect(clock.poll(400,{busy:!g.allows(400),speed:10})).toBe(1);
});

test('normal runtime entry uses measured pressure and equal ticks preserve full deterministic model',async()=>{
 let delayed=0;
 const workerFactory=(url,options)=>{
  const worker=new Worker(url,options);
  return {postMessage:msg=>worker.postMessage(msg),terminate:()=>worker.terminate(),addEventListener(type,callback){
   worker.addEventListener(type,event=>{
    if(type==='message'&&event.data.type==='TASK_DONE'&&event.data.result?.aggregate?.tick>0){delayed++;setTimeout(()=>callback(event),120);}
    else callback(event);
   });
  }};
 };
 const slow=createPopulationRuntime({config:{population:20,seed:42},workerFactory,intervalMs:50});
 const reference=createPopulationRuntime({config:{population:20,seed:42},intervalMs:5000});
 try{
  await Promise.all([slow.ready,reference.ready]);slow.setSpeed(32);slow.resume();
  const deadline=performance.now()+5000;
  while(slow.getSnapshot().runtime.scheduling.mode!=='reduced'&&performance.now()<deadline)await new Promise(r=>setTimeout(r,10));
  const s=slow.getSnapshot();expect(s.runtime.scheduling.mode).toBe('reduced');expect(delayed).toBeGreaterThan(0);
  expect(s.runtime.scheduling.transitions[0]).toMatchObject({from:'normal',to:'reduced',tick:s.runtime.tick,revision:s.runtime.revision});
  await new Promise(r=>setTimeout(r,220));expect(slow.getSnapshot().runtime.tick).toBe(s.runtime.tick);slow.pause();
  await reference.stepToTime(s.runtime.tick*30);
  const [a,b]=await Promise.all([slow.exportCheckpoint(),reference.exportCheckpoint()]);
  const actual=readPopulationCheckpoint(a).model,expected=readPopulationCheckpoint(b).model;
  expect(actual.tick).toBe(s.runtime.tick);expect(actual.people.age.length).toBe(20);expect(actual).toEqual(expected);
 }finally{slow.destroy();reference.destroy();}
},10000);

test('failed automatic commits roll back tick without logging successful quality measurements',async()=>{
 const errors=[];
 const workerFactory=(url,options)=>{
  const worker=new Worker(url,options),listeners=[];
  return {terminate:()=>worker.terminate(),addEventListener(type,callback){if(type==='message')listeners.push(callback);worker.addEventListener(type,callback);},postMessage(message){
   if(message.type==='TASK_START'&&message.kind==='advance')setTimeout(()=>{for(const fn of listeners)fn({data:{type:'TASK_ERROR',taskId:message.taskId,error:'injected failure'}});},120);
   else worker.postMessage(message);
  }};
 };
 const runtime=createPopulationRuntime({config:{population:20,seed:42},workerFactory,intervalMs:50,onError:error=>errors.push(error.message)});
 try{await runtime.ready;runtime.resume();const deadline=performance.now()+3000;while(!errors.length&&performance.now()<deadline)await new Promise(r=>setTimeout(r,10));runtime.pause();
  expect(errors).toContain('injected failure');expect(runtime.getSnapshot().runtime.tick).toBe(0);expect(runtime.getSnapshot().runtime.scheduling.transitionCount).toBe(0);
 }finally{runtime.destroy();}
});
