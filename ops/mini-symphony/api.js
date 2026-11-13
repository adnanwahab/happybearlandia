import path from 'node:path';
import { open, readdir, lstat } from 'node:fs/promises';
import { summarizeSession } from '../../tools/symphony/mini-bun/session-metrics.js';
import { publicTelemetryEvent, redactTelemetry, formatTelemetryLine } from '../../tools/symphony/mini-bun/telemetry-format.js';
import { queueSummary } from '../../tools/symphony/mini-bun/queue.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES=16*1024*1024;
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
async function boundedText(file,limit=MAX_BYTES) {
  const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw Error('Telemetry source exceeds the read limit or is not a regular file');
  const handle=await open(file,'r');
  try{const buffer=Buffer.alloc(info.size);const {bytesRead}=await handle.read(buffer,0,buffer.length,0);return buffer.subarray(0,bytesRead).toString('utf8');}finally{await handle.close();}
}
async function optionalJSON(file,fallback){try{return JSON.parse(await boundedText(file));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}}
export async function loadMiniSymphonySources() {
  const file=process.env.HBL_MINI_SYMPHONY_SOURCES||path.resolve('.hbl-private/mini-symphony-sources.json');
  const config=await optionalJSON(file,{projects:[{id:'happybearlandia',name:'HappyBearLandia',repository:'adnanwahab/happybearlandia',root:process.cwd()}]});
  if(!Array.isArray(config.projects)||config.projects.length>10||new Set(config.projects.map(p=>p.id)).size!==config.projects.length||config.projects.some(p=>!/^[-a-z0-9]{1,64}$/.test(p.id)||typeof p.root!=='string'||typeof p.name!=='string'))throw Error('Invalid Mini Symphony source configuration');
  return config.projects.map(p=>({...p,root:path.resolve(p.root)}));
}
async function sessionEvents(root,id) {
  const dir=path.join(root,'telemetry','sessions',id),info=await lstat(dir);
  if(!info.isDirectory()||info.isSymbolicLink())throw Error('Invalid telemetry session directory');
  return (await boundedText(path.join(dir,'events.jsonl'))).split('\n').filter(Boolean).map(line=>{try{return publicTelemetryEvent(JSON.parse(line));}catch{return '[invalid event]';}});
}
export function createMiniSymphonyHandler({sources,now=()=>Date.now(),cacheMs=3000}={}) {
  let cache=null,cacheAt=0;
  async function projectSnapshot(source) {
    const result={id:source.id,name:redactTelemetry(source.name),repository:source.repository??null,queue:{runnable:0,disabled:0,terminal:0,priorAttempts:0,running:0},legacy:{tasks:0,prCreated:0,noChanges:0,failed:0},sessions:[],currentTask:null};
    try {
      const tasks=await optionalJSON(path.join(source.root,'tasks.json'),[]),state=await optionalJSON(path.join(source.root,'state.json'),{});
      if(!Array.isArray(tasks)||!state||typeof state!=='object'||Array.isArray(state))throw Error('Invalid local task/state format');
      result.queue=queueSummary(tasks,state);
      result.legacy={tasks:Object.keys(state).length,prCreated:Object.values(state).filter(s=>s.status==='pr_created').length,noChanges:Object.values(state).filter(s=>s.status==='no_changes').length,failed:Object.values(state).filter(s=>['failed','publish_failed','interrupted'].includes(s.status)).length};
      const current=Object.entries(state).find(([,s])=>['running','publishing'].includes(s.status));
      if(current)result.currentTask={id:redactTelemetry(current[0]),status:current[1].status,startedAt:current[1].startedAt??null,sessionId:UUID.test(current[1].sessionId??'')?current[1].sessionId:null};
      const directory=path.join(source.root,'telemetry','sessions');let entries=[];
      try{entries=(await readdir(directory,{withFileTypes:true})).filter(e=>e.isDirectory()&&UUID.test(e.name)).slice(0,500);}catch(error){if(error.code!=='ENOENT')throw error;}
      const dated=await Promise.all(entries.map(async e=>({id:e.name,time:(await lstat(path.join(directory,e.name))).mtimeMs})));
      for(const entry of dated.sort((a,b)=>b.time-a.time).slice(0,10)) {
        try {
          const events=await sessionEvents(source.root,entry.id),metrics=summarizeSession(events,{now:now()});
          result.sessions.push({id:entry.id,metrics,events:events.filter(e=>e&&typeof e==='object').slice(-80).map(publicTelemetryEvent)});
        }catch{result.sessions.push({id:entry.id,metrics:summarizeSession([],{now:now()}),events:[],error:'Session telemetry is unreadable or exceeds the bounded read limit.'});}
      }
      if(result.currentTask){const latest=result.sessions[0]?.events.findLast(e=>e.taskId===result.currentTask.id&&e.type==='task_output');if(latest)result.currentTask.lastOutputAt=latest.at;}
    }catch{result.error='Local runner data is unavailable or invalid. The dashboard has not verified a session.';}
    return result;
  }
  return async function handleMiniSymphony(request,{localAddress}={}) {
    const url=new URL(request.url);
    const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(localAddress);
    const host=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    let sameOrigin=true;try{if(request.headers.get('origin'))sameOrigin=new URL(request.headers.get('origin')).origin===url.origin;}catch{sameOrigin=false;}
    if(!local||!host||!sameOrigin)return Response.json({error:'Mini Symphony operator data is available only from this machine.'},{status:403,headers});
    if(request.method!=='GET')return Response.json({error:'Read-only endpoint.'},{status:405,headers:{...headers,allow:'GET'}});
    let configured;try{configured=sources??await loadMiniSymphonySources();}catch{return Response.json({error:'Mini Symphony source configuration is unavailable.'},{status:503,headers});}
    if(url.pathname==='/api/mini-symphony/log') {
      const source=configured.find(p=>p.id===url.searchParams.get('project')),id=url.searchParams.get('session');
      if(!source||!UUID.test(id??''))return Response.json({error:'Unknown project or invalid session.'},{status:400,headers});
      try {
        const events=await sessionEvents(source.root,id);
        const text='Mini Symphony curated session log. Raw Codex prompts/transcripts are not included.\n'+events.filter(e=>e&&typeof e==='object').map(e=>formatTelemetryLine(publicTelemetryEvent(e))).join('');
        return new Response(text,{headers:{...headers,'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="mini-symphony-${source.id}-${id}.log"`}});
      }catch{return Response.json({error:'Session log unavailable.'},{status:404,headers});}
    }
    if(url.pathname!=='/api/mini-symphony')return Response.json({error:'Not found.'},{status:404,headers});
    if(!cache||now()-cacheAt>=cacheMs){cache={targetHours:25,projects:await Promise.all(configured.map(projectSnapshot))};cacheAt=now();}
    return Response.json({...cache,generatedAt:new Date(now()).toISOString()},{headers});
  };
}
