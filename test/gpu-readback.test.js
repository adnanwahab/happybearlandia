import {test,expect} from 'bun:test';
import {GPUProfiler} from '../world/render/renderer/gpu-profiler.js';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('bounded asynchronous sampling retains request and completion provenance',async()=>{
 let now=0,calls=0,resolve;
 const p=new GPUProfiler({hasFeature:()=>true,resolveTimestampsAsync:()=>{calls++;return new Promise(r=>resolve=r);}},{clock:()=>now});
 p.sample(0,1);for(let i=1;i<100;i++)p.sample(i*16,i);await flush();expect(calls).toBe(1);
 now=1600;resolve(3);await flush();expect(p.getSnapshot().latest).toEqual({ms:3,requestedAt:0,completedAt:1600,requestFrame:1,ageMs:1600});
 p.sample(1600,100);await flush();expect(calls).toBe(2);resolve(4);await flush();p.sample(1700);await flush();expect(calls).toBe(2);
});
test('off, unsupported and disposal suppress transfers and late results',async()=>{
 let resolve,calls=0;const renderer={hasFeature:()=>true,resolveTimestampsAsync:()=>{calls++;return new Promise(r=>resolve=r);}};
 renderer.backend={trackTimestamp:true};
 const p=new GPUProfiler(renderer);p.sample();await flush();p.setEnabled(false);expect(renderer.backend.trackTimestamp).toBe(false);p.setEnabled(true);expect(renderer.backend.trackTimestamp).toBe(true);p.sample();await flush();expect(calls).toBe(1);resolve(4);await flush();expect(p.latest).toBeNull();p.sample(performance.now()+300);await flush();p.dispose();resolve(5);await flush();expect(p.latest).toBeNull();expect(p.enabled).toBe(false);
 const unsupported=new GPUProfiler({...renderer,hasFeature:()=>false});unsupported.setEnabled(true);unsupported.sample();await flush();expect(calls).toBe(2);
});
test('backend rejection and synchronous errors release the slot and mark unavailable',async()=>{
 for(const resolveTimestampsAsync of [()=>{throw Error('lost');},()=>Promise.reject(Error('lost'))]){
  const renderer={hasFeature:()=>true,resolveTimestampsAsync,backend:{trackTimestamp:true}};
  const p=new GPUProfiler(renderer);p.sample();await flush();expect(p.pending).toBe(false);expect(p.enabled).toBe(false);expect(p.ms).toBeNull();expect(renderer.backend.trackTimestamp).toBe(false);
 }
});
test('invalid and missing timings never become measured zero',async()=>{
 for(const value of [undefined,NaN,Infinity,0,-1]){const p=new GPUProfiler({hasFeature:()=>true,resolveTimestampsAsync:async()=>value});p.sample();await flush();expect(p.latest).toBeNull();}
});
