import {checkpointCapacity} from './checkpoint-retention.js';
import {createHousingCheckpointAdapter} from './backlog-replay/index.js';
import {createHousingCheckpointRepository} from './backlog-replay/repository.js';
import {simulateHousingRun} from '../models/housing/index.js';
import {createDecisionStore} from './store.js';
import {hashWorldEditProposal} from '../ai/revisions.js';
import {resolve} from 'node:path';
export function createCheckpointHandler({authorize,store=createDecisionStore(),directory='.data/housing-checkpoints'}={}) {
 const adapter=createHousingCheckpointAdapter({simulateRun:simulateHousingRun}),repository=createHousingCheckpointRepository({directory,adapter,publicRoots:['world','data','game','tools','blog','visualizations'].map(p=>resolve(p))}),active=new Set();
 return async request=>{
  if(new URL(request.url).pathname!=='/api/decision-checkpoints')return null;
  const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
  const ownerId=await authorize?.(request);if(!ownerId)return json({error:'Local capability required'},401);
  if(request.method!=='POST')return json({error:'Use POST'},405);
  if(active.has(ownerId)||active.size>=2)return json({error:'Checkpoint work already active'},429);
  active.add(ownerId);
  try{
   if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
   let bytes=0,chunks=[];for await(const chunk of request.body||[]){bytes+=chunk.byteLength;if(bytes>16384)return json({error:'Request too large'},413);chunks.push(chunk);}const payload=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
   const {experimentId,runId,action,month}=payload;
   if(!/^[A-Za-z0-9_-]{1,128}$/.test(experimentId||'')||!/^[A-Za-z0-9_-]{1,128}$/.test(runId||''))return json({error:'Invalid source identity'},400);
   const record=await store.load(experimentId),run=record?.runs?.find(r=>r.id===runId);if(!run)return json({error:'Source unavailable'},404);
   if(run.modelVersion!=='1.2.0'||run.status!=='completed'||run.fork)return json({error:'Unsupported source; use original completed housing 1.2.0 run'},409);
   const scope={ownerId,experimentId,runId};let output,parent;
   const capacity=action==='load'?null:await checkpointCapacity(directory,ownerId);
   if(action==='start'){
    const scenario=record.experiment.scenarios.find(s=>s.id===run.scenarioId);
    output=await adapter.start({parameters:run.sampledParameters,seed:run.seed,years:record.experiment.years,projects:run.inputProjects??scenario.projects??[],scheduledStress:run.scheduledStress??scenario.scheduledStress??[]},month);
    const expected=run.monthlyTimeline?.filter(r=>r.month<=month);if(JSON.stringify(expected)!==JSON.stringify(output.result.monthlyTimeline))return json({error:'Stored prefix reconstruction mismatch'},409);
   }else{
    parent=await repository.load(scope,payload.checkpoint);if(action==='load')return json(parent);
    if(action==='fork'){
     const previewHash=await hashWorldEditProposal({checkpoint:payload.checkpoint,operations:payload.operations,month});
     if(payload.approval!==true)return json({requiresApproval:true,previewHash,operations:payload.operations,month});
     if(payload.previewHash!==previewHash)return json({error:'Review the exact fork again'},409);
     output=await adapter.fork(parent.serialized,payload.operations,month);
    }else if(action==='resume')output=await adapter.resume(parent.serialized,month);else return json({error:'Unsupported action'},400);
   }
   if(!parent){try{const existing=await repository.load(scope,{id:output.checkpoint.id,digest:output.checkpoint.digest});if(existing.serialized!==output.serialized)throw Error('Immutable root conflict');return json({...output,expiresAt:existing.expiresAt},201);}catch(error){if(error.code!=='ENOENT')throw error;}}
   const expiresAt=parent?.expiresAt??Date.now()+86400000;
   if(new TextEncoder().encode(output.serialized).length>(capacity?.remainingBytes??0))return json({error:'Checkpoint byte quota reached'},429);
   await repository.save(scope,output.serialized,{expiresAt,...(parent?{parent:{id:parent.checkpoint.id,digest:parent.checkpoint.digest}}:{})});
   return json({...output,expiresAt},201);
  }catch(error){const capacity=/quota|storage limit|audit bound/.test(error.message);return json({error:error.code==='ENOENT'?'Checkpoint unavailable':capacity?'Checkpoint capacity reached':'Checkpoint rejected',detail:'Check source identity, supported version, month, approval and retained checkpoint.'},capacity?429:400);}finally{active.delete(ownerId);}
 };
}
