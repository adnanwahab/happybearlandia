import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {acquireBrowserJob,launchReliableBrowser,classifyBrowserStartupFailure} from './browser-runtime';
const temporary=()=>mkdtemp(path.join(tmpdir(),'hbl-browser-runtime-test-'));
const highMemory=()=>({freeBytes:8e9,totalBytes:16e9});
const options=(root:string)=>({artifactDirectory:path.join(root,'artifacts'),slotDirectory:path.join(root,'slots'),maxJobs:3,memoryInfo:highMemory,pollMs:10});

test('three host-wide slots queue the fourth and cancellation never releases an active owner',async()=>{
 const root=await temporary(),leases:any[]=[];try{
  for(let i=0;i<3;i++)leases.push(await acquireBrowserJob(options(root)));
  const controller=new AbortController();let acquired=false;const fourth=acquireBrowserJob({...options(root),signal:controller.signal}).then(lease=>{acquired=true;return lease;});
  await Bun.sleep(40);expect(acquired).toBe(false);controller.abort();await expect(fourth).rejects.toThrow('interrupted');
  expect((await readdir(path.join(root,'slots'))).filter(n=>n.startsWith('slot-'))).toHaveLength(3);
  await leases.pop().release();const next=await acquireBrowserJob(options(root));leases.push(next);expect(next.slot).toBe(2);expect(new Set(leases.map(l=>l.directory)).size).toBe(3);
 }finally{await Promise.all(leases.map(l=>l.release()));await rm(root,{recursive:true,force:true});}
});
test('memory pressure reduces admission without killing or evicting existing jobs, then recovers',async()=>{
 const root=await temporary(),leases:any[]=[];try{
  for(let i=0;i<2;i++)leases.push(await acquireBrowserJob(options(root)));
  let memory={freeBytes:100e6,totalBytes:16e9};let entered=false;
  const waiting=acquireBrowserJob({...options(root),memoryInfo:()=>memory}).then(l=>{entered=true;return l;});await Bun.sleep(40);expect(entered).toBe(false);
  expect((await readdir(path.join(root,'slots'))).filter(n=>n.startsWith('slot-'))).toHaveLength(2);
  memory=highMemory();const third=await waiting;leases.push(third);expect(third.admissionLimit).toBe(3);
  const events=await readFile(path.join(third.directory,'admission.jsonl'),'utf8');expect(events).toContain('"admissionLimit":1');expect(events).toContain('"admissionLimit":3');
 }finally{await Promise.all(leases.map(l=>l.release()));await rm(root,{recursive:true,force:true});}
});
test('only dead PID owners are reclaimed, with quarantine preventing reuse races',async()=>{
 const root=await temporary();let lease:any;try{
  await mkdir(path.join(root,'slots','slot-0'),{recursive:true});await writeFile(path.join(root,'slots','slot-0','owner.json'),JSON.stringify({pid:999999999,nonce:'dead-owner'}));
  lease=await acquireBrowserJob({...options(root),pidAlive:pid=>pid===process.pid});expect(lease.slot).toBe(0);
  expect((await readdir(path.join(root,'slots'))).some(n=>n.startsWith('.reclaimed-slot-0-dead-owner'))).toBe(true);
  await lease.release();await lease.release();
 }finally{await lease?.release();await rm(root,{recursive:true,force:true});}
});
test('independent processes share the same three slots',async()=>{
 const root=await temporary();try{
  const module=new URL('./browser-runtime.ts',import.meta.url).pathname;
  const script=`import {acquireBrowserJob} from ${JSON.stringify(module)};import {appendFileSync} from 'node:fs';const l=await acquireBrowserJob({artifactDirectory:process.env.TEST_ARTIFACTS,slotDirectory:process.env.TEST_SLOTS,maxJobs:3,memoryInfo:()=>({freeBytes:8e9,totalBytes:16e9}),pollMs:5});appendFileSync(process.env.TEST_EVENTS,JSON.stringify({event:'start',pid:process.pid})+'\\n');await Bun.sleep(80);appendFileSync(process.env.TEST_EVENTS,JSON.stringify({event:'end',pid:process.pid})+'\\n');await l.release();`;
  const children=Array.from({length:6},()=>Bun.spawn([process.execPath,'--no-env-file','-e',script],{env:{...process.env,TEST_ARTIFACTS:path.join(root,'artifacts'),TEST_SLOTS:path.join(root,'slots'),TEST_EVENTS:path.join(root,'events.jsonl')},stdout:'pipe',stderr:'pipe'}));
  for(const child of children){const code=await child.exited;if(code!==0)throw Error(await new Response(child.stderr).text());}
  let active=0,peak=0;for(const line of (await readFile(path.join(root,'events.jsonl'),'utf8')).trim().split('\n')){active+=JSON.parse(line).event==='start'?1:-1;peak=Math.max(peak,active);expect(active).toBeLessThanOrEqual(3);}expect(peak).toBe(3);expect(active).toBe(0);
 }finally{await rm(root,{recursive:true,force:true});}
});
function fakeType(failures:string[]=[]){
 let count=0;const servers:any[]=[];
 const type={name:()=> 'chromium',executablePath:()=>'/bundled/guess-must-not-be-used',async launchServer(options:any){
  count++;options.logger.log('browser','info','<launching> /exact/chromium --headless',[],{});options.logger.log('browser','info',`<launched> pid=${process.pid}`,[],{});
  if(failures.length){const message=failures.shift()!;options.logger.log('browser','error',`[pid=${process.pid}][err] HIServices startup detail`,[],{});throw Error(message);}
  const child:any=new EventEmitter();child.pid=process.pid;child.spawnfile='/exact/chromium';child.stderr=new EventEmitter();child.exitCode=null;child.signalCode=null;
  const server={process:()=>child,wsEndpoint:()=> 'ws://fixture',close:async()=>{child.exitCode=0;child.emit('exit',0,null);},kill:async()=>{child.signalCode='SIGKILL';child.emit('exit',null,'SIGKILL');}};servers.push(server);return server;
 },connect:async()=>({close:async()=>{}})};return {type,servers,get count(){return count;}};
}
test('startup-only transient retries preserve every failed attempt and exact process evidence',async()=>{
 const root=await temporary();try{const f=fakeType(['launch <process did exit: exitCode=null, signal=SIGTRAP>']);const session=await launchReliableBrowser(f.type,{artifactDirectory:root,retryDelayMs:0});
  expect(f.count).toBe(2);expect(session.attempts).toHaveLength(2);expect(session.attempts[0]).toMatchObject({executable:'/exact/chromium',pid:process.pid,signal:'SIGTRAP',status:'launch-failed'});
  expect(await readFile(session.attempts[0].stderrFile,'utf8')).toContain('HIServices');await session.close();await session.close();expect(session.attempts[1].exitCode).toBe(0);
  expect(JSON.parse(await readFile(path.join(session.attempts[1].directory,'attempt.json'),'utf8')).status).toBe('closed');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing browser and permission failures never retry; repeated startup crashes stop after two retries',async()=>{
 const root=await temporary();try{
  for(const message of ['Executable does not exist; run playwright install','EPERM: operation not permitted']){const f=fakeType([message]);await expect(launchReliableBrowser(f.type,{artifactDirectory:root,retryDelayMs:0})).rejects.toThrow(message);expect(f.count).toBe(1);}
  const f=fakeType(['SIGTRAP','SIGTRAP','SIGTRAP']);await expect(launchReliableBrowser(f.type,{artifactDirectory:root,retryDelayMs:0})).rejects.toThrow('SIGTRAP');expect(f.count).toBe(3);
  expect(classifyBrowserStartupFailure('ordinary assertion failure').retryable).toBe(false);expect(classifyBrowserStartupFailure('signal=SIGABRT').retryable).toBe(true);expect(classifyBrowserStartupFailure('EPERM signal=SIGABRT').retryable).toBe(false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('cancellation closes a late successful startup and never retries or leaks its process',async()=>{
 const root=await temporary();try{const f=fakeType(),launch=f.type.launchServer;const controller=new AbortController();f.type.launchServer=async options=>{await Bun.sleep(20);return launch(options);};
  const pending=launchReliableBrowser(f.type,{artifactDirectory:root,signal:controller.signal});controller.abort();await expect(pending).rejects.toThrow('interrupted');expect(f.count).toBe(0);
  const second=new AbortController();const late=launchReliableBrowser(f.type,{artifactDirectory:root,signal:second.signal});await Bun.sleep(5);second.abort();await expect(late).rejects.toThrow('interrupted');expect(f.count).toBe(1);expect(f.servers[0].process().exitCode).toBe(0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test.skipIf(!process.env.HBL_BROWSER_RUNTIME_REAL)('real bundled Chromium launchServer owns process evidence and normal pointer interaction',async()=>{
 const {chromium}=await import('@playwright/test'),root=await temporary();let lease:any,session:any;try{
  lease=await acquireBrowserJob({artifactDirectory:root});session=await launchReliableBrowser(chromium,{artifactDirectory:lease.directory,maxStartupRetries:0,launchOptions:{timeout:15000}});
  const context=await session.browser.newContext(),page=await context.newPage();await page.setContent('<button onclick="this.textContent=\'clicked\'">Choose</button>');await page.getByRole('button',{name:'Choose'}).click();expect(await page.getByRole('button').textContent()).toBe('clicked');await context.close();
  expect(session.server.process().pid).toBe(session.attempts[0].pid);expect(session.attempts[0].executable).toBe(session.server.process().spawnfile);await session.close();expect(session.attempts[0].exitCode===0||session.attempts[0].signal!==null).toBe(true);
 }finally{await session?.close();await lease?.release();await rm(root,{recursive:true,force:true});}
},30000);

test('abort during final launch bookkeeping closes the browser rather than returning a live session',async()=>{
 const root=await temporary();try{
  const f=fakeType(),controller=new AbortController(),add=controller.signal.addEventListener.bind(controller.signal);
  controller.signal.addEventListener=((...args:any[])=>{add(...args as Parameters<typeof add>);queueMicrotask(()=>controller.abort());}) as typeof controller.signal.addEventListener;
  await expect(launchReliableBrowser(f.type,{artifactDirectory:root,signal:controller.signal})).rejects.toThrow('interrupted');
  expect(f.count).toBe(1);expect(f.servers[0].process().exitCode).toBe(0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('bounded graceful shutdown escalates only its owned server and fails closed if it remains alive',async()=>{
 const root=await temporary();try{
  const f=fakeType(),session=await launchReliableBrowser(f.type,{artifactDirectory:root,cleanupTimeoutMs:10});
  f.servers[0].close=()=>new Promise(()=>{});const started=Date.now();await session.close();expect(Date.now()-started).toBeLessThan(500);expect(f.servers[0].process().signalCode).toBe('SIGKILL');
  const g=fakeType(),stuck=await launchReliableBrowser(g.type,{artifactDirectory:root,cleanupTimeoutMs:10});g.servers[0].close=()=>new Promise(()=>{});g.servers[0].kill=()=>new Promise(()=>{});
  let failure:any;try{await stuck.close();}catch(error){failure=error;}expect(failure?.browserStillRunning).toBe(true);expect(stuck.attempts[0].status).toBe('cleanup-failed');
  // End the injected fake process; no real process is signaled by this test.
  g.servers[0].process().exitCode=0;g.servers[0].process().emit('exit',0,null);
  await expect(launchReliableBrowser(f.type,{artifactDirectory:root,launchOptions:{timeout:0}})).rejects.toThrow('Browser launch timeout');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('leases retain live owned browser PIDs even after the driver dies and refuse premature release',async()=>{
 const root=await temporary();let lease:any,browserAlive=true;try{
  const pidAlive=(pid:number)=>pid===process.pid||pid===12345&&browserAlive;
  lease=await acquireBrowserJob({...options(root),pidAlive});await lease.registerProcess(12345);
  await expect(lease.release()).rejects.toThrow('Browser process still running');
  const location=path.join(root,'slots',`slot-${lease.slot}`),value=JSON.parse(await readFile(path.join(location,'owner.json'),'utf8'));value.pid=999999999;await writeFile(path.join(location,'owner.json'),JSON.stringify(value));
  const next=await acquireBrowserJob({...options(root),pidAlive});expect(next.slot).toBe(1);await next.release();
  browserAlive=false;await lease.release();expect((await readdir(path.join(root,'slots'))).filter(n=>n.startsWith('slot-'))).toHaveLength(0);
 }finally{browserAlive=false;await lease?.release();await rm(root,{recursive:true,force:true});}
});
