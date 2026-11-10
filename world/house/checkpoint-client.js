export async function houseCheckpointTask(input){
 if(typeof document==='undefined'||typeof Worker==='undefined'){
  const {runHouseCheckpointTask}=await import('./checkpoint-tasks.js');return runHouseCheckpointTask(input);
 }
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./checkpoint.worker.js',import.meta.url),{type:'module'});
  const finish=(error,result)=>{clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);};
  const timer=setTimeout(()=>finish(Error('Saved household validation timed out. Please retry.')),60000);
  worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.result);
  worker.onerror=event=>finish(Error(event.message||'Saved household validation failed'));
  try{worker.postMessage(input);}catch(error){finish(error);}
 });
}
