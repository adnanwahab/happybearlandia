import {CityStore,validateReadQuery} from './storage.js';
import {createCity} from './seed.js';
import {createEngine,addIntervention,scheduleShock} from './engine.js';
import {VERSION,validateState} from './contracts.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export const SAVED_QUERIES={
  'Construction bottlenecks':"SELECT event_type, geography_id, COUNT(*) AS events FROM system_events WHERE system = 'construction' GROUP BY event_type, geography_id ORDER BY events DESC",
  'Overloaded schools':"SELECT facility_id, MAX(utilization) AS peak_utilization FROM service_state WHERE facility_id LIKE 'school%' GROUP BY facility_id HAVING MAX(utilization) > 1",
  'Household move reasons':'SELECT primary_reason, COUNT(*) AS moves FROM moves GROUP BY primary_reason ORDER BY moves DESC',
  'Utility failures':'SELECT district_id, utility, MIN(service_level) AS worst_service FROM utility_state GROUP BY district_id, utility ORDER BY worst_service',
  'Fiscal stress':'SELECT run_id, period, revenue, operating_expense, balance FROM municipal_finance WHERE revenue < operating_expense ORDER BY period',
  'Compare plans':'SELECT r.scenario_id, m.metric_id, AVG(m.value) AS mean_value, MIN(m.value) AS minimum, MAX(m.value) AS maximum FROM runs r JOIN run_metrics m ON r.run_id = m.run_id GROUP BY r.scenario_id, m.metric_id',
  'Causal events':'SELECT simulation_time, system, event_type, geography_id, payload_json FROM system_events ORDER BY event_id',
};
function workerCall(file,data,timeout=60000) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(file,import.meta.url).href),timer=setTimeout(()=>{worker.terminate();reject(new Error('Operation time limit exceeded'));},timeout);
    const end=()=>{clearTimeout(timer);worker.terminate();};
    worker.onmessage=({data})=>{end();data.error?reject(new Error(data.error)):resolve(data.result);};
    worker.onerror=event=>{end();reject(new Error(event.message||'Worker failed'));};worker.postMessage(data);
  });
}
export function normalizeExperiment(body={}) {
  if(!body||typeof body!=='object')throw new Error('Experiment object required');
  let initial=body.initial?structuredClone(body.initial):createCity(body.city||{});
  validateState(initial);
  if(initial.households.length>2000||initial.units.length>10000||initial.jobs.length>10000||initial.links.length>2048)throw new Error('City exceeds interactive experiment limits');
  if(!initial.provenance?.worldRevision||!initial.provenance?.datasetVersion||!initial.provenance?.populationSnapshot)throw new Error('World, population and dataset versions required');
  const runs=body.runs??10,months=body.months??24,retention=body.retention||'summary';
  if(!Number.isInteger(runs)||runs<1||runs>1000||!Number.isInteger(months)||months<1||months>120||!['summary','analysis','full'].includes(retention))throw new Error('Use 1–1,000 runs, 1–120 months and summary/analysis/full retention');
  const scenarios=body.scenarios||[{id:'baseline',interventions:[]},{id:'plan',interventions:body.interventions||[]}];
  if(!Array.isArray(scenarios)||scenarios.length<1||scenarios.length>8||new Set(scenarios.map(s=>s.id)).size!==scenarios.length)throw new Error('Use 1–8 uniquely named scenarios');
  if(runs*months*initial.households.length*scenarios.length>10000000||retention==='full'&&runs>5)throw new Error('Experiment exceeds workload limit; use summary retention or fewer runs/months');
  for(const scenario of scenarios) {
    if(!/^[\w-]{1,64}$/.test(scenario.id)||!Array.isArray(scenario.interventions||[])||(scenario.interventions||[]).length>100)throw new Error('Invalid scenario');
    let check=initial;for(const intervention of scenario.interventions||[])check=addIntervention(check,intervention);
  }
  if(!Array.isArray(body.shocks||[])||(body.shocks||[]).length>64)throw new Error('At most 64 shocks');
  for(const shock of body.shocks||[])initial=scheduleShock(initial,shock);
  return {version:VERSION,title:String(body.title||'Coupled city experiment').slice(0,200),initial,runs,months,retention,scenarios,modelManifest:createEngine().manifest,assumptions:'Illustrative uncalibrated coefficients; district transport and coarse monthly markets. Not an empirical forecast.'};
}
export function createCityApi({root,store:providedStore}={}) {
  let store=providedStore;const getStore=()=>store||=new CityStore(root);const active=new Set();
  async function execute(id,manifest) {
    const db=getStore();db.status(id,'running');
    try {
      for(let index=0;index<manifest.runs;index++)for(const scenario of manifest.scenarios) {
        let initial=manifest.initial;for(const intervention of scenario.interventions||[])initial=addIntervention(initial,intervention);
        const seed=(initial.seed+index)>>>0,result=await workerCall('./run.worker.js',{initial,seed,months:manifest.months,retention:manifest.retention});
        await db.saveRun(id,{...result,runId:`${scenario.id}-${index}`,scenarioId:scenario.id,index,seed,retention:manifest.retention});
      }
      db.status(id,'complete');
    }catch(error){db.status(id,'failed',error.message);}finally{active.delete(id);}
  }
  return async function handleCityApi(request) {
    const url=new URL(request.url),match=url.pathname.match(/^\/api\/(city-experiments|experiments)(?:\/(city_[\w-]+)(?:\/(tables|query|export|replay|brief|lineage))?)?\/?$/);
    if(!match||match[1]==='experiments'&&!match[2])return null;
    const [,namespace,id,action]=match;
    if(namespace==='experiments'&&!action)return null;
    try {
      const db=getStore();
      if(!id) {
        if(request.method==='GET')return json({experiments:db.list(),savedQueries:SAVED_QUERIES});
        if(request.method!=='POST')return json({error:'Method not allowed'},405);
        if(active.size>=2)return json({error:'Two experiments are already running'},429);
        if(Number(request.headers.get('content-length')||0)>4000000)return json({error:'Request too large'},413);
        const text=await request.text();if(text.length>4000000)return json({error:'Request too large'},413);
        const manifest=normalizeExperiment(JSON.parse(text)),newId=`city_${crypto.randomUUID().replaceAll('-','')}`;
        db.create(newId,manifest);db.saveWorld(newId,manifest.initial);active.add(newId);void execute(newId,manifest);
        return json({id:newId,status:'queued',url:`/api/city-experiments/${newId}`},202);
      }
      const record=db.get(id);if(!record)return json({error:'Experiment not found'},404);
      if(!action) {
        if(request.method!=='GET')return json({error:'Method not allowed'},405);
        const progress=await workerCall('./query.worker.js',{path:db.path(id),sql:'SELECT COUNT(*) AS completed FROM runs'},3000);
        const metrics=await workerCall('./query.worker.js',{path:db.path(id),sql:SAVED_QUERIES['Compare plans']},3000);
        return json({id,status:record.status,error:record.error,completed:progress.rows[0].completed,total:record.manifest.runs*record.manifest.scenarios.length,metrics:metrics.rows,manifest:record.manifest});
      }
      if((action==='query'||action==='replay')?request.method!=='POST':request.method!=='GET')return json({error:'Method not allowed'},405);
      if(action==='tables')return json({tables:db.tables(id),savedQueries:SAVED_QUERIES});
      if(action==='query') {
        const body=await request.json();validateReadQuery(body.sql);
        return json(await workerCall('./query.worker.js',{path:db.path(id),sql:body.sql},3000));
      }
      if(action==='lineage')return json({version:record.manifest.version,provenance:record.manifest.initial.provenance,modelManifest:record.manifest.modelManifest,scenarios:record.manifest.scenarios,dependencyGraph:record.manifest.modelManifest.map(p=>({system:p.id,dependsOn:p.dependencies})),retention:record.manifest.retention,sampling:record.manifest.retention==='analysis'?'Every tenth decision, trip, move and business row in deterministic row order':'No sampling for full; aggregate observations and system events for summary',assumptions:record.manifest.assumptions});
      if(action==='replay') {
        if(active.size>=2)return json({error:'Experiment capacity busy'},429);
        const {runIndex=0,scenarioId=record.manifest.scenarios[0].id}=await request.json();
        if(record.manifest.version!==VERSION)throw new Error('Recorded model version unavailable');
        if(!Number.isInteger(runIndex)||runIndex<0||runIndex>=record.manifest.runs)throw new Error('Invalid run index');
        const scenario=record.manifest.scenarios.find(s=>s.id===scenarioId);if(!scenario)throw new Error('Unknown scenario');
        let initial=record.manifest.initial;for(const intervention of scenario.interventions||[])initial=addIntervention(initial,intervention);
        const token=`replay-${crypto.randomUUID()}`;active.add(token);
        try {return json(await workerCall('./run.worker.js',{initial,seed:(initial.seed+runIndex)>>>0,months:record.manifest.months,replay:true},60000));}finally{active.delete(token);}
      }
      if(action==='export') {
        if(record.status!=='complete')return json({error:'Export is available after completion'},409);
        if(url.searchParams.get('format')==='csv') {
          const table=url.searchParams.get('table')||'run_metrics';if(!db.tables(id).some(t=>t.name===table))throw new Error('Unknown table');
          const result=await workerCall('./query.worker.js',{path:db.path(id),sql:`SELECT * FROM ${table}`},3000);
          const columns=db.tables(id).find(t=>t.name===table).columns.map(c=>c.name);
          const cell=value=>{let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
          const csv=[columns.map(cell).join(','),...result.rows.map(row=>columns.map(k=>cell(row[k])).join(','))].join('\r\n');
          return new Response(csv,{headers:{'content-type':'text/csv','content-disposition':`attachment; filename="${table}.csv"`,'x-result-truncated':String(result.truncated)}});
        }
        return new Response(db.export(id),{headers:{'content-type':'application/vnd.sqlite3','content-disposition':`attachment; filename="${id}.sqlite"`}});
      }
      if(action==='brief') {
        if(record.status!=='complete')return json({error:'Brief is available after completion'},409);
        const result=await workerCall('./query.worker.js',{path:db.path(id),sql:SAVED_QUERIES['Compare plans']},3000);
        const lines=['# '+record.manifest.title,'',record.manifest.assumptions,'',`Runs per scenario: ${record.manifest.runs}; horizon: ${record.manifest.months} months; model: ${VERSION}.`,'','| Scenario | Metric | Mean | Min | Max |','| --- | --- | ---: | ---: | ---: |',...result.rows.map(r=>`| ${r.scenario_id} | ${r.metric_id} | ${r.mean_value.toFixed(2)} | ${r.minimum.toFixed(2)} | ${r.maximum.toFixed(2)} |`),'','Observed differences are conditional on the synthetic inputs and assumed equations. Min/max values describe the simulated sample, not confidence intervals.','',`Data and replay manifest: /api/city-experiments/${id}/lineage`];
        return new Response(lines.join('\n'),{headers:{'content-type':'text/markdown','content-disposition':`attachment; filename="${id}-brief.md"`}});
      }
    }catch(error){return json({error:error.message},400);}
  };
}
