import {executeConstitutionExperiment,replayConstitutionFuture} from './runtime-core.js';
import {WORKER_PROTOCOL} from '../workers/protocol.js';
let cancelled=false;
const post=(type,data={})=>postMessage({type,...data});
const telemetry=(type,data={})=>post(type,{protocol:WORKER_PROTOCOL,...data});
telemetry('WORKER_READY');
const heartbeat=setInterval(()=>telemetry('WORKER_HEARTBEAT',{ownership:{catalog:'bounded metrics; state regenerated only on selection'}}),2000);
self.onmessage=async({data})=>{
 if(data.type==='CANCEL'){cancelled=true;return;}
 if(!['RUN','REPLAY'].includes(data.type))return;
 cancelled=false;const start=performance.now(),taskId=data.requestId;
 telemetry('TASK_START',{taskId,kind:data.type});
 try{
  const result=data.type==='RUN'?await executeConstitutionExperiment(data.manifest,{shouldCancel:()=>cancelled,onProgress:progress=>{post('PROGRESS',{requestId:taskId,progress});telemetry('TASK_PROGRESS',{taskId,progress:progress.completed/progress.total});}}):await replayConstitutionFuture(data.result,data.selection,{shouldCancel:()=>cancelled});
  post(data.type==='RUN'?'RESULT':'REPLAY_RESULT',{requestId:taskId,result});telemetry('TASK_DONE',{taskId,durationMs:performance.now()-start});
 }catch(error){post('ERROR',{requestId:taskId,error:error.message});telemetry('TASK_ERROR',{taskId,error:error.message,durationMs:performance.now()-start});}
};
