import {test,expect} from 'bun:test';
import {createPopulationRuntime} from '../world/population/runtime.js';
import {isAllocationFailure} from '../world/population/memory-pressure.js';

function failingWorker(control){return (url,options)=>{
 const worker=new Worker(url,options),listeners=new Set();
 worker.addEventListener('message',event=>{for(const fn of listeners)fn(event);});
 return {addEventListener(type,fn){if(type==='message')listeners.add(fn);else worker.addEventListener(type,fn);},terminate(){worker.terminate();},postMessage(data,transfer){
  if(control.fail(data)){queueMicrotask(()=>{for(const fn of listeners)fn({data:{type:'TASK_ERROR',taskId:data.taskId,error:control.message||'Array buffer allocation failed'}});});}
  else worker.postMessage(data,transfer);
 }};
};}
test('only reported allocation errors qualify; no hardware or slow-frame guess',()=>{
 for(const message of ['Array buffer allocation failed','Out of memory','Failed to allocate memory'])expect(isAllocationFailure(new Error(message))).toBe(true);
 for(const message of ['Invalid array length','Worker crashed','Worker task deadline exceeded','Maximum call stack size exceeded'])expect(isAllocationFailure(new RangeError(message))).toBe(false);
});
test('startup allocation failure offers bounded explicit retry and real worker succeeds with provenance',async()=>{
 let failures=1;const errors=[];
 const runtime=createPopulationRuntime({config:{population:80,seed:42},workerFactory:failingWorker({fail:()=>failures-->0}),onError:e=>errors.push(e.message)});
 try{
  await expect(runtime.ready).rejects.toThrow('allocation failed');
  expect(runtime.getSnapshot()).toBeNull();expect(errors).toHaveLength(1);
  const recovery=runtime.getMemoryRecovery();expect(recovery.beforePopulation).toBe(80);expect(recovery.afterPopulation).toBe(40);
  const result=await runtime.recoverWithFewerAgents();expect(result.population).toBe(40);expect(result.config.seed).toBe(42);expect(result.runtime.paused).toBe(true);
  expect(result.resetProvenance.memoryRecovery).toEqual(recovery);expect(runtime.getMemoryRecovery()).toBeNull();
  const direct=createPopulationRuntime({config:{population:40,seed:42}});
  try{await direct.ready;expect(result.metrics).toEqual(direct.getSnapshot().metrics);expect(result.visibleAgents).toEqual(direct.getSnapshot().visibleAgents);}finally{direct.destroy();}
  await runtime.step();expect(runtime.getSnapshot().resetProvenance.memoryRecovery).toEqual(recovery);
  const checkpoint=await runtime.exportCheckpoint();await runtime.restoreCheckpoint(checkpoint);
  expect(runtime.getSnapshot().resetProvenance.memoryRecovery).toEqual(recovery);
 }finally{runtime.destroy();}
});
test('advance failure pauses, offers smaller population and repeated failure stops at one',async()=>{
 let fail=false;const runtime=createPopulationRuntime({config:{population:3,seed:42},workerFactory:failingWorker({fail:()=>fail})});
 try{
  await runtime.ready;runtime.resume();fail=true;await expect(runtime.step()).rejects.toThrow();
  await expect(runtime.step()).rejects.toThrow("Allocation failed");
  expect(runtime.getSnapshot().runtime.paused).toBe(true);expect(()=>runtime.resume()).toThrow('Allocation failed');
  expect(runtime.getMemoryRecovery().beforePopulation).toBe(3);
  await expect(runtime.recoverWithFewerAgents()).rejects.toThrow();expect(runtime.getMemoryRecovery().beforePopulation).toBe(1);expect(runtime.getMemoryRecovery().canReduce).toBe(false);
  expect(()=>runtime.recoverWithFewerAgents()).toThrow('No smaller');
 }finally{runtime.destroy();}
});
test('ordinary worker failure does not offer changed fidelity',async()=>{
 const runtime=createPopulationRuntime({config:{population:20},workerFactory:failingWorker({fail:()=>true,message:'Invalid array length'})});
 try{await expect(runtime.ready).rejects.toThrow();expect(runtime.getMemoryRecovery()).toBeNull();}finally{runtime.destroy();}
});
