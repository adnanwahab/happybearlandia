import {compareRecordedRuns, comparisonCompatibility} from './paired-comparison.js';
/** Dependency-injected read-only API. loadRun must enforce visibility before returning records. */
export function createPairedComparisonHandler({loadRun,listRuns,metrics=[]}) {
 const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 return async request=>{
  if(request.method!=='GET')return json({error:'Use GET for recorded comparisons'},405);
  const url=new URL(request.url);
  for(const key of new Set(url.searchParams.keys()))if(url.searchParams.getAll(key).length!==1)return json({error:'Duplicate query parameter'},400);
  const baselineId=url.searchParams.get('baseline'),childId=url.searchParams.get('child');
  if(!baselineId||baselineId.length>1024||childId?.length>1024)return json({error:'Provide bounded baseline and optional child run IDs'},400);
  try {
   const baseline=await loadRun(baselineId,request);if(!baseline)return json({error:'Baseline run unavailable'},404);
   if(!childId) {const listed=await listRuns(baseline,request),rows=Array.isArray(listed)?listed:listed.items;return json({baseline:baselineId,incomplete:!Array.isArray(listed)&&listed.incomplete===true,nextCursor:Array.isArray(listed)?null:listed.nextCursor??null,candidates:rows.map(row=>({runId:row.snapshot?.context.runId??row.runId, ...comparisonCompatibility(baseline,row)}))});}
   const child=await loadRun(childId,request);if(!child)return json({error:'Child run unavailable'},404);
   return json(compareRecordedRuns(baseline,child,{metrics:[...metrics,...(baseline.metricDefinitions||[]),...(child.metricDefinitions||[])],entityId:url.searchParams.get('entityId')||undefined}));
  }catch(error){return json({error:error.status&&error.status<500?error.message:'Recorded comparison unavailable'},error.status||500);}
 };
}

/** Bounded store adapter; partial histories are explicitly incompatible. */
export function createStoredPairedComparisonHandler({store}) {
 const clean=row=>{const {contentHash,...record}=row;return record;};
 const loadRun=async id=>{
  const run=store.getRun(id);if(!run||run.visibility==='private')return null;
  const fields={events:'listEvents',observations:'listObservations',assumptions:'listAssumptions',edges:'listEdges'};
  const snapshot={context:{...run.context}},pages=[];
  for(const [key,method]of Object.entries(fields)){const page=store[method](id,{limit:1000});snapshot[key]=page.items.map(clean);pages.push(page);}
  snapshot.context.tick=Math.max(run.context.tick,...[...snapshot.events,...snapshot.observations,...snapshot.assumptions,...snapshot.edges].map(row=>row.context.tick));
  return {...run,...run.metadata,runId:id,snapshot,incomplete:pages.some(p=>p.nextCursor!=null)};
 };
 return createPairedComparisonHandler({loadRun,listRuns:async baseline=>{
  const context=baseline.snapshot.context,page=store.listRuns({limit:100,universeId:context.universeId,worldId:context.worldId,scenarioId:context.scenarioId});
  const rows=await Promise.all(page.items.map(run=>loadRun(run.id)));return {items:rows.filter(Boolean),incomplete:page.nextCursor!=null,nextCursor:page.nextCursor};
 }});
}
