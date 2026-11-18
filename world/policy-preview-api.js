/** Server-only persisted orchestration of the existing Constitution City runtime. */
import {mkdirSync,readdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {RunJobManager} from './run-job-manager.js';
import {createCity} from './city/seed.js';
import {VERSION} from './city/contracts.js';
import {deriveSeed} from './world-generator.js';
import {normalizeDearCongressPlan} from './constitution-city/plan.js';
import {normalizeConstitutionRequest,simulateConstitutionCity,CONSTITUTION_RUNTIME_VERSION} from './constitution-city/runtime-core.js';
import {validatePolicyPreview,previewParameterDiff,policyHash,POLICY_MAPPING_VERSION} from './policy-preview-contract.js';
const copy=value=>structuredClone(value);
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const modelVersion=`${VERSION}/${CONSTITUTION_RUNTIME_VERSION}/${POLICY_MAPPING_VERSION}`;
export function createPolicyPreviewHandler({directory,token,canonicalOrigin,maxRunning=1,maxQueued=8,simulate=simulateConstitutionCity}={}){
 if(!directory||!canonicalOrigin)throw new Error('Policy preview directory and canonicalOrigin required');
 const origin=new URL(canonicalOrigin);if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Invalid canonicalOrigin');
 mkdirSync(directory,{recursive:true});
 const records=new Map(),active=new Set(),manager=new RunJobManager({maxRunning,maxQueued});
 const save=record=>{const file=join(directory,`${record.id}.json`);writeFileSync(`${file}.tmp`,JSON.stringify(record),{mode:0o600});renameSync(`${file}.tmp`,file);};
 for(const name of readdirSync(directory)){if(!/^pp_[a-f0-9]{64}\.json$/.test(name))continue;const record=JSON.parse(readFileSync(join(directory,name),'utf8'));records.set(record.id,record);}
 const publicRecord=record=>({id:record.id,url:record.url,supportStatus:record.supportStatus,job:copy(record.job)});
 function schedule(record){
  if(active.has(record.id)||record.job.status==='completed')return;
  if(record.modelVersion!==modelVersion){record.job.status='unavailable';record.job.error='Pinned model version unavailable; retained results remain readable';save(record);return;}
  const pending=Array.from({length:record.input.simulation.runs},(_,runIndex)=>runIndex).filter(index=>record.runs[index]?.status!=='completed'&&(record.runs[index]?.attempts||0)<3);
  if(!pending.length)return;
  if(manager.running>=manager.maxRunning&&manager.queue.length>=manager.maxQueued)return;
  active.add(record.id);record.job.status='queued';record.job.error=null;save(record);
  const attempt=policyHash(record.runs.map(row=>row?.attempts||0));
  const adapter={id:modelVersion,label:'Policy Impact synthetic city pairs',predictive:false,modelClass:'monthly-city',simulateWorld:async({world})=>{
   const runIndex=world.runIndex,seed=deriveSeed(record.input.simulation.seed,runIndex),attempts=(record.runs[runIndex]?.attempts||0)+1;
   record.job.status='running';save(record);
   try{
    const pair={runIndex,seed,status:'completed',attempts};
    for(const scenario of record.runtimeManifest.scenarios){
     const output=await simulate(record.runtimeManifest,scenario,seed);
     const checkpoints=[];for(const month of record.checkpointMonths){const selected=await simulate(record.runtimeManifest,scenario,seed,{throughMonth:month,retainState:true});
      if(JSON.stringify(selected.metricsTimeline.at(-1).metrics)!==JSON.stringify(output.metricsTimeline[month].metrics))throw new Error('Checkpoint failed recorded metrics compatibility');checkpoints.push({month,state:selected.state});}
     pair[scenario.id]={...output,checkpoints};
    }
    record.runs[runIndex]=pair;
   }catch(error){record.runs[runIndex]={runIndex,seed,status:'failed',attempts,error:String(error.message||error)};}
   record.job.completed=record.runs.filter(row=>row?.status==='completed').length;record.job.failed=record.runs.filter(row=>row?.status==='failed').length;save(record);
   return {score:0,raw:{runIndex}};
  }};
  let job;try{job=manager.createJob({experiment:{id:record.id,plan:{id:record.id},model:{version:modelVersion,attempt}},worldBatch:{seed:record.input.simulation.seed,worlds:pending.map(runIndex=>({id:`${record.id}_${runIndex}_${attempt}`,runIndex}))},adapter,chunkSize:1,concurrency:1});}
  catch(error){active.delete(record.id);record.job.status='queued';save(record);return;}
  manager.wait(job.id).catch(()=>{record.job.error='Execution failed; recorded successful pairs retained';}).finally(()=>{
   active.delete(record.id);record.job.status=record.job.completed===record.job.total?'completed':record.job.completed?'partial':'failed';save(record);
   for(const next of records.values())if(next.job.status==='queued')schedule(next);
  });
 }
 // Resume interrupted jobs. Failed/partial terminal previews require explicit retry.
 for(const record of records.values())if(['queued','running'].includes(record.job.status))setTimeout(()=>schedule(record),0);
 function authorized(request){if(!token||request.headers.has('origin')||new URL(request.url).search)return false;const provided=request.headers.get('authorization')||'',expected=`Bearer ${token}`;return Buffer.byteLength(provided)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected));}
 return async function handlePolicyPreview(request){
  const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean);if(parts[0]!=='api'||parts[1]!=='policy-previews')return null;
  try{
   if(request.method==='POST'){
    if(!authorized(request))return json({error:'Server integration authentication required'},401);
    if(parts.length===4&&parts[3]==='retry'){
     const record=records.get(parts[2]);if(!record)return json({error:'Preview unavailable'},404);
     if(record.modelVersion!==modelVersion)return json({error:'Pinned model unavailable'},409);
     if(!active.has(record.id)&&record.runs.some(row=>row?.status==='failed'&&row.attempts<3)){record.job.status='queued';schedule(record);}
     return json(publicRecord(record),202);
    }
    if(parts.length!==2)return json({error:'Unsupported preview operation'},405);
    if(Number(request.headers.get('content-length'))>700000)return json({error:'Preview payload too large'},413);
    const reader=request.body?.getReader();let text='',bytes=0;if(!reader)return json({error:'JSON body required'},400);
    const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>700000){await reader.cancel();return json({error:'Preview payload too large'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
    const input=validatePolicyPreview(JSON.parse(text));
    const versionConflict=[...records.values()].find(row=>row.input.source.system===input.source.system&&row.input.source.proposalId===input.source.proposalId&&row.input.source.versionId===input.source.versionId&&row.input.source.contentHash!==input.source.contentHash);
    if(versionConflict)return json({error:'Proposal version content is immutable; use a new versionId'},409);
    const id=`pp_${policyHash({system:input.source.system,proposalId:input.source.proposalId,versionId:input.source.versionId,contentHash:input.source.contentHash,modelVersion,simulation:input.simulation,modelRunId:input.modelRunId||null})}`;
    const existing=records.get(id);if(existing){if(policyHash(existing.input)!==policyHash(input))return json({error:'Version snapshot is immutable; conflicting metadata'},409);return json(publicRecord(existing),200);}
    if([...records.values()].filter(row=>['queued','running'].includes(row.job.status)).length>=maxRunning+maxQueued)return json({error:'Preview queue full; retry later'},429);
    if(records.size>=1000)return json({error:'Preview retention capacity reached'},503);
    const parameterDiff=previewParameterDiff(input),supported=parameterDiff.filter(row=>row.supportStatus==='supported').length;
    const plan=normalizeDearCongressPlan({id:'A',items:input.legal.clauses.map(clause=>({id:clause.sourcePolicyId,title:(clause.afterText||clause.beforeText).slice(0,500),text:clause.afterText||clause.beforeText,costB:.01}))});
    const baselineIds=input.legal.clauses.filter(row=>row.operation!=='add').map(row=>row.sourcePolicyId),proposalIds=input.legal.clauses.filter(row=>row.operation!=='remove').map(row=>row.sourcePolicyId);
    const runtimeManifest=normalizeConstitutionRequest({initial:createCity({households:3,seed:42}),plan,scenarios:[{id:'baseline',label:input.baseline.label,clauseIds:baselineIds},{id:'proposal',label:input.source.title,clauseIds:proposalIds}],...input.simulation});
    const checkpointMonths=[...new Set([0,...[12,24].filter(month=>month<input.simulation.months),input.simulation.months])];
    const record={id,url:`${origin.origin}/world/impact?preview=${id}`,input,modelVersion,mappingVersion:POLICY_MAPPING_VERSION,parameterDiff,supportStatus:supported===input.legal.clauses.length?'supported':supported?'partial':'unavailable',runtimeManifest,checkpointMonths,createdAt:new Date().toISOString(),runs:[],job:{status:'queued',completed:0,failed:0,total:input.simulation.runs},uncertainty:{synthetic:true,predictive:false,description:'Synthetic scenario outputs, not verified real-world forecasts. Seed spread is model variability, not calibrated confidence.',baseline:input.baseline.kind==='current-law'?'Publisher-declared current law; enactment unverified.':'Prior proposal version; not asserted to be enacted law.',unavailableMetrics:['legal validity','evictions','real-world causal effects'],assumptions:runtimeManifest.assumptions}};
    save(record);records.set(id,record);setTimeout(()=>schedule(record),0);return json(publicRecord(record),202);
   }
   if(request.method!=='GET'||parts.length<3||parts.length>4||parts.length===4&&parts[3]!=='results')return json({error:'Unsupported preview operation'},405);
   const record=records.get(parts[2]);if(!record)return json({error:'Preview unavailable'},404);
   if(parts[3]==='results'){
    let runs=record.runs.filter(Boolean);if(url.searchParams.has('runIndex')){const raw=url.searchParams.get('runIndex');if(!/^\d{1,3}$/.test(raw)||Number(raw)>=record.job.total)return json({error:'Invalid runIndex'},400);runs=runs.filter(row=>row.runIndex===Number(raw));}
    return json({id:record.id,job:record.job,runs,checkpointMonths:record.checkpointMonths,uncertainty:record.uncertainty});
   }
   const {runs,...manifest}=record;return json(manifest);
  }catch(error){return json({error:error.status&&error.status<500?error.message:error instanceof SyntaxError?'Invalid JSON body':'Preview unavailable'},error.status|| (error instanceof SyntaxError?400:500));}
 };
}
