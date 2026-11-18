/** Read-only projection of recorded City metrics; never executes a simulation. */
import {deriveSeed} from './world-generator.js';
export const SUMMARY_MAX_BYTES=512000;
export const PAGE_MAX_BYTES=2000000;
export const metricDefinitions=Object.entries({
 population:['people','Sum of synthetic household sizes'],households:['households','Recorded household count'],
 housingUnits:['units','Built housing inventory'],availableUnits:['units','Units marked available'],
 meanRent:['synthetic USD/month','Arithmetic mean rent across all units; zero for empty inventory'],
 unhoused:['households','Households without assigned units'],employed:['workers','Workers with assigned jobs'],
 jobs:['jobs','Recorded job positions'],businesses:['businesses','Businesses marked open'],
 meanTravelMinutes:['minutes/link','Unweighted mean district-link travel time; not mean experienced commute'],
 overloadedServices:['facilities','Facilities above capacity'],utilityFailures:['utilities','Utilities below full service'],
 balance:['synthetic USD stock','Treasury balance'],debt:['synthetic USD stock','Public debt'],
 completedProjects:['projects','Projects at completion stage']
}).map(([id,[unit,definition]])=>({id,unit,definition}));
export function projectRuns(record){
 return Array.from({length:record.job.total},(_,runIndex)=>{
  const row=record.runs[runIndex];
  return {runIndex,runId:`${record.id}:pair:${runIndex}`,seed:row?.seed??deriveSeed(record.input.simulation.seed,runIndex),status:row?.status||'pending',attempts:row?.attempts||0,...(row?.error?{error:row.error}:{}),months:row?.status==='completed'?Array.from({length:record.input.simulation.months+1},(_,month)=>{
   const a=row.baseline.metricsTimeline.find(r=>r.month===month)?.metrics,b=row.proposal.metricsTimeline.find(r=>r.month===month)?.metrics;
   return Object.fromEntries(metricDefinitions.map(({id})=>[id,Number.isFinite(a?.[id])&&Number.isFinite(b?.[id])?[a[id],b[id],b[id]-a[id]]:null]));
  }):[]};
 });
}
function distribution(values,total){
 const sorted=values.toSorted((a,b)=>a-b),n=sorted.length;
 const quantile=p=>n?sorted[Math.floor((n-1)*p)]:null;
 return {count:n,missing:total-n,min:sorted[0]??null,p05:quantile(.05),median:quantile(.5),p95:quantile(.95),max:sorted.at(-1)??null,mean:n?values.reduce((a,b)=>a+b,0)/n:null};
}
export function summarize(record,{month,offset,limit}){
 const pairs=record.projection;
 return {schemaVersion:'policy-impact-summary.v1',id:record.id,url:record.url,supportStatus:record.supportStatus,
 job:record.job,progress:{completed:record.job.completed,failed:record.job.failed,pending:record.job.total-record.job.completed-record.job.failed,total:record.job.total},
 modelVersion:record.modelVersion,mappingVersion:record.mappingVersion,seed:record.input.simulation.seed,
 source:{system:record.input.source.system,proposalId:record.input.source.proposalId,versionId:record.input.source.versionId,contentHash:record.input.source.contentHash},
 recordedMonths:[...new Set(pairs.flatMap(p=>p.months.map((_,i)=>i)))],checkpointMonths:record.checkpointMonths,month,
 metricDefinitions,distributions:metricDefinitions.map(({id})=>{
  const values=pairs.map(p=>p.months[month]?.[id]).filter(Boolean);
  return {metricId:id,baseline:distribution(values.map(v=>v[0]),record.job.total),proposal:distribution(values.map(v=>v[1]),record.job.total),delta:distribution(values.map(v=>v[2]),record.job.total)};
 }),pairs:pairs.slice(offset,offset+limit).map(({months,...pair})=>({...pair,metrics:months[month]||null})),
 page:{offset,limit,total:pairs.length,nextOffset:offset+limit<pairs.length?offset+limit:null},
 unsupported:record.parameterDiff.filter(p=>p.supportStatus!=='supported'),uncertainty:record.uncertainty};
}
export function integerQuery(params,key,fallback,max){
 if(!params.has(key))return fallback;
 const raw=params.get(key);
 if(!/^(0|[1-9]\d*)$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>max)throw Object.assign(new Error(`Invalid ${key}`),{status:400});
 return Number(raw);
}
export function validateQuery(params,allowed){
 for(const key of params.keys())if(!allowed.includes(key)||params.getAll(key).length!==1)throw Object.assign(new Error('Unknown or duplicate query parameter'),{status:400});
}
