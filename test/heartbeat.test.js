import {test,expect} from 'bun:test';
import fixture from './fixtures/heartbeat/representative.json';
import {heartbeatPoints,seekHeartbeat} from '../world/heartbeat.js';
test('deterministic recorded counts, denominator, missing gap and actual zero',()=>{
 const points=heartbeatPoints(fixture);
 expect(points).toEqual(heartbeatPoints(structuredClone(fixture)));
 expect(points.map(p=>[p.minute,p.value])).toEqual([[360,2],[420,8],[480,null],[540,0]]);
 expect(points[1].agentMinutes).toBe(180);
 expect(heartbeatPoints({...fixture,buckets:[{startMinute:0,endMinute:60,completedTrips:3}]} )[0].value).toBe(null);
 expect(heartbeatPoints({...fixture,coverage:{queryAvailable:false}})).toEqual([]);
});
test('crest seeks exact same-run period and refuses stale, gap and inexact replay',async()=>{
 const crest=heartbeatPoints(fixture)[1];let target;
 expect(await seekHeartbeat(crest,{getRunId:()=>fixture.runId,seek:async minute=>{target=minute;return {minute};}})).toBe(420);
 expect(target).toBe(420);
 await expect(seekHeartbeat(crest,{getRunId:()=> 'other',seek:()=>{throw Error('must not call');}})).rejects.toThrow('current run');
 await expect(seekHeartbeat(heartbeatPoints(fixture)[2],{getRunId:()=>fixture.runId})).rejects.toThrow('unavailable');
 await expect(seekHeartbeat(crest,{getRunId:()=>fixture.runId,seek:async()=>({minute:421})})).rejects.toThrow('exact');
 let id=fixture.runId;
 await expect(seekHeartbeat(crest,{getRunId:()=>id,seek:async()=>{id='reset';return {minute:420};}})).rejects.toThrow('Run changed');
});
test('real worker history crest replays same run and preserves seed/rules identity',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');
 const runtime=createPopulationRuntime({config:{population:40,seed:733},workerCount:1});
 try{
  await runtime.ready;runtime.pause();await runtime.stepToTime(720);
  const before=runtime.getSnapshot(),runId=`${before.runtime.id}:${before.runtime.revision}`;
  const history={...await runtime.getActivityHistory(),runId};
  const points=heartbeatPoints(history).filter(p=>p.value!==null);
  expect(points.length).toBeGreaterThan(1);
  const crest=points.reduce((a,b)=>a.value>=b.value?a:b);
  expect(await seekHeartbeat(crest,{getRunId:()=>{const s=runtime.getSnapshot();return `${s.runtime.id}:${s.runtime.revision}`;},seek:minute=>runtime.stepToTime(minute)})).toBe(crest.minute);
  expect(runtime.getSnapshot().config.seed).toBe(733);
  expect(runtime.getSnapshot().modelVersion).toBe(before.modelVersion);
  expect(runtime.getSnapshot().runtime.paused).toBe(true);
 }finally{runtime.destroy();}
});
