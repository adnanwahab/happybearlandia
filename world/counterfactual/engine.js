import {randomUUID,createHash} from 'node:crypto';
import {canonicalJSON} from '../replay/engine.js';
import {canonicalId,RunContextSchema,validateIntervention} from '../../shared/causality/index.js';
export class ForkError extends Error { constructor(status,code,message){super(message);this.status=status;this.code=code;} }
const fail=(status,code,message)=>{throw new ForkError(status,code,message);};
const copy=x=>structuredClone(x);
const stable=canonicalJSON;
export const domainSeed=(seed,domain)=>createHash('sha256').update(`${seed}:${domain}`).digest().readUInt32LE(0);
/** Dependencies name upstream domains. Every affected descendant is recomputed in topological order. */
export function affectedDomainOrder(adapters,roots){
 const names=Object.keys(adapters),affected=new Set(roots);let changed=true;
 for(const root of roots)if(!adapters[root])fail(503,'adapter_unavailable','Required domain adapter unavailable');
 while(changed){changed=false;for(const name of names)if(!affected.has(name)&&(adapters[name].dependencies||[]).some(d=>affected.has(d))){affected.add(name);changed=true;}}
 const done=new Set(),order=[];function visit(name,stack=new Set()) {if(done.has(name))return;if(stack.has(name))fail(503,'dependency_cycle','Domain dependency cycle');stack.add(name);for(const dep of adapters[name].dependencies||[]){if(!adapters[dep])fail(503,'adapter_unavailable','Missing domain dependency');if(affected.has(dep))visit(dep,new Set(stack));}done.add(name);order.push(name);}
 for(const name of affected)visit(name);return order;
}
/** Private process-local orchestration. Inject authoritative replay and persistence at composition time. */
export function createForkEngine({loadParent,cloneCheckpoint,adapters={},authorize=()=>false,maxBranches=20,maxActive=2,maxHorizon=1000,schedule=fn=>queueMicrotask(fn)}={}){
 const branches=new Map(),jobs=new Map(),keys=new Map();
 const access=async(actor,record)=>{if(!actor||!await authorize(actor,copy(record)))fail(403,'forbidden','Private run access denied');};
 return {
 async submit(actor,input,key){
  if(!input||Object.keys(input).some(k=>!['parentRunId','tick','horizon','interventions'].includes(k))||typeof input.parentRunId!=='string'||!Number.isSafeInteger(input.tick)||input.tick<0||!Number.isSafeInteger(input.horizon)||input.horizon<1)fail(400,'invalid_request','Invalid fork request');
  if(typeof key!=='string'||key.length<1||key.length>128)fail(400,'idempotency_required','Provide a bounded idempotency key');
  if(!actor)fail(403,'forbidden','Authentication required');
  const token=stable([actor,key]),signature=stable(input),prior=keys.get(token);
  if(prior){if(prior.signature!==signature)fail(409,'idempotency_conflict','Key already used with another request');return copy(prior.accepted);}
  if(typeof loadParent!=='function'||typeof cloneCheckpoint!=='function')fail(503,'replay_unavailable','Authoritative replay is unavailable');
  const parent=await loadParent(input.parentRunId);if(!parent)fail(404,'parent_not_found','Parent run not found');await access(actor,parent);
  let context;try{context=RunContextSchema.parse(parent.context);}catch{fail(409,'invalid_parent','Parent context is incompatible');}
  if(context.runId!==input.parentRunId)fail(409,'invalid_parent','Parent ID does not match context');
  if(input.tick>context.tick)fail(422,'future_tick','Fork tick exceeds recorded history');
  if(input.horizon>maxHorizon)fail(422,'horizon_limit','Fork horizon exceeds limit');
  if(!Array.isArray(input.interventions)||!input.interventions.length||input.interventions.length>16)fail(422,'intervention_limit','Provide 1–16 interventions');
  const forkContext={...context,tick:input.tick};let interventions;
  try{interventions=input.interventions.map(v=>validateIntervention(v,Object.values(adapters).flatMap(a=>a.interventions||[]),forkContext));}catch(e){fail(422,'invalid_intervention',e.message);}
  const roots=interventions.map(v=>Object.keys(adapters).find(k=>(adapters[k].interventions||[]).some(r=>r.action===v.action)));
  const order=affectedDomainOrder(adapters,roots);
  if(order.some(d=>typeof adapters[d].recompute!=='function'))fail(503,'adapter_unavailable','Domain recomputation is unavailable');
  // Recheck after awaited authorization; no await between reservation and insertion.
  const race=keys.get(token);if(race){if(race.signature!==signature)fail(409,'idempotency_conflict','Key already used');return copy(race.accepted);}
  const owned=[...branches.values()].filter(b=>b.ownerId===actor);
  if(owned.length>=maxBranches||owned.filter(b=>['queued','running'].includes(b.status)).length>=maxActive)fail(429,'quota_exceeded','Private fork quota reached');
  const id=canonicalId('run','fork',randomUUID()),jobId=canonicalId('job','fork',randomUUID());
  const branch={id,parentRunId:context.runId,context:{...forkContext,runId:id,parentRunId:context.runId},ownerId:actor,visibility:'private',interventions:copy(interventions),affectedDomains:order,seedStreams:Object.fromEntries(Object.keys(adapters).map(d=>[d,domainSeed(context.seed,d)])),status:'queued',jobId};
  const job={id:jobId,branchId:id,ownerId:actor,status:'queued'},accepted={branchId:id,jobId,status:'queued'};
  branches.set(id,branch);jobs.set(jobId,job);keys.set(token,{signature,accepted});
  schedule(async()=>{job.status=branch.status='running';try{
   const checkpoint=await cloneCheckpoint(copy(parent),input.tick);
   if(!checkpoint||checkpoint.context?.modelVersion!==context.modelVersion||checkpoint.context?.runId!==context.runId||checkpoint.context?.tick!==input.tick)fail(409,'incompatible_checkpoint','Replay must return compatible state at the exact fork tick');
   branch.checkpointId=checkpoint.id;branch.checkpointHash=checkpoint.hash;let state=copy(checkpoint.state);
   for(const domain of order){state=await adapters[domain].recompute({state:copy(state),context:copy(branch.context),interventions:copy(interventions.filter(v=>(adapters[domain].interventions||[]).some(r=>r.action===v.action))),seed:branch.seedStreams[domain],horizon:input.horizon});if(state===undefined)fail(503,'invalid_adapter_result','Adapter returned no state');}
   canonicalJSON(state);branch.result={state:copy(state),context:{...branch.context,tick:input.tick+input.horizon},evidence:'synthetic'};job.status=branch.status='completed';
  }catch(e){job.status=branch.status='failed';job.error={code:e.code||'recomputation_failed',message:e instanceof ForkError?e.message:'Domain recomputation failed'};}});
  return copy(accepted);
 },
 async getBranch(actor,id){const b=branches.get(id);if(!b)fail(404,'branch_not_found','Branch not found');if(b.ownerId!==actor)fail(403,'forbidden','Private branch');return copy(b);},
 async getJob(actor,id){const j=jobs.get(id);if(!j)fail(404,'job_not_found','Job not found');if(j.ownerId!==actor)fail(403,'forbidden','Private job');return copy(j);},
 async lineage(actor,id){const chain=[],seen=new Set();let b=await this.getBranch(actor,id);while(b){if(seen.has(b.id))fail(409,'lineage_cycle','Invalid lineage');seen.add(b.id);chain.push({runId:b.id,parentRunId:b.parentRunId,context:b.context});const next=branches.get(b.parentRunId);if(next&&next.ownerId!==actor)fail(403,'forbidden','Private ancestor');b=next;}return chain;}
 };
}
