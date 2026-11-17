import {test,expect} from 'bun:test';
import {runShardSpike} from '../world/shard-spike/run.js';
import {tileStep,VERSION,initialState,scalarStep} from '../world/shard-spike/model.js';
test('1/2/4/8 real workers match scalar oracle and replay',async()=>{
 const hashes=[];
 for(const workers of [1,2,4,8]) {
  const r=await runShardSpike({workers,count:37,ticks:8}); hashes.push(r.stateHash);
  expect(r.stateHash).toBe(r.oracleHash); expect(r.assignments).toEqual(Array(workers).fill(8)); expect(r.droppedCrossShardEvents).toBe(0);
 }
 expect(new Set(hashes).size).toBe(1);
 expect((await runShardSpike({workers:4,count:37,ticks:8,latencyMs:1})).stateHash).toBe(hashes[0]);
});
test('integer conservation and seed bounds',()=>{
 for(const seed of [0,42,0xffffffff]) {
  let state=initialState(37,seed);const sum=state.reduce((a,b)=>a+b,0);
  for(let i=0;i<100;i++) state=scalarStep(state);
  expect(state.reduce((a,b)=>a+b,0)).toBe(sum); expect(state.every(v=>v>=0&&v<=100)).toBe(true);
 }
 expect(()=>initialState(8,-1)).toThrow(); expect(()=>tileStep({version:'bad'})).toThrow();
 expect(tileStep({version:VERSION,tick:0,start:0,values:[0,1],left:1}).values).toEqual([1,0]);
});
test('reject limits, stale results, worker errors and missing messages; terminate',async()=>{
 await expect(runShardSpike({workers:3})).rejects.toThrow();
 for(const mode of ['stale','error','silent','wrong']) {
  let terminated=false;
  const worker={terminate(){terminated=true;},postMessage(payload){
   if(mode==='silent') return;
   queueMicrotask(()=>mode==='error'?this.onerror():this.onmessage({data:{result:{...tileStep(payload),...(mode==='stale'?{tick:9}:{values:payload.values.map(()=>0)})}}}));
  }};
  await expect(runShardSpike({ticks:1,timeoutMs:20,workerFactory:()=>worker})).rejects.toThrow(); expect(terminated).toBe(true);
 }
});
