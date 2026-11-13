import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {workerCall} from '../world/city/worker-call.js';
import {createCityApi,normalizeExperiment} from '../world/city/api.js';
import {createEngine,cityMetrics} from '../world/city/engine.js';
import {createCity} from '../world/city/seed.js';

function controlled({onPost,constructorError,terminationError}={}) {
 const workers=[];
 function createWorker(url) {
  if(constructorError)throw constructorError;
  const worker={url,terminations:0,posts:[],postMessage(data){this.posts.push(data);onPost?.(this,data);},terminate(){this.terminations++;if(terminationError)throw terminationError;}};
  workers.push(worker);return worker;
 }
 return {workers,createWorker};
}
function signalProbe(){const controller=new AbortController(),signal=controller.signal;let added=0,removed=0;const add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);signal.addEventListener=(...args)=>{added++;return add(...args)};signal.removeEventListener=(...args)=>{removed++;return remove(...args)};return {controller,signal,counts:()=>({added,removed})};}
function cleaned(worker){expect(worker.terminations).toBe(1);expect(worker.onmessage).toBeNull();expect(worker.onerror).toBeNull();}

test('short success clears worker/listener and ignores queued late message, error and abort',async()=>{
 const p=signalProbe(),f=controlled();const promise=workerCall('./run.worker.js',{request:'original'},100,{signal:p.signal,createWorker:f.createWorker}),worker=f.workers[0];
 const lateMessage=worker.onmessage,lateError=worker.onerror;worker.onmessage({data:{result:{value:7}}});
 expect(await promise).toEqual({value:7});lateMessage({data:{result:{value:99}}});lateError({message:'late'});p.controller.abort();cleaned(worker);expect(p.counts()).toEqual({added:1,removed:1});expect(worker.posts).toEqual([{request:'original'}]);
});
test('pre-aborted request never constructs a worker; construction-time abort never posts work',async()=>{
 const c=new AbortController();c.abort();const f=controlled();await expect(workerCall('./run.worker.js',{},100,{signal:c.signal,createWorker:f.createWorker})).rejects.toMatchObject({name:'AbortError'});expect(f.workers).toHaveLength(0);
 const p=signalProbe(),g=controlled();await expect(workerCall('./run.worker.js',{},100,{signal:p.signal,createWorker:url=>{p.controller.abort();return g.createWorker(url)}})).rejects.toMatchObject({name:'AbortError'});cleaned(g.workers[0]);expect(g.workers[0].posts).toEqual([]);expect(p.counts()).toEqual({added:1,removed:1});
});
test('abort during work terminates once and prevents a late success from settling it',async()=>{
 const p=signalProbe(),f=controlled(),pending=workerCall('./run.worker.js',{},100,{signal:p.signal,createWorker:f.createWorker});const worker=f.workers[0],late=worker.onmessage;
 p.controller.abort();await expect(pending).rejects.toMatchObject({name:'AbortError',message:'Operation aborted'});late({data:{result:'too late'}});cleaned(worker);expect(p.counts()).toEqual({added:1,removed:1});
});
test('stalled operation deadline cleans listeners/handlers and remains a rejection after abort',async()=>{
 const p=signalProbe(),f=controlled(),pending=workerCall('./run.worker.js',{},5,{signal:p.signal,createWorker:f.createWorker});await expect(pending).rejects.toThrow('Operation time limit exceeded');p.controller.abort();cleaned(f.workers[0]);expect(p.counts()).toEqual({added:1,removed:1});
});
test('worker result errors, worker events, malformed messages and post failures always clean up',async()=>{
 for(const mode of ['result-error','event-error','malformed','post-error']){
  const p=signalProbe(),f=controlled({onPost(worker){if(mode==='post-error')throw Error(mode);if(mode==='event-error')worker.onerror({message:mode});else worker.onmessage({data:mode==='result-error'?{error:mode}:{unexpected:true}});}});
  await expect(workerCall('./run.worker.js',{},100,{signal:p.signal,createWorker:f.createWorker})).rejects.toThrow(mode==='malformed'?'Invalid City worker response':mode);cleaned(f.workers[0]);expect(p.counts()).toEqual({added:1,removed:1});
 }
});
test('constructor/termination failures settle explicitly; invalid deadlines allocate nothing',async()=>{
 const f=controlled({constructorError:Error('construct')});await expect(workerCall('./run.worker.js',{},100,{createWorker:f.createWorker})).rejects.toThrow('construct');
 const g=controlled({terminationError:Error('terminate'),onPost(worker){worker.onmessage({data:{result:1}})}});await expect(workerCall('./run.worker.js',{},100,{createWorker:g.createWorker})).rejects.toThrow('terminate');cleaned(g.workers[0]);
 for(const timeout of [-1,NaN,Infinity])await expect(workerCall('./run.worker.js',{},timeout,{createWorker:f.createWorker})).rejects.toThrow('timeout');expect(f.workers).toHaveLength(0);
});
test('real short seeded City worker preserves input and exactly matches engine state/metrics',async()=>{
 const initial=createCity({seed:42,households:6}),before=JSON.stringify(initial),workers=[];
 const result=await workerCall('./run.worker.js',{initial,seed:42,months:2,replay:true},2000,{createWorker:url=>{const worker=new Worker(url),terminate=worker.terminate.bind(worker);worker.terminationCount=0;worker.terminate=()=>{worker.terminationCount++;return terminate()};workers.push(worker);return worker;}});
 const expected=createEngine().run(initial,2);expect(result.state).toEqual(expected.state);expect(result.metrics).toEqual(cityMetrics(expected.state));expect(result.steps).toHaveLength(2);expect(JSON.stringify(initial)).toBe(before);expect(workers[0].terminationCount).toBe(1);expect(workers[0].onmessage).toBeNull();
});
test('real nonresponsive worker is terminated on deadline rather than leaving a live operation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'city-worker-deadline-')),file=join(dir,'stall.js');writeFileSync(file,'self.onmessage=()=>{while(true){}};');let terminated=0;
 try{await expect(workerCall(pathToFileURL(file).href,{},30,{createWorker:url=>{const worker=new Worker(url),terminate=worker.terminate.bind(worker);worker.terminate=()=>{terminated++;return terminate()};return worker;}})).rejects.toThrow('time limit');expect(terminated).toBe(1);}finally{rmSync(dir,{recursive:true,force:true});}
});

test('replay route passes request abort, releases both reserved slots and keeps error response contract',async()=>{
 const manifest=normalizeExperiment({city:{seed:42,households:6},runs:1,months:2,scenarios:[{id:'baseline',interventions:[]}]}),id='city_abort_fixture';
 const handle=createCityApi({store:{get:key=>key===id?{manifest,status:'complete'}:null}}),OriginalWorker=globalThis.Worker,f=controlled();
 globalThis.Worker=class{constructor(url){return f.createWorker(url)}};
 const request=signal=>handle(new Request(`http://localhost/api/city-experiments/${id}/replay`,{method:'POST',body:JSON.stringify({scenarioId:'baseline',runIndex:0}),signal}));
 const a=new AbortController(),b=new AbortController(),c=new AbortController();
 try{
  const first=request(a.signal),second=request(b.signal);await new Promise(resolve=>setTimeout(resolve,0));expect(f.workers).toHaveLength(2);
  const busy=await request();expect(busy.status).toBe(429);a.abort();expect((await first).status).toBe(400);cleaned(f.workers[0]);
  const next=request(c.signal);await new Promise(resolve=>setTimeout(resolve,0));expect(f.workers).toHaveLength(3);c.abort();const cancelled=await next;expect(cancelled.status).toBe(400);expect(await cancelled.json()).toEqual({error:'Operation aborted'});
  b.abort();await second;cleaned(f.workers[1]);cleaned(f.workers[2]);
 }finally{a.abort();b.abort();c.abort();globalThis.Worker=OriginalWorker;}
});
test('actual replay route still executes a successful short run on the normal Worker entry point',async()=>{
 const manifest=normalizeExperiment({city:{seed:0,households:6},runs:1,months:2,scenarios:[{id:'baseline',interventions:[]}]}),initial=JSON.stringify(manifest.initial);
 const recorded=cityMetrics(createEngine().run(manifest.initial,2).state);
 const handle=createCityApi({store:{get:()=>({manifest,status:'complete'}),savedOutcome:()=>recorded}}),response=await handle(new Request('http://localhost/api/city-experiments/city_short/replay',{method:'POST',body:JSON.stringify({runIndex:0,scenarioId:'baseline'})}));
 expect(response.status).toBe(200);const result=await response.json();expect(result.state).toEqual(createEngine().run(manifest.initial,2).state);expect(result.steps).toHaveLength(2);expect(result.state.seed).toBe(0);expect(result.verification.status).toBe('matched');expect(JSON.stringify(manifest.initial)).toBe(initial);
});
