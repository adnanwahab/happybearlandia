import {ensembleRealityFutures} from './ensemble-core.js';
import {verifyRealityManifest,executeRealityExperiment,replayRealityFuture,challengeRealityResult,breakRealityPolicy,proposeRealityFix} from './runtime-core.js';
import {WORKER_PROTOCOL} from '../workers/protocol.js';
let cancelled=false;
const telemetry=(type,data={})=>postMessage({type,protocol:WORKER_PROTOCOL,...data});
telemetry('WORKER_READY');
setInterval(()=>telemetry('WORKER_HEARTBEAT',{ownership:{state:'isolated actual baseline/treatment pairs',retention:'bounded catalogs; details regenerated on selection'}}),2000);
self.onmessage=async({data})=>{
 if(data.type==='CANCEL'){cancelled=true;return;}
 if(!['RUN','REPLAY','CHALLENGE','BREAK','FIX','ENSEMBLE'].includes(data.type))return;
 cancelled=false;const started=performance.now(),requestId=data.requestId;telemetry('TASK_START',{taskId:requestId,kind:data.type});
 const options={shouldCancel:()=>cancelled,onProgress:progress=>{postMessage({type:'PROGRESS',requestId,progress});telemetry('TASK_PROGRESS',{taskId:requestId,progress:progress.completed/Math.max(1,progress.total)});}};
 try{
  let result;
  if(data.type==='RUN'){result=await executeRealityExperiment(verifyRealityManifest(data.manifest),options);if(data.stressSearch&&result.status==='completed')result.stressSearch=await breakRealityPolicy(result,{...data.stressSearch,...options});}
  else {
   const manifest=verifyRealityManifest(data.result?.manifest);
   const catalog={...data.result,manifest};
   if(data.type==='REPLAY')result=await replayRealityFuture(catalog,data.selection,options);
   if(data.type==='ENSEMBLE')result=await ensembleRealityFutures(catalog,{...data.selection,...options});
   if(data.type==='CHALLENGE')result=await challengeRealityResult(catalog,{...data.selection,...options});
   if(data.type==='BREAK')result=await breakRealityPolicy(catalog,{...data.selection,...options});
   if(data.type==='FIX')result=proposeRealityFix(await replayRealityFuture(catalog,data.selection,options),manifest);
  }
  postMessage({type:'RESULT',requestId,result});telemetry('TASK_DONE',{taskId:requestId,durationMs:performance.now()-started});
 }catch(error){postMessage({type:'ERROR',requestId,error:error.message,name:error.name});telemetry('TASK_ERROR',{taskId:requestId,error:error.message});}
};
