import {normalizeConstitutionRequest} from './runtime-core.js';
import {createTrackedWorker} from '../workers/worker-registry.js';
export {CONSTITUTION_LIMITS,CONSTITUTION_RUNTIME_VERSION} from './runtime-core.js';
const abortError=()=>Object.assign(new Error('Constitution runtime operation cancelled'),{name:'AbortError'});
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
/** Owns at most one catalog worker and one replay worker. Never caches city histories. */
export function createConstitutionRuntime({initial,plan,workerFactory}={}){
 const snapshot=structuredClone(initial),policyPlan=structuredClone(plan);
 let destroyed=false,epoch=0,serial=0,catalog=null,replay=null,lastResult=null;
 const spawn=workerFactory||(()=>createTrackedWorker(new URL('./runtime.worker.js',import.meta.url),{type:'module'},{type:'constitution-city',group:'constitution-city',protocol:true,ownership:{state:'isolated city simulation'}}));
 function stop(task){if(!task)return;task.worker.terminate();task.cleanup();task.reject(abortError());}
 function request(type,payload,{onProgress,signal}={}){
  if(destroyed)throw new Error('Constitution runtime is destroyed');
  const worker=spawn(),requestId=++serial;let task;
  const promise=new Promise((resolve,reject)=>{
   const abort=()=>{if(type==='RUN')worker.postMessage({type:'CANCEL'});else stop(task);};
   const cleanup=()=>signal?.removeEventListener('abort',abort);
   task={worker,reject,cleanup,requestId};
   worker.onmessage=({data})=>{if(data.requestId!==requestId)return;
    if(data.type==='PROGRESS'){onProgress?.(data.progress);return;}
    if(!['RESULT','REPLAY_RESULT','ERROR'].includes(data.type))return;
    cleanup();worker.terminate();if(data.type==='ERROR')reject(new Error(data.error));else resolve(data.result);
   };
   worker.onerror=event=>{cleanup();worker.terminate();reject(new Error(event.message||'Constitution worker failed'));};
   signal?.addEventListener('abort',abort,{once:true});worker.postMessage({type,requestId,...payload});if(signal?.aborted)abort();
  });return{task,promise};
 }
 return{
  async run({scenarios,runs=2,months=120,seed=42,onProgress,signal}={}){
   const manifest=freeze(normalizeConstitutionRequest({initial:snapshot,plan:policyPlan,scenarios,runs,months,seed}));
   stop(catalog);stop(replay);catalog=null;replay=null;lastResult=null;const generation=++epoch;
   const operation=request('RUN',{manifest},{signal,onProgress:progress=>{if(generation===epoch)onProgress?.(progress);}});catalog=operation.task;
   try{const result=await operation.promise;if(generation!==epoch||destroyed)throw abortError();lastResult=freeze(result);return lastResult;}finally{if(catalog===operation.task)catalog=null;}
  },
  async enterFuture(selection){
   if(!lastResult)throw new Error('Run a Constitution experiment before entering a future');
   stop(replay);const generation=epoch;
   // Send only the selected catalog row and manifest, never the entire catalog.
   const row=lastResult.runs.find(item=>item.id===selection?.runId);
   const operation=request('REPLAY',{result:{manifest:lastResult.manifest,runs:row?[row]:[]},selection});replay=operation.task;
   try{const result=await operation.promise;if(generation!==epoch||replay!==operation.task||destroyed)throw abortError();return result;}finally{if(replay===operation.task)replay=null;}
  },
  cancel(){catalog?.worker.postMessage({type:'CANCEL'});stop(replay);replay=null;},
  destroy(){destroyed=true;epoch++;stop(catalog);stop(replay);catalog=null;replay=null;lastResult=null;}
 };
}
