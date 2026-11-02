import { WORKER_PROTOCOL, WORKER_LIMITS } from "./protocol.js";
const now = () => Date.now();
const bounded = (rows,value,max) => {rows.push(value);if(rows.length>max)rows.splice(0,rows.length-max);};
export function createWorkerRegistry({clock=now}={}) {
  const workers=new Map(),pools=new Map(),listeners=new Set(),errors=[];
  const emit=()=>{for(const callback of listeners)try{callback(getSnapshot());}catch{}};
  function report(id,message={}) {
    const row=workers.get(id);if(!row)return;
    const at=clock(),type=message.type;
    bounded(row.messages,{at,type:String(type||"message").slice(0,80),taskId:message.taskId||null},WORKER_LIMITS.messages);
    if(type==="WORKER_HEARTBEAT"){row.lastHeartbeat=at;row.heartbeatSupported=true;if(message.ownership)row.ownership=structuredClone(message.ownership);}
    if(type==="WORKER_READY"||type==="WORKER_HELLO")row.status="idle";
    if(type==="TASK_START"){row.status="busy";row.currentTask=message.taskId||message.kind||"task";row.taskStartedAt=at;row.progress=0;row.queueLatencyMs=Math.max(0,message.queueLatencyMs||0);}
    if(type==="TASK_PROGRESS")row.progress=Number.isFinite(message.progress)?message.progress:null;
    if(type==="TASK_DONE"||type==="TASK_ERROR") {
      const duration=Math.max(0,message.durationMs??(at-(row.taskStartedAt||at)));
      if(type==="TASK_DONE")row.tasksCompleted++;else{row.tasksFailed++;bounded(errors,{workerId:id,at,error:String(message.error||"Task failed").slice(0,1000)},WORKER_LIMITS.errors);}
      row.totalTaskMs+=duration;row.avgTaskMs=row.totalTaskMs/(row.tasksCompleted+row.tasksFailed);row.lastTaskMs=duration;row.currentTask=null;row.status="idle";row.progress=null;
      bounded(row.history,{at,durationMs:duration,completed:row.tasksCompleted,failed:row.tasksFailed},WORKER_LIMITS.history);
    }
    if(type==="WORKER_SHUTDOWN")row.status="terminated";
    row.lastMessageAt=at;emit();
  }
  function registerWorker(worker,meta={}) {
    if(worker?.worker){meta=worker;worker=meta.worker;}
    if(!worker?.addEventListener)throw new Error("Registry requires a real Worker-compatible message target");
    const id=meta.id||`worker_${crypto.randomUUID()}`;
    const row={id,type:meta.type||"custom",group:meta.group||meta.type||"other",status:"starting",createdAt:clock(),currentTask:null,tasksCompleted:0,tasksFailed:0,totalTaskMs:0,avgTaskMs:0,queueDepth:0,lastHeartbeat:null,lastMessageAt:null,progress:null,ownership:meta.ownership||null,heartbeatSupported:Boolean(meta.protocol),history:[],messages:[],memory:{available:false,bytes:null,reason:"Portable per-worker memory measurement is unavailable"},capabilities:{terminate:false,pause:false,resize:false,...meta.capabilities}};
    workers.set(id,row);while(workers.size>128){const oldest=[...workers].find(([,value])=>value.status==="terminated");if(!oldest)break;workers.delete(oldest[0]);}
    const message=(event)=>{const data=event.data||{};if(data.protocol===WORKER_PROTOCOL||String(data.type||"").startsWith("WORKER_")||String(data.type||"").startsWith("TASK_"))report(id,data);else{const kind=String(data.type||"message");report(id,{type:kind});if(meta.adapter){const normalized=meta.adapter(data);if(normalized)report(id,normalized);}}};
    const error=(event)=>{row.status="failed";row.tasksFailed++;bounded(errors,{workerId:id,at:clock(),error:String(event.message||"Worker error").slice(0,1000)},WORKER_LIMITS.errors);emit();};
    worker.addEventListener("message",message);worker.addEventListener("error",error);emit();
    return {id,report:(event)=>report(id,event),setQueueDepth:(depth)=>{row.queueDepth=Math.max(0,depth);emit();},unregister(){worker.removeEventListener("message",message);worker.removeEventListener("error",error);row.status="terminated";emit();}};
  }
  function getSnapshot(){const at=clock();const rows=[...workers.values()].filter(row=>row.status!=="terminated").map(row=>({...structuredClone(row),heartbeatStatus:row.heartbeatSupported?(row.lastHeartbeat===null?"awaiting":at-row.lastHeartbeat>WORKER_LIMITS.staleMs?"stale":"live"):"unsupported",throughputPerSecond:row.tasksCompleted/Math.max(1,(at-row.createdAt)/1000)}));return{schemaVersion:"worker-registry.v1",at,workers:rows,pools:[...pools.values()].map(value=>structuredClone(value.snapshot())),errors:structuredClone(errors),memory:{available:false,reason:"No portable per-worker memory API"}};}
  return {registerWorker,report,getSnapshot,snapshot:getSnapshot,subscribe(callback){listeners.add(callback);callback(getSnapshot());return()=>listeners.delete(callback);},setPool(id,pool){pools.set(id,pool);emit();},removePool(id){pools.delete(id);emit();},exportDiagnostics(){return JSON.stringify(getSnapshot(),null,2);},async performAction(id,action,value,{developer=false}={}){if(!developer)throw new Error("Worker controls require explicit developer mode");const pool=pools.get(id);if(!pool||!pool.capabilities?.[action]||typeof pool[action]!=="function")throw new Error("Unsupported pool action");return pool[action](value);}};
}
let singleton;
export const getWorkerRegistry=()=>singleton ||= createWorkerRegistry();
export function legacyWorkerAdapter(data){if(data.error||["error","failed"].includes(data.type))return{type:"TASK_ERROR",error:data.error||data.message};if(["done","complete","completed","result"].includes(data.type)||Object.hasOwn(data,"result"))return{type:"TASK_DONE"};if(data.type==="progress")return{type:"TASK_PROGRESS",progress:typeof data.progress==="number"?data.progress:data.progress?.completed/Math.max(1,data.progress?.total)||data.frac||null};return null;}
export function createTrackedWorker(url,options={type:"module"},metadata={}) {
  if(!metadata.protocol)metadata={...metadata,adapter:metadata.adapter||legacyWorkerAdapter};
  const worker=new Worker(url,options);const registration=getWorkerRegistry().registerWorker(worker,metadata);
  const terminate=worker.terminate.bind(worker);worker.terminate=()=>{registration.unregister();return terminate();};
  const post=worker.postMessage.bind(worker);worker.postMessage=(message,...args)=>{if(metadata.adapter&&["run","next","start","explain","build","building","optimize"].includes(message?.type))registration.report({type:"TASK_START",taskId:message.id??message.type});return post(message,...args);};
  worker.registryId=registration.id;return worker;
}
export const registerWorker=(...args)=>getWorkerRegistry().registerWorker(...args);
export const trackWorker=registerWorker;
