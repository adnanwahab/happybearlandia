import { VERSION, initialState, scalarStep, hash } from './model.js';
export async function runShardSpike({workers=1,count=1024,ticks=20,seed=42,latencyMs=0,timeoutMs=10000,onProgress=()=>{},workerFactory=()=>new Worker(new URL('./tile.worker.js',import.meta.url),{type:'module'})}={}) {
  if (![1,2,4,8].includes(workers) || !Number.isInteger(ticks) || ticks<1 || ticks>1000 || !Number.isFinite(latencyMs) || latencyMs<0 || latencyMs>100 || !Number.isFinite(timeoutMs) || timeoutMs<=0) throw Error('Invalid run limits');
  let state=initialState(count,seed), oracle=[...state], bytes=0, maxLagMs=0, committed=0;
  const pool=[], assignments=Array(workers).fill(0), started=performance.now();
  const byteLength=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  async function request(worker,payload) {
    bytes+=byteLength(payload);
    const sent=performance.now();
    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Tile timeout; tick not committed')),timeoutMs);
      worker.onmessage=({data})=>{clearTimeout(timer); bytes+=byteLength(data); data.error?reject(Error(data.error)):resolve(data.result);};
      worker.onerror=()=>{clearTimeout(timer);reject(Error('Worker failed; tick not committed'));};
      worker.postMessage(payload);
    });
    if(latencyMs) await new Promise(resolve=>setTimeout(resolve,latencyMs));
    maxLagMs=Math.max(maxLagMs,performance.now()-sent);
    return result;
  }
  try {
    for(let i=0;i<workers;i++) pool.push(workerFactory());
    for(let tick=0;tick<ticks;tick++) {
      const results=await Promise.all(pool.map((worker,i)=>{
        const start=Math.floor(i*count/workers),end=Math.floor((i+1)*count/workers);
        assignments[i]++;
        return request(worker,{version:VERSION,tick,start,values:state.slice(start,end),left:state[(start+count-1)%count]});
      }));
      const next=[];
      results.forEach((r,i)=>{
        const start=Math.floor(i*count/workers),end=Math.floor((i+1)*count/workers);
        if(!r || r.version!==VERSION || r.tick!==tick || r.start!==start || !Array.isArray(r.values) || r.values.length!==end-start) throw Error('Stale/missing/mismatched tile');
        next.push(...r.values);
      });
      oracle=scalarStep(oracle);
      if(next.some((v,i)=>v!==oracle[i])) throw Error('CPU oracle mismatch; tick not committed');
      state=next; committed++; onProgress({committedTicks:committed,totalTicks:ticks,stateHash:hash(state)});
    }
    const wallMs=performance.now()-started;
    return {version:VERSION,source:'synthetic LCG initial units',seed,count,ticks,workers,latencyMs,wallMs,bytes,bytesPerSecond:bytes/(wallMs/1000),maxLagMs,stateHash:hash(state),oracleHash:hash(oracle),committedTicks:committed,crossShardEvents:workers===1?0:workers*ticks,droppedCrossShardEvents:0,assignments,fairness:Math.min(...assignments)/Math.max(...assignments)};
  } finally { pool.forEach(worker=>worker.terminate()); }
}
