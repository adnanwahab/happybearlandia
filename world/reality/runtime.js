import {normalizeRealityRequest,verifyRealityManifest} from './runtime-core.js';
import {createTrackedWorker} from '../workers/worker-registry.js';
export {REALITY_LIMITS,REALITY_RUNTIME_VERSION,REALITY_METRICS} from './runtime-core.js';
const clone=value=>structuredClone(value);
const aborted=()=>Object.assign(new Error('Reality operation cancelled'),{name:'AbortError'});
/** One owned worker at a time; no render loop advances these experiments. */
export function createRealityRuntime({initial,populationConfig,worldContext={},workerFactory}={}){
 const defaults={initial:initial===undefined?undefined:clone(initial),populationConfig:populationConfig===undefined?undefined:clone(populationConfig),worldContext:clone(worldContext)};
 let active=null,destroyed=false,serial=0,lastResult=null,lastAnalysis=null;
 const spawn=workerFactory??(()=>createTrackedWorker(new URL('./runtime.worker.js',import.meta.url),{type:'module'},{type:'reality-compiler',group:'reality',protocol:true,ownership:{state:'isolated paired model runs; never writes the live world'}}));
 function stop(){if(active){const task=active;active=null;task.cleanup();task.worker.terminate();task.reject(aborted());}}
 function request(type,payload,{signal,onProgress}={}){
  if(destroyed)throw new Error('Reality runtime is destroyed');if(signal?.aborted)throw aborted();stop();
  const worker=spawn(),requestId=++serial;
  return new Promise((resolve,reject)=>{
   const cancel=()=>stop(),cleanup=()=>signal?.removeEventListener('abort',cancel);
   const task={worker,reject,cleanup};active=task;
   function finish(error,result){cleanup();worker.terminate();if(active===task)active=null;error?reject(error):resolve(clone(result));}
   worker.onmessage=({data})=>{if(active!==task||data.requestId!==requestId)return;if(data.type==='PROGRESS'){try{onProgress?.(clone(data.progress));}catch{}return;}if(data.type==='RESULT')finish(null,data.result);if(data.type==='ERROR')finish(Object.assign(new Error(data.error),{name:data.name??'Error'}));};
   worker.onerror=event=>finish(new Error(event.message||'Reality worker failed'));
   signal?.addEventListener('abort',cancel,{once:true});try{worker.postMessage({type,requestId,...payload});}catch(error){finish(error);}
  });
 }
 function selected(runId,result){for(const catalog of [result,lastResult,...(lastAnalysis?.evaluations??[]).map(e=>e.result)])if(catalog?.runs?.some(row=>row.runId===runId))return catalog;throw new Error('Unknown actual future; run or restore its result manifest first');}
 return{
  async run(options={}){const {signal,onProgress,stressSearch,...input}=options;if(stressSearch!==undefined&&(!stressSearch||typeof stressSearch!=='object'||Array.isArray(stressSearch)))throw new Error('stressSearch must declare grid/runs options');const manifest=normalizeRealityRequest({...defaults,...input});lastResult=null;lastAnalysis=null;const result=await request('RUN',{manifest,stressSearch},{signal,onProgress});lastResult=clone(result);lastAnalysis=result.stressSearch?clone(result.stressSearch):null;return result;},
  async enterFuture({runId,result,signal,...selection}={}){const catalog=selected(runId,result);const row=catalog.runs.find(row=>row.runId===runId);return request('REPLAY',{result:{...catalog,runs:[row]},selection:{runId,...selection}},{signal});},
  async challengeResult(options={}){const {result=lastResult,signal,onProgress,...selection}=options;if(!result)throw new Error('Run a paired experiment first');const output=await request('CHALLENGE',{result,selection},{signal,onProgress});lastAnalysis=clone(output);return output;},
  async breakPolicy(options={}){const {result=lastResult,signal,onProgress,...selection}=options;if(!result)throw new Error('Run a paired experiment first');const output=await request('BREAK',{result,selection},{signal,onProgress});lastAnalysis=clone(output);return output;},
  async fixFailure({runId,result,signal}={}){const catalog=selected(runId,result);return request('FIX',{result:catalog,selection:{runId}},{signal});},
  getResult:()=>lastResult?clone(lastResult):null,
  restoreResult(result){verifyRealityManifest(result.manifest);lastResult=clone(result);lastAnalysis=null;return clone(lastResult);},
  cancel:stop,
  destroy(){stop();destroyed=true;lastResult=null;lastAnalysis=null;},
 };
}
