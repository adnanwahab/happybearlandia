import {mkdir,readFile,readdir,rm,stat,writeFile,mkdtemp,rename} from 'node:fs/promises';
import {appendFileSync,readFileSync} from 'node:fs';
import {tmpdir,freemem,totalmem} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

function processRss(pid:number){try{if(process.platform==='linux'){const text=readFileSync(`/proc/${pid}/status`,'utf8');return Number(text.match(/^VmRSS:\s+(\d+)\s+kB/m)?.[1])*1024;}if(process.platform==='darwin'){const text=execFileSync('ps',['-o','rss=','-p',String(pid)],{encoding:'utf8',timeout:1000,stdio:['ignore','pipe','ignore']});return Number(text.trim())*1024;}}catch{}return null;}
const abortError=()=>Object.assign(new Error('Browser job interrupted'),{name:'AbortError'});
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error:any){return error.code!=='ESRCH';}};
const positive=(value:any,fallback:number,label:string,max=64)=>{if(value===undefined)return fallback;const n=Number(value);if(!Number.isInteger(n)||n<1||n>max)throw Error(`${label} must be an integer from 1 to ${max}`);return n;};
const sleep=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal?.aborted)return reject(abortError());
 const done=()=>{signal?.removeEventListener('abort',cancel);resolve();};
 const timer=setTimeout(done,ms),cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(abortError());};signal?.addEventListener('abort',cancel,{once:true});
});
async function json(file:string,value:any){const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temporary,file);}
async function owner(directory:string){try{return JSON.parse(await readFile(path.join(directory,'owner.json'),'utf8'));}catch{return null;}}
async function reclaim(directory:string,pidAlive:(pid:number)=>boolean){
 const value=await owner(directory);let info;try{info=await stat(directory);}catch{return false;}
 if(Number.isInteger(value?.pid)&&value.pid>0){if(pidAlive(value.pid)||(value.browserPids??[]).some((pid:number)=>Number.isInteger(pid)&&pid>0&&pidAlive(pid)))return false;}
 else if(Date.now()-info.mtimeMs<=5000)return false;
 const key=String(value?.nonce??`inode-${info.ino}`).replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,100);
 // Keep nonempty quarantine tombstones. Two reapers of the same incarnation
 // then cannot rename/delete a new live lock that reused the original path.
 const quarantine=path.join(path.dirname(directory),`.reclaimed-${path.basename(directory)}-${key}`);
 try{await writeFile(path.join(directory,'reclaim.json'),JSON.stringify({pid:process.pid,key}),{flag:'wx',mode:0o600});}catch(error:any){if(!['EEXIST','ENOENT'].includes(error.code))throw error;}
 const current=await owner(directory);if(value?.nonce&&current?.nonce!==value.nonce)return false;
 try{await rename(directory,quarantine);return true;}catch(error:any){if(['ENOENT','EEXIST','ENOTEMPTY'].includes(error.code))return false;throw error;}
}
async function gate(root:string,signal:AbortSignal|undefined,pidAlive:(pid:number)=>boolean){
 const directory=path.join(root,'admission.lock'),nonce=randomUUID();
 for(;;){
  if(signal?.aborted)throw abortError();
  try{await mkdir(directory);await json(path.join(directory,'owner.json'),{pid:process.pid,nonce});return async()=>{if((await owner(directory))?.nonce===nonce)await rm(directory,{recursive:true,force:true});};}
  catch(error:any){if(error.code!=='EEXIST')throw error;if(!await reclaim(directory,pidAlive))await sleep(25,signal);}
 }
}

export type BrowserLeaseOptions={artifactDirectory:string;signal?:AbortSignal;maxJobs?:number;slotDirectory?:string;minFreeBytes?:number;pollMs?:number;memoryInfo?:()=>{freeBytes:number;totalBytes:number};pidAlive?:(pid:number)=>boolean};
/** Cooperative host-wide job admission across worktrees/processes. A lease covers
 * one browser job; callers keep Playwright workers=1 and release after shutdown.
 * OS free memory is a conservative proxy, not physical-device memory telemetry. */
export async function acquireBrowserJob(options:BrowserLeaseOptions){
 if(!options.artifactDirectory)throw Error('Browser job artifactDirectory required');
 const limit=positive(options.maxJobs??process.env.HBL_BROWSER_JOB_LIMIT,3,'HBL_BROWSER_JOB_LIMIT');
 const minimum=positive(options.minFreeBytes??process.env.HBL_BROWSER_MIN_FREE_BYTES,512*1024*1024,'HBL_BROWSER_MIN_FREE_BYTES',Number.MAX_SAFE_INTEGER);
 const root=options.slotDirectory??process.env.HBL_BROWSER_JOB_DIRECTORY??path.join(tmpdir(),`hbl-browser-jobs-v1-${process.getuid?.()??'user'}`);
 await mkdir(root,{recursive:true,mode:0o700});await mkdir(options.artifactDirectory,{recursive:true});
 const directory=await mkdtemp(path.join(options.artifactDirectory,'browser-job-')),started=Date.now(),pidAlive=options.pidAlive??alive;
 const events=path.join(directory,'admission.jsonl'),event=(row:any)=>appendFileSync(events,JSON.stringify({at:new Date().toISOString(),...row})+'\n',{mode:0o600});
 let lastLimit:number|undefined,lastSnapshot=0;
 try{for(;;){
  if(options.signal?.aborted)throw abortError();
  const memory=(options.memoryInfo??(()=>({freeBytes:freemem(),totalBytes:totalmem()})))();
  const memoryKnown=Number.isFinite(memory.freeBytes)&&Number.isFinite(memory.totalBytes)&&memory.totalBytes>0&&memory.freeBytes>=0;
  const ratio=memoryKnown?memory.freeBytes/memory.totalBytes:1;
  const pressureLimit=memoryKnown&&(memory.freeBytes<minimum||ratio<.08)?1:memoryKnown&&ratio<.16?2:limit;
  const admissionLimit=Math.min(limit,pressureLimit);
  if(Date.now()-lastSnapshot>=1000){event({event:'monitor',state:'queued',queueWaitMs:Date.now()-started,driverRssBytes:process.memoryUsage().rss,memory:{...memory,source:'os-free-memory-proxy'},admissionLimit});lastSnapshot=Date.now();}
  if(lastLimit!==admissionLimit){event({event:'admission_limit',configuredLimit:limit,admissionLimit,memory:{...memory,source:'os-free-memory-proxy'}});lastLimit=admissionLimit;}
  const unlock=await gate(root,options.signal,pidAlive);let claim:any=null;
  try{
   const slots=(await readdir(root)).filter(name=>/^slot-\d+$/.test(name));const occupied=new Set<number>();
   for(const name of slots){const location=path.join(root,name);if(await reclaim(location,pidAlive)){event({event:'stale_reclaimed',slot:name});}else occupied.add(Number(name.slice(5)));}
   if(options.signal?.aborted)throw abortError();
   if(occupied.size<admissionLimit){
    let slot=0;while(occupied.has(slot))slot++;
    const location=path.join(root,`slot-${slot}`),nonce=randomUUID();await mkdir(location);
    await json(path.join(location,'owner.json'),{pid:process.pid,nonce,createdAt:new Date().toISOString(),directory,browserPids:[]});
    claim={slot,location,nonce};
   }
  }finally{await unlock();}
  if(claim){
   const {slot,location,nonce}=claim;
   if(options.signal?.aborted){if((await owner(location))?.nonce===nonce)await rm(location,{recursive:true,force:true});throw abortError();}
   const queueWaitMs=Date.now()-started;event({event:'acquired',slot,queueWaitMs,admissionLimit,pid:process.pid});let released=false;
   const monitor=setInterval(()=>{try{const memory=(options.memoryInfo??(()=>({freeBytes:freemem(),totalBytes:totalmem()})))();event({event:'monitor',state:'active',slot,driverRssBytes:process.memoryUsage().rss,memory:{...memory,source:'os-free-memory-proxy'}});}catch{}},1000);monitor.unref?.();
   return {directory,slot,queueWaitMs,admissionLimit,memory,registerProcess:async(pid:number)=>{const value=await owner(location);if(value?.nonce!==nonce)throw Error('Browser lease ownership changed');if(!Number.isInteger(pid)||pid<1)throw Error('Invalid owned browser PID');value.browserPids=[...new Set([...(value.browserPids??[]),pid])];await json(path.join(location,'owner.json'),value);},release:async()=>{if(released)return;const value=await owner(location);if(value?.nonce===nonce&&(value.browserPids??[]).some((pid:number)=>pidAlive(pid)))throw Object.assign(Error('Browser process still running; lease retained'),{browserStillRunning:true});released=true;clearInterval(monitor);if(value?.nonce===nonce)await rm(location,{recursive:true,force:true});event({event:'released',slot,pid:process.pid});}};
  }
  await sleep(options.pollMs??100,options.signal);
 }}catch(error:any){event({event:options.signal?.aborted?'cancelled':'failed',error:error.message});throw error;}
}

export function classifyBrowserStartupFailure(error:any){
 const message=String(error?.message??error);
 if(/executable.*(?:doesn.t exist|not found)|distribution.*not found|playwright install|ENOENT/i.test(message))return {category:'missing-browser',retryable:false};
 if(/EPERM|EACCES|operation not permitted|permission denied/i.test(message))return {category:'permission',retryable:false};
 if(/ENOMEM|EAGAIN|cannot allocate memory|resource temporarily unavailable|pthread_create/i.test(message))return {category:'resource-pressure',retryable:true};
 if(/SIGTRAP|SIGSEGV|SIGABRT|EXC_BAD_ACCESS|MachPortRendezvous|bootstrap_check_in|GPU process.*(?:exited|crash|isn.t usable)/i.test(message))return {category:'startup-crash',retryable:true};
 return {category:'startup-failure',retryable:false};
}
export type ReliableBrowserOptions={artifactDirectory:string;launchOptions?:any;signal?:AbortSignal;maxStartupRetries?:number;retryDelayMs?:number;cleanupTimeoutMs?:number;lease?:{registerProcess:(pid:number)=>Promise<void>}};
/** Launch-only retries. Once connected, crashes and assertion failures propagate;
 * no test retry occurs here. Caller owns its acquireBrowserJob lease. */
export async function launchReliableBrowser(browserType:any,options:ReliableBrowserOptions){
 if(!options.artifactDirectory)throw Error('Browser launch artifactDirectory required');
 const retries=options.maxStartupRetries??2;if(!Number.isInteger(retries)||retries<0||retries>2)throw Error('Browser startup retries must be 0–2');
 const backoff=options.retryDelayMs??250;if(!Number.isFinite(backoff)||backoff<0||backoff>2000)throw Error('Browser startup backoff must be 0–2000ms');
 await mkdir(options.artifactDirectory,{recursive:true});const attempts:any[]=[];
 const cleanupTimeout=positive(options.cleanupTimeoutMs,2000,'cleanupTimeoutMs',5000);
 const launchOptions={headless:true,timeout:30000,...(browserType.name?.()==='chromium'?{channel:'chromium'}:{}),...options.launchOptions};
 positive(launchOptions.timeout,30000,'Browser launch timeout',120000);
 for(let number=0;number<=retries;number++){
  if(options.signal?.aborted)throw abortError();
  const directory=await mkdtemp(path.join(options.artifactDirectory,`attempt-${number+1}-`)),record:any={attempt:number+1,status:'launching',startedAt:new Date().toISOString(),directory,engine:browserType.name?.()??'unknown',requestedChannel:launchOptions.channel??'bundled',requestedExecutable:launchOptions.executablePath??null,executable:null,pid:null,exitCode:null,signal:null,stderrFile:path.join(directory,'stderr.log'),launchLogFile:path.join(directory,'launch.log')};
  attempts.push(record);await writeFile(record.stderrFile,'',{mode:0o600});await writeFile(record.launchLogFile,'',{mode:0o600});let server:any,browser:any,child:any,closing:Promise<void>|undefined,requestedClose=false,abortListener:(()=>void)|undefined,processMonitor:ReturnType<typeof setInterval>|undefined;
  const event=(row:any)=>appendFileSync(path.join(directory,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),...row})+'\n',{mode:0o600});
  let saving=Promise.resolve();const save=()=>saving=saving.catch(()=>{}).then(()=>json(path.join(directory,'attempt.json'),record));
  const gone=()=>!child||child.exitCode!==null&&child.exitCode!==undefined||Boolean(child.signalCode);
  const bounded=(work:()=>Promise<any>)=>new Promise<boolean>(resolve=>{let settled=false;const timer=setTimeout(()=>{if(!settled){settled=true;resolve(false);}},cleanupTimeout);Promise.resolve().then(work).then(()=>{if(!settled){settled=true;clearTimeout(timer);resolve(true);}},()=>{if(!settled){settled=true;clearTimeout(timer);resolve(false);}});});
  const close=()=>closing??=(async()=>{
   requestedClose=true;clearInterval(processMonitor);
   await bounded(async()=>{try{await browser?.close();}finally{await server?.close();}});
   if(!gone()){await bounded(()=>server.kill());if(!gone()){try{child.kill?.('SIGKILL');}catch{}await bounded(()=>new Promise<void>(resolve=>{if(gone())resolve();else child.once('exit',()=>resolve());}));}}
   record.closedAt=new Date().toISOString();if(child){record.exitCode=child.exitCode;record.signal=child.signalCode;}
   if(!gone()){record.status='cleanup-failed';await save();throw Object.assign(Error('Owned browser process could not be stopped; lease must remain held'),{browserStillRunning:true,browserPid:record.pid,browserAttempts:attempts});}
   record.status=record.status==='connected'?'closed':record.status;await save();
  })();
  const originalLogger=launchOptions.logger;
  const parseLog=(message:string)=>{const pid=message.match(/<launched>\s+pid=(\d+)/),executable=message.match(/<launching>\s+(.+?)(?:\s+--|\n|$)/),exit=message.match(/exitCode=([^,\s]+),\s*signal=([^>\s]+)/);if(pid)record.pid=Number(pid[1]);if(executable)record.executable=executable[1];if(exit){record.exitCode=exit[1]==='null'?null:Number(exit[1]);record.signal=exit[2]==='null'?null:exit[2];}
   if(!child){for(const line of message.split('\n')){const stderr=line.match(/\[pid[^\]]*\]\[err\]\s?(.*)/);if(stderr)appendFileSync(record.stderrFile,stderr[1]+'\n',{mode:0o600});}}};
  const logger={isEnabled:()=>true,log(name:string,severity:string,message:string,...args:any[]){parseLog(String(message));appendFileSync(record.launchLogFile,`${name} ${severity} ${message}\n`,{mode:0o600});originalLogger?.log?.(name,severity,message,...args);}};
  try{
   // launchServer provides the real process handle. A cancellation during launch
   // waits for this bounded startup to settle, then closes it before returning.
   server=await browserType.launchServer({...launchOptions,logger});child=server.process();record.pid=child.pid??null;record.executable=child.spawnfile??record.executable;if(record.pid)await options.lease?.registerProcess(record.pid);
   const stderr=(chunk:any)=>appendFileSync(record.stderrFile,chunk,{mode:0o600});child.stderr?.on('data',stderr);
   child.once('exit',(code:any,signal:any)=>{clearInterval(processMonitor);if(record.status==='connected'&&!requestedClose)record.status='crashed';record.exitCode=code;record.signal=signal;record.exitedAt=new Date().toISOString();event({event:'process_exit',pid:record.pid,exitCode:code,signal,requestedClose});void save().catch(()=>{});});
   event({event:'process_observed',pid:record.pid,executable:record.executable});
   const monitor=()=>{try{event({event:'monitor',pid:record.pid,browserParentRssBytes:processRss(record.pid),driverRssBytes:process.memoryUsage().rss,memory:{freeBytes:freemem(),totalBytes:totalmem(),source:'os-free-memory-proxy'},rssScope:'browser parent process only; excludes child/GPU processes'});}catch{}};monitor();processMonitor=setInterval(monitor,1000);processMonitor.unref?.();
   if(options.signal?.aborted)throw abortError();
   browser=await browserType.connect(server.wsEndpoint(),{timeout:launchOptions.timeout});
   if(options.signal?.aborted)throw abortError();
   abortListener=()=>{void close().catch(()=>{});};options.signal?.addEventListener('abort',abortListener,{once:true});
   if(options.signal?.aborted)throw abortError();
   record.status='connected';record.connectedAt=new Date().toISOString();await save();
   if(options.signal?.aborted){await close();throw abortError();}
   return {browser,server,attempts,close:async()=>{options.signal?.removeEventListener('abort',abortListener!);await close();}};
  }catch(error:any){
   if(abortListener)options.signal?.removeEventListener('abort',abortListener);
   record.status=options.signal?.aborted?'cancelled':'launch-failed';record.error=String(error?.message??error);record.classification=classifyBrowserStartupFailure(error);
   // Failed launchServer calls do not expose a process; retain the original
   // Playwright process log and report absent metadata as null, never infer it.
   parseLog(record.error);appendFileSync(record.launchLogFile,record.error+'\n',{mode:0o600});
   const pid=record.error.match(/<launched>\s+pid=(\d+)/),exit=record.error.match(/exitCode=([^,\s]+),\s*signal=([^>\s]+)/),executable=record.error.match(/<launching>\s+(.+?)(?:\s+--|\n)/);
   if(record.pid===null&&pid)record.pid=Number(pid[1]);if(executable)record.executable=executable[1];
   if(exit){record.exitCode=exit[1]==='null'?null:Number(exit[1]);record.signal=exit[2]==='null'?null:exit[2];}
   await close();await save();event({event:'startup_failed',classification:record.classification,pid:record.pid,exitCode:record.exitCode,signal:record.signal});
   if(options.signal?.aborted)throw abortError();
   if(number===retries||!record.classification.retryable){error.browserAttempts=attempts;throw error;}
   record.retryScheduledMs=Math.min(2000,backoff*(number+1));await save();await sleep(record.retryScheduledMs,options.signal);
  }
 }
 throw Error('Browser startup exhausted');
}
