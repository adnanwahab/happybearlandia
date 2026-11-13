import path from 'node:path';
import { mkdir, appendFile, writeFile, rename } from 'node:fs/promises';
import { redactTelemetry, formatTelemetryLine } from './telemetry-format.js';
export async function createSessionTelemetry({root,name,repository,heartbeatMs=15000,onError=(message:string)=>console.error(message)}:{root:string;name:string;repository:string;heartbeatMs?:number;onError?:(message:string)=>void}) {
  const sessionId=crypto.randomUUID(), started=performance.now(), dir=path.join(root,'telemetry','sessions',sessionId);
  await mkdir(dir,{recursive:true,mode:0o700});
  const secrets=Object.entries(process.env).filter(([key])=>/token|secret|password|api_key/i.test(key)).map(([,value])=>value!).filter(Boolean);
  let phase='starting', seq=0, writes=Promise.resolve(), failed=false, ended=false;
  const active=new Map<string,string>();let backgroundPhase='waiting';
  const event=(type:string,message:string,details:Record<string,any>={},taskId?:string)=>{
    if(ended||failed)return Promise.resolve();
    const cleanDetails=Object.fromEntries(Object.entries(details).map(([key,value])=>[key,typeof value==='string'?redactTelemetry(value,secrets):typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean'||value===null?value:'[omitted]']));
    const record={schemaVersion:1,sessionId,seq:seq++,at:new Date().toISOString(),elapsedMs:Math.max(0,performance.now()-started),type,phase,...(taskId?{taskId}:{}),message:redactTelemetry(message,secrets),details:cleanDetails};
    writes=writes.then(async()=>{
      await appendFile(path.join(dir,'events.jsonl'),JSON.stringify(record)+'\n',{mode:0o600});
      await appendFile(path.join(dir,'session.log'),formatTelemetryLine(record),{mode:0o600});
      const current=path.join(root,'telemetry','current.json'),tmp=`${current}.${sessionId}.tmp`;
      await writeFile(tmp,JSON.stringify({sessionId,phase:record.phase,lastSeenAt:record.at,elapsedMs:record.elapsedMs})+'\n',{mode:0o600});await rename(tmp,current);
    }).catch(()=>{if(!failed){failed=true;onError('Mini Symphony session logging failed; heartbeat evidence has stopped. Check disk space and log directory permissions.');}});
    return writes;
  };
  const updatePhase=()=>{
    const next=[...active.values()].includes('working')?'working':[...active.values()].includes('publishing')?'publishing':backgroundPhase;
    if(next!==phase){phase=next;void event('phase_changed',`Now ${next}.`);}
  };
  const activity=(id:string,value:string|null)=>{if(value)active.set(id,value);else active.delete(id);updatePhase();};
  const background=(value:string)=>{backgroundPhase=value;updatePhase();};
  await event('session_started',`${name}: session started; target is 25 observed hours.`,{targetHours:25});
  await writeFile(path.join(dir,'session.json'),JSON.stringify({schemaVersion:1,sessionId,name:redactTelemetry(name,secrets),repository:redactTelemetry(repository,secrets),startedAt:new Date().toISOString(),heartbeatMs,targetHours:25})+'\n',{mode:0o600});
  const timer=setInterval(()=>{void event('heartbeat',active.size?`${active.size} task(s) active.`:`Coordinator ${phase}.`);},heartbeatMs);timer.unref();
  return {
    sessionId,dir,event,activity,background,flush:()=>writes,
    async stop(reason:string){if(ended)return;clearInterval(timer);phase='stopped';await event('session_stopped',`Session stopped: ${reason}`,{reason});ended=true;await writes;},
  };
}
