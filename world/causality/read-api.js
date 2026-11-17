import {inspectRipple} from './ripple.js';
import {explainRecorded} from './explanation.js';
import {sameRun} from '../../shared/causality/index.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const bad=message=>{throw Object.assign(new Error(message),{status:400});};
const integer=(query,key,fallback,min,max)=>{if(!query.has(key))return fallback;const raw=query.get(key);if(!/^\d+$/.test(raw))bad('Invalid '+key);const value=Number(raw);if(!Number.isSafeInteger(value)||value<min||value>max)bad('Invalid '+key);return value;};
/** Store is injected; no parallel persistence or inferred links. */
export function createCausalityReadHandler({store}) {
 return async request=>{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/causality\/?/,'').replace(/\/$/,''),q=url.searchParams;
  if(!['runs','run','events','observations','explain','ripple','timeline','checkpoints'].includes(path)&&!path.startsWith('runs/'))return null;
  if(request.method!=='GET')return new Response(null,{status:405,headers:{allow:'GET'}});
  try{
   for(const key of new Set(q.keys()))if(q.getAll(key).length!==1)bad('Duplicate query parameter: '+key);
   const limit=integer(q,'limit',100,1,1000);
   if(path==='runs'){const filters={limit};for(const key of ['afterId','worldId','scenarioId','universeId','status'])if(q.has(key))filters[key]=q.get(key);return json(store.listRuns(filters));}
   let runId=q.get('runId');if(path.startsWith('runs/')){try{runId=decodeURIComponent(path.slice(5));}catch{bad('Invalid run ID');}}
   if(!runId||runId.length>4096)bad('runId is required');const run=store.getRun(runId);if(!run)return json({error:'Stored run not found'},404);
   if(path==='run'||path.startsWith('runs/'))return json({run});
   if(path==='ripple'){
    const targetId=q.get('targetId');if(!targetId)bad('targetId is required');
    const result=inspectRipple(store,runId,targetId);
    return result?json(result):json({error:'Stored target record not found'},404);
   }
   if(path==='explain'){
    const targetId=q.get('targetId');if(!targetId)bad('targetId is required');
    if(q.has('includeAssociations')&&!['true','false'].includes(q.get('includeAssociations')))bad('Invalid includeAssociations');
    const result=explainRecorded(store,runId,targetId,{maxDepth:integer(q,'maxDepth',6,0,20),maxNodes:integer(q,'maxNodes',100,1,500),maxEdges:integer(q,'maxEdges',200,1,1000),includeAssociations:q.get('includeAssociations')==='true'});
    return result?json(result):json({error:'Stored target record not found'},404);
   }
   const options={limit,afterSequence:q.has('afterSequence')?integer(q,'afterSequence',0,0,Number.MAX_SAFE_INTEGER):-1};
   if(path==='checkpoints'){
    const {items,nextCursor}=store.listCheckpoints(runId,options);
    const checkpoints=items.flatMap(({id,context,state})=>{
     if(state?.schemaVersion!=='replay-checkpoint.v1'||state.id!==id||state.tick!==context.tick||!state.context||!sameRun(state.context,run.context))return [];
     const {tick,domain,modelVersion,adapterVersion}=state;
     return [{id,tick,domain,modelVersion,adapterVersion}];
    });
    return json({items:checkpoints,nextCursor});
   }
   if(path==='events'||path==='observations')return json(store[path==='events'?'listEvents':'listObservations'](runId,options));
   const entityId=q.get('entityId'),tick=q.has('tick')?integer(q,'tick',0,0,Number.MAX_SAFE_INTEGER):null;
   // Merge the globally sequenced streams before filtering; cursor advances even on empty matches.
   const events=store.listEvents(runId,options),observations=store.listObservations(runId,options);
   const merged=[...events.items,...observations.items].sort((a,b)=>a.sequence-b.sequence),window=merged.slice(0,limit);
   const hasMore=merged.length>limit||events.nextCursor!=null||observations.nextCursor!=null;
   const items=window.filter(row=>(!entityId||row.entityId===entityId||row.entityIds?.includes(entityId))&&(tick===null||row.context.tick<=tick));
   return json({runId,items,nextCursor:hasMore?window.at(-1)?.sequence??null:null,incomplete:hasMore});
  }catch(error){return json({error:error.status?error.message:'Could not read stored causal records'},error.status||500);}
 };
}
