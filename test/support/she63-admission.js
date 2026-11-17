import {mkdir,readFile,stat,rename,rm} from 'node:fs/promises';
import {readFileSync,writeFileSync,renameSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {isSimulationSubmission} from '../../ops/security/simulation-admission.js';

const interrupted=()=>Object.assign(Error('SHE-63 admission wait interrupted'),{name:'AbortError'});
function wait(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(interrupted());
 const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};
 const timer=setTimeout(finish,ms),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(interrupted());};
 signal?.addEventListener('abort',abort,{once:true});
});}
const live=pid=>{try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}};
async function owner(directory){try{return JSON.parse(await readFile(join(directory,'owner.json'),'utf8'));}catch{return null;}}
function state(root){try{const value=JSON.parse(readFileSync(join(root,'state.json'),'utf8'));if(!Number.isFinite(value.nextAllowedAt)||value.nextAllowedAt<0)throw Error('Invalid SHE-63 admission state');return value;}catch(error){if(error.code==='ENOENT')return {nextAllowedAt:0};throw error;}}
function save(root,value){const temporary=join(root,randomUUID()+'.tmp');writeFileSync(temporary,JSON.stringify(value),{mode:0o600});renameSync(temporary,join(root,'state.json'));}
const event=(root,row)=>appendFileSync(join(root,'admission.jsonl'),JSON.stringify({at:new Date().toISOString(),...row})+'\n',{mode:0o600});

export function retryAfterDeadline(value,now=Date.now()){
 if(!value)return null;
 if(/^\d+$/.test(value))return now+Number(value)*1000;
 const time=Date.parse(value);return Number.isFinite(time)?Math.max(now,time):null;
}

/** Run-scoped case lease. Never changes the server's admission limits, intercepts
 * requests, retries tests, or fabricates model responses. Case entry waits until
 * a full production minute plus 1s margin after the last observed submission. */
export async function acquireShe63Admission(root,{signal,now=Date.now,delay=wait}={}){
 await mkdir(root,{recursive:true,mode:0o700});
 const lock=join(root,'case.lock'),nonce=randomUUID();
 for(;;){
  if(signal?.aborted)throw interrupted();
  try{await mkdir(lock);writeFileSync(join(lock,'owner.json'),JSON.stringify({pid:process.pid,nonce}),{mode:0o600});break;}
  catch(error){
   if(error.code!=='EEXIST')throw error;
   const previous=await owner(lock);let info;try{info=await stat(lock);}catch{continue;}
   if(previous?.pid?live(previous.pid):Date.now()-info.mtimeMs<5000){await delay(25,signal);continue;}
   // Nonempty incarnation-specific tombstones prevent competing reapers from
   // renaming a replacement live lease after another reaper has reclaimed it.
   try{writeFileSync(join(lock,'reclaim.json'),'{}',{flag:'wx',mode:0o600});}catch(error){if(!['EEXIST','ENOENT'].includes(error.code))throw error;}
   if((await owner(lock))?.nonce!==previous?.nonce)continue;
   try{await rename(lock,join(root,`.reclaimed-${previous?.nonce??info.ino}`));}catch(error){if(!['ENOENT','EEXIST','ENOTEMPTY'].includes(error.code))throw error;}
  }
 }
 let released=false;
 const release=async()=>{if(released)return;if((await owner(lock))?.nonce===nonce)await rm(lock,{recursive:true,force:true});released=true;event(root,{event:'released',nonce});};
 try{
  if(signal?.aborted)throw interrupted();
  const remaining=Math.max(0,state(root).nextAllowedAt-now());
  event(root,{event:'case_wait',nonce,waitMs:remaining});if(remaining)await delay(remaining,signal);
  if(signal?.aborted)throw interrupted();
  event(root,{event:'case_admitted',nonce});
  return {release,observe({phase,method,url,status,retryAfter}){
   if(released)throw Error('Cannot observe a released admission lease');
   if(!isSimulationSubmission({method,url}))return false;
   const observedAt=now(),previous=state(root),retryAt=status===429?retryAfterDeadline(retryAfter,observedAt):null;
   save(root,{nextAllowedAt:Math.max(previous.nextAllowedAt,observedAt+61000,retryAt??0)});
   event(root,{event:'submission',phase,method,path:new URL(url).pathname,status:status??null,retryAfter:retryAfter??null,observedAt});return true;
  }};
 }catch(error){await release();throw error;}
}

/** Hooks only opt into the SHE-63 runner's explicitly supplied run directory. */
export function installShe63Admission(test){
 const root=process.env.HBL_SHE63_ADMISSION_DIR;if(!root)return;
 let active;
 test.beforeEach(async({page},info)=>{
  const controller=new AbortController();active={controller,page,requests:0,limited:[],lease:null};
  const timer=setTimeout(()=>controller.abort(),Math.max(1,info.timeout-1000));
  try{active.lease=await acquireShe63Admission(root,{signal:controller.signal});}finally{clearTimeout(timer);}
  active.request=request=>{if(active.lease.observe({phase:'request',method:request.method(),url:request.url()}))active.requests++;};
  active.response=response=>{const request=response.request();active.lease.observe({phase:'response',method:request.method(),url:response.url(),status:response.status(),retryAfter:response.headers()['retry-after']});if(response.status()===429&&isSimulationSubmission({method:request.method(),url:response.url()}))active.limited.push({path:new URL(response.url()).pathname,retryAfter:response.headers()['retry-after']??null});};
  page.on('request',active.request);page.on('response',active.response);
 });
 test.afterEach(async({},info)=>{
  if(!active)return;const current=active;active=null;current.controller.abort();
  if(current.request)current.page.off('request',current.request);if(current.response)current.page.off('response',current.response);
  try{await info.attach('submission-admission',{body:JSON.stringify({requests:current.requests,rateLimited:current.limited}),contentType:'application/json'});}
  finally{await current.lease?.release();}
  if(current.limited.length)throw Error(`Real HTTP429 admission failure: ${JSON.stringify(current.limited)}`);
  if(current.requests>6)throw Error(`Case submitted ${current.requests} requests; exceeds unchanged six-per-minute contract`);
 });
}
