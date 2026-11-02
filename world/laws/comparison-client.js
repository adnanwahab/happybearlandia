/** One disposable worker per explicit law comparison. Cancelling terminates the
 * work and releases detached city/model memory; late results cannot replace it. */
export function compareLawInWorker({signal,onProgress,...options}={}){
 return new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Law comparison cancelled','AbortError'));return;}let worker,done=false;
  const cleanup=()=>{signal?.removeEventListener('abort',cancel);worker?.terminate();};
  const finish=(callback,value)=>{if(done)return;done=true;cleanup();callback(value);};
  const cancel=()=>finish(reject,new DOMException('Law comparison cancelled','AbortError'));
  try{worker=new Worker(new URL('./comparison.worker.js',import.meta.url),{type:'module'});signal?.addEventListener('abort',cancel,{once:true});worker.onmessage=({data})=>{if(done)return;if(data.type==='RESULT')finish(resolve,data.result);else if(data.type==='ERROR')finish(reject,new Error(data.error));else if(data.type==='PROGRESS')onProgress?.(data.progress);};worker.onerror=event=>finish(reject,new Error(event.message||'Law comparison worker failed'));worker.postMessage(options);}catch(error){finish(reject,error);}
 });
}
