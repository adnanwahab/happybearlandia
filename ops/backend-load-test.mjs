// Bounded staging workload. No retries: a lost POST response must never duplicate a write.
import {VERSION} from '../world/city/contracts.js';
export const recipe = Object.freeze({title:'Synthetic staging load probe',city:{seed:45,households:12},runs:1,months:2,retention:'summary',scenarios:[{id:'baseline',interventions:[]}]});
export function validateTarget(config) {
  const url=new URL(config.origin);
  const local=config.localStaging===true&&url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port!=='';
  if((!local&&url.protocol!=='https:')||url.username||url.password||url.pathname!=='/'||url.search||url.hash||(!local&&!/(^|[.-])staging([.-]|$)/.test(url.hostname))||['happybearlandia.fly.dev','happybearlandia.com','www.happybearlandia.com'].includes(url.hostname))throw Error('Explicit HTTPS staging origin required');
  if(config.environment!=='staging'||!config.app||!config.buildSha?.match(/^[a-f0-9]{40}$/)||config.approvedOrigin!==url.origin||config.concurrencyPrerequisite!=='SHE-42 verified'||config.disposableData!==true)throw Error('Staging identity, build, approval, disposable data and verified SHE-42 required');
  return url.origin;
}
export function summarize(samples) {
  return Object.fromEntries([...new Set(samples.map(s=>s.kind))].map(kind=>{
    const rows=samples.filter(s=>s.kind===kind),times=rows.map(s=>s.ms).sort((a,b)=>a-b),errors=rows.filter(s=>!s.ok).length;
    const percentile=p=>times[Math.ceil(times.length*p)-1];
    return [kind,{requests:rows.length,p50Ms:percentile(.5),p95Ms:percentile(.95),errors,errorRate:errors/rows.length,overloadResponses:rows.filter(s=>s.status===429||s.status===503).length}];
  }));
}
export async function runLoad(config,{execute=false,fetchImpl=fetch}={}) {
  const origin=validateTarget(config);
  const plan={version:1,measurementEnvironment:config.localStaging?'local staging (no production capacity inference)':'staging',origin,app:config.app,buildSha:config.buildSha,modelVersion:VERSION,recipe,users:2,journeysPerUser:2,maxRequests:65,requestTimeoutMs:10000,maxResponseBytes:2*1024*1024,assumptions:'Synthetic illustrative uncalibrated city; not an empirical forecast.'};
  if(!execute)return {dryRun:true,plan};
  const samples=[],createdExperimentIds=[];let count=0,active=0,peak=0,stopped=false;
  const started=performance.now();
  async function request(kind,path,body) {
    if(stopped||++count>plan.maxRequests)throw Error('Request budget exhausted');
    const start=performance.now();active++;peak=Math.max(peak,active);
    let status=null,ok=false,failure=null;
    try {
      const response=await fetchImpl(origin+path,{method:body?'POST':'GET',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(10000),headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
      status=response.status;
      const reader=response.body?.getReader();let bytes=0;const chunks=[];
      if(reader)try {while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>plan.maxResponseBytes)throw Error('Response limit');chunks.push(part.value);}}finally{await reader.cancel();}
      ok=body&&kind==='create'?status===202:status===200;
      if(!ok)throw Error('Unexpected status');
      if(['ready','create','status','replay'].includes(kind)) {
        const record=JSON.parse(await new Blob(chunks).text());
        if(kind==='ready'&&(record.status!=='ready'||record.buildId!==config.buildSha))throw Error('Staging readiness/build mismatch');
        if(kind==='create'&&!/^city_[a-zA-Z0-9_-]+$/.test(record?.id))throw Error('Invalid experiment identity');
        if(kind==='status'&&!['queued','running','complete'].includes(record?.status))throw Error('Experiment failed or invalid status');
        if(kind==='replay') {
          const expectedId=path.split('/')[3],identity=record?.identity,state=record?.state;
          if(identity?.experimentId!==expectedId||identity?.scenarioId!==body.scenarioId||identity?.runIndex!==body.runIndex||identity?.runId!==`${body.scenarioId}-${body.runIndex}`||record?.verification?.status!=='matched'||state?.version!==VERSION||state?.seed!==recipe.city.seed||state?.month!==recipe.months||!Array.isArray(record?.steps)||record.steps.length!==recipe.months)throw Error('Invalid replay identity, verification or seeded horizon');
        }
        if(kind==='create')createdExperimentIds.push(record.id);
        return record;
      }
    } catch(error) {
      ok=false;
      failure=error.name==='TimeoutError'?'timeout':'request or contract failure';
      throw error;
    } finally {
      samples.push({kind,status,ok,...(failure?{failure}:{}),ms:performance.now()-start});active--;
      if(!ok)stopped=true;
    }
  }
  async function user() {
    for(let journey=0;journey<2&&!stopped;journey++) {
      await request('homepage','/');
      await request('asset','/world/future-machine/main.js');
      const created=await request('create','/api/city-experiments',recipe);
      if(!/^city_[a-zA-Z0-9_-]+$/.test(created?.id))throw Error('Invalid experiment identity');
      let complete=false;
      for(let poll=0;poll<10&&!stopped;poll++) {
        await new Promise(resolve=>setTimeout(resolve,1000));
        const record=await request('status',`/api/city-experiments/${created.id}`);
        if(record.status==='failed')throw Error('Experiment failed');
        if(record.status==='complete'){complete=true;break;}
      }
      if(!complete)throw Error('Completion deadline');
      await request('replay',`/api/city-experiments/${created.id}/replay`,{runIndex:0,scenarioId:'baseline'});
    }
  }
  const guarded=()=>user().catch(error=>{stopped=true;throw error;});
  // Verify the serving build before any scenario write. Configuration is an
  // operator assertion; this response independently checks readiness and SHA.
  let outcomes;
  try {
    await request('ready','/api/ready');
    outcomes=await Promise.allSettled([guarded(),guarded()]);
  } catch {
    outcomes=[{status:'rejected'}];
  }
  const failed=outcomes.some(o=>o.status==='rejected');
  return {dryRun:false,plan,observedAt:new Date().toISOString(),ok:!failed,createdExperimentIds,samples,summary:summarize(samples),saturation:{clientPeakInFlight:peak,clientElapsedMs:performance.now()-started,serverCpu:null,serverMemory:null,serverQueueDepth:null,note:'429/503 are observed overload signals; server resource saturation requires operator metrics.'}};
}
if(import.meta.main) {
  try {
    const args=process.argv.slice(2);
    if(args.length<1||args.length>2||args[1]&&args[1]!=='--execute')throw Error('Usage: bun ops/backend-load-test.mjs staging-config.json [--execute]');
    const result=await runLoad(await Bun.file(args[0]).json(),{execute:args[1]==='--execute'});
    console.log(JSON.stringify(result,null,2));if(result.ok===false)process.exitCode=1;
  }catch{console.error('Load test refused or failed; check staging configuration and prerequisites.');process.exitCode=1;}
}
