import {createReplayCheckpoint} from '../replay/engine.js';
import {createCityReplayAdapter} from '../replay/city-adapter.js';
import {causalContentHash} from '../../shared/causality/storage.js';
import {demoCheckpointId,demoLastMonth} from './demo.js';
import {createWorldCausalScenario} from './scenario.js';
/** Explicit opt-in synthetic demo write; no client-provided events or state accepted. */
export function createWorldCausalScenarioHandler({store}) {
 return async request=>{
  if(new URL(request.url).pathname!=='/api/causality/world-scenario')return null;
  if(request.method!=='POST')return new Response(null,{status:405,headers:{allow:'POST'}});
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Foreign origin'},{status:403});
  if(Number(request.headers.get('content-length')??0)>1024)return Response.json({error:'Body too large'},{status:413});
  let body='';const reader=request.body?.getReader();if(reader){while(true){const {done,value}=await reader.read();if(done)break;body+=new TextDecoder().decode(value);if(body.length>1024){await reader.cancel();return Response.json({error:'Body too large'},{status:413});}}}
  if(body.trim())return Response.json({error:'Scenario endpoint accepts no payload'},{status:400});
  const adapter=createWorldCausalScenario(),states=[adapter.getState()];for(let i=0;i<demoLastMonth;i++){adapter.step();states.push(adapter.getState());}const snapshot=adapter.snapshot(),runId=snapshot.context.runId;
  const existing=store.getRun(runId);
  if(existing&&existing.status!=='completed')return Response.json({error:'Scenario run is incomplete; inspect its retained records'},{status:409});
  if(!existing){
   const replay=createCityReplayAdapter(),checkpoints=[];for(const state of states){const context={...snapshot.context,tick:state.month},id=demoCheckpointId(runId,state.month),envelope=await createReplayCheckpoint({id,context,tick:state.month,adapter:replay,state});checkpoints.push({id,context,sequence:state.month,state:envelope,hash:causalContentHash(envelope),replayMode:'recorded'});}
   store.createRun({context:{...snapshot.context,tick:0},metadata:{manifest:adapter.getManifest(),metricDefinitions:adapter.getMetrics(),provenance:states[0].provenance,interventions:states[0].policies}});store.commitStep(runId,{expectedRevision:0,events:snapshot.events,observations:snapshot.observations,assumptions:snapshot.assumptions,edges:snapshot.edges,checkpoints});store.completeRun(runId,{expectedRevision:1});}
  const target=snapshot.events.find(e=>e.type==='PROJECT_COMPLETED');
  return Response.json({context:snapshot.context,targetId:target.id,entityId:target.entityIds[0],entities:adapter.getEntities(),synthetic:true});
 };
}
