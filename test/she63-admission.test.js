import {test,expect} from 'bun:test';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {createSimulationAdmission} from '../ops/security/simulation-admission.js';
import {acquireShe63Admission,retryAfterDeadline,installShe63Admission,paceShe63Fork} from './support/she63-admission.js';
const directory=()=>mkdtemp(join(tmpdir(),'she63-admission-test-'));
test('case entry waits a full unchanged production window after the last actual response',async()=>{
 const root=await directory();let time=1000;const waits=[],options={now:()=>time,delay:async ms=>{waits.push(ms);time+=ms;}};
 try{
  const admission=createSimulationAdmission({now:()=>time}),request=new Request('http://127.0.0.1/api/city-experiments',{method:'POST'}),first=await acquireShe63Admission(root,options);
  for(let i=0;i<6;i++){expect(admission(request,'loopback')).toBeNull();expect(first.observe({phase:'request',method:'POST',url:request.url})).toBe(true);}
  expect(admission(request,'loopback').status).toBe(429);
  time=5000;first.observe({phase:'response',method:'POST',url:request.url,status:201});
  expect(first.observe({phase:'request',method:'GET',url:request.url})).toBe(false);await first.release();
  const second=await acquireShe63Admission(root,options);expect(waits).toEqual([61000]);expect(time).toBe(66000);expect(admission(request,'loopback')).toBeNull();await second.release();
 }finally{await rm(root,{recursive:true,force:true});}
});
test('public Retry-After is retained and can extend, never shorten, the production window',async()=>{
 const root=await directory();let time=1000;const waits=[],options={now:()=>time,delay:async ms=>{waits.push(ms);time+=ms;}};
 try{const lease=await acquireShe63Admission(root,options);lease.observe({phase:'response',method:'POST',url:'http://local/api/city-experiments/one/replay',status:429,retryAfter:'120'});await lease.release();const next=await acquireShe63Admission(root,options);expect(waits).toEqual([120000]);await next.release();expect(await readFile(join(root,'admission.jsonl'),'utf8')).toContain('"retryAfter":"120"');}
 finally{await rm(root,{recursive:true,force:true});}
 expect(retryAfterDeadline('Wed, 21 Oct 2015 07:28:00 GMT',0)).toBe(1445412480000);expect(retryAfterDeadline('bad',0)).toBeNull();expect(retryAfterDeadline(null,0)).toBeNull();
});
test('a second normal fork can pace within one case without changing six-per-minute quota',async()=>{
 const root=await directory();let time=1000;const waits=[],options={now:()=>time,delay:async ms=>{waits.push(ms);time+=ms;}};
 try{const admit=createSimulationAdmission({now:()=>time}),request=new Request('http://local/api/city-experiments',{method:'POST'}),lease=await acquireShe63Admission(root,options);
  for(let i=0;i<6;i++){expect(admit(request,'loopback')).toBeNull();lease.observe({phase:'response',method:'POST',url:request.url,status:202});}
  expect(admit(request,'loopback').status).toBe(429);await lease.waitForWindow();expect(waits).toEqual([61000]);expect(admit(request,'loopback')).toBeNull();lease.observe({phase:'response',method:'POST',url:request.url,status:202});await lease.release();
  await paceShe63Fork({}); // Canonical suites without run hooks remain unchanged.
 }finally{await rm(root,{recursive:true,force:true});}
});
test('queued cancellation releases no other lease and stale dead workers can recover',async()=>{
 const root=await directory();try{
  const first=await acquireShe63Admission(root),controller=new AbortController(),pending=acquireShe63Admission(root,{signal:controller.signal});controller.abort();await expect(pending).rejects.toThrow('interrupted');await first.release();
  await mkdir(join(root,'case.lock'));await writeFile(join(root,'case.lock','owner.json'),JSON.stringify({pid:2147483647,nonce:'dead-worker'}));
  const recovered=await acquireShe63Admission(root);await recovered.release();await recovered.release();
  const cancelled=new AbortController();cancelled.abort();await expect(acquireShe63Admission(root,{signal:cancelled.signal})).rejects.toThrow('interrupted');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('independent worker processes cannot hold the run lease simultaneously',async()=>{
 const root=await directory(),module=new URL('./support/she63-admission.js',import.meta.url).href;
 const script=`import {acquireShe63Admission} from ${JSON.stringify(module)};const lease=await acquireShe63Admission(process.argv[1]);console.log('start '+Date.now());await Bun.sleep(100);console.log('end '+Date.now());await lease.release();`;
 const worker=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--no-env-file','-e',script,root],{stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>errors+=data);child.on('error',reject);child.on('close',code=>code?reject(Error(errors)):resolve(output.trim().split('\n').map(line=>Number(line.split(' ')[1]))));});
 try{const rows=(await Promise.all([worker(),worker()])).sort((a,b)=>a[0]-b[0]);expect(rows[1][0]).toBeGreaterThanOrEqual(rows[0][1]);}finally{await rm(root,{recursive:true,force:true});}
});
test('interrupted cooldown and corrupt state release their owned locks and fail explicitly',async()=>{
 const root=await directory();try{
  await writeFile(join(root,'state.json'),JSON.stringify({nextAllowedAt:100000}));const controller=new AbortController();
  await expect(acquireShe63Admission(root,{signal:controller.signal,now:()=>0,delay:async()=>{controller.abort();throw Error('cooldown interrupted');}})).rejects.toThrow('cooldown interrupted');
  await writeFile(join(root,'state.json'),'{}');await expect(acquireShe63Admission(root)).rejects.toThrow('Invalid SHE-63 admission state');
  await writeFile(join(root,'state.json'),JSON.stringify({nextAllowedAt:0}));const lease=await acquireShe63Admission(root);await lease.release();
 }finally{await rm(root,{recursive:true,force:true});}
});
test('hooks preserve a real429 as failure, retain evidence and release for subsequent cases',async()=>{
 const root=await directory(),previous=process.env.HBL_SHE63_ADMISSION_DIR;process.env.HBL_SHE63_ADMISSION_DIR=root;
 let before,after;const page=new EventEmitter(),attachments=[],info={timeout:5000,attach:async(name,data)=>attachments.push({name,...data})};
 try{
  installShe63Admission({beforeEach:fn=>before=fn,afterEach:fn=>after=fn});await before({page},info);
  const request={method:()=> 'POST',url:()=> 'http://local/api/city-experiments'};page.emit('request',request);page.emit('response',{request:()=>request,url:request.url,status:()=>429,headers:()=>({'retry-after':'49'})});
  await expect(after({},info)).rejects.toThrow('Real HTTP429');expect(attachments[0].body).toContain('49');expect(page.listenerCount('request')).toBe(0);expect(page.listenerCount('response')).toBe(0);
  let time=Date.now()+120000;const lease=await acquireShe63Admission(root,{now:()=>time});await lease.release();
 }finally{if(previous===undefined)delete process.env.HBL_SHE63_ADMISSION_DIR;else process.env.HBL_SHE63_ADMISSION_DIR=previous;await rm(root,{recursive:true,force:true});}
});
