import {VERSION} from './contracts.js';

// Read-only projections of CityState. Registry v1 is provisional, not screenshot reconciliation.
export const DISTRICT_METRIC_VERSION = 'district-metrics.v1';
const count = (id,label,source,field,unit,predicate=()=>true) => ({id,label,source,field,unit,reducer:'count',predicate});
const entries = [
  {id:'population',label:'Population',source:'households',field:'size',unit:'persons',reducer:'sum'},
  count('households','Households','households',null,'households'),
  count('housing_units','Housing units','units',null,'units'),
  count('available_units','Available units','units','status','units',v=>v==='available'),
  {id:'mean_rental_unit_rent',label:'Mean rental-unit rent',source:'units',field:'rent',unit:'illustrative USD/month',reducer:'mean',filter:r=>r.tenure==='rental',filterField:'tenure'},
  count('unhoused_households','Unhoused households','households','unitId','households',v=>v===null),
  count('employed_workers','Employed workers','workers','jobId','workers',v=>v!==null),
  count('unfilled_jobs','Unfilled jobs','jobs','workerId','positions',v=>v===null),
  count('open_businesses','Open businesses','businesses','status','businesses',v=>v==='open'),
  {id:'outgoing_link_travel_time',label:'Mean outgoing-link travel time',source:'links',field:'travelTime',unit:'modeled minutes/link',reducer:'mean',districtField:'from'},
  count('overloaded_facilities','Overloaded facilities','facilities','utilization','facilities',v=>v>1),
  count('utility_shortfalls','Utility shortfalls','utilities','serviceLevel','networks',v=>v<1),
];
export function validateMetricRegistry(registry) {
  const ids=new Set();
  for(const metric of registry) {
    if(!metric.id || ids.has(metric.id))throw new Error('Duplicate/missing district metric ID');
    ids.add(metric.id);
  }
  return true;
}
validateMetricRegistry(entries);
export const DISTRICT_METRICS = Object.freeze(entries.map(row=>Object.freeze({...row,
  districtField:row.districtField??'districtId',evidenceClass:'synthetic monthly City state',
  denominator:row.reducer==='mean'?'valid eligible source records':null})));

function validSample(metric,row) {
  if(metric.filterField && typeof row[metric.filterField]!=='string')return false;
  if(!metric.field)return true;
  const value=row[metric.field];
  if(['size','rent','travelTime','utilization','serviceLevel'].includes(metric.field))return Number.isFinite(value)&&value>=0;
  if(['unitId','jobId','workerId'].includes(metric.field))return value===null || (typeof value==='string'&&value.length>0);
  return typeof value==='string' && value.length>0;
}

/** Missing collections/fields are unavailable. Complete empty counts are observed zeros; empty means are null. */
export function districtMetrics(state,context={}) {
  if(state?.schemaVersion!=='CityState.v1'||state.version!==VERSION||!Number.isInteger(state.month)||state.month<0||!Array.isArray(state.districts))throw new Error('Supported monthly CityState required');
  const ids=new Set(state.districts.map(d=>d.id));
  if(ids.size!==state.districts.length||[...ids].some(id=>typeof id!=='string'||!id))throw new Error('Unique district IDs required');
  return state.districts.flatMap(district=>DISTRICT_METRICS.map(metric=>{
    const source=state[metric.source];
    const rows=Array.isArray(source)?source.filter(r=>r[metric.districtField]===district.id):[];
    const unlocated=Array.isArray(source)?source.filter(r=>!ids.has(r[metric.districtField])).length:0;
    // Unassigned source rows prevent claims that the partition is complete.
    const invalid=rows.filter(r=>!validSample(metric,r)).length;
    const eligible=rows.filter(r=>validSample(metric,r)&&(!metric.filter||metric.filter(r)));
    const sum=eligible.reduce((n,r)=>n+(metric.reducer==='count'?Number(metric.predicate(r[metric.field])):r[metric.field]),0);
    const denominator=metric.reducer==='mean'?eligible.length:null;
    const reason=!Array.isArray(source)?'Source collection unavailable':unlocated?'Source records have unknown district':invalid?'Source fields unavailable':metric.reducer==='mean'&&!eligible.length?'No eligible source records':null;
    const value=reason?null:metric.reducer==='mean'?sum/denominator:sum;
    return {schemaVersion:DISTRICT_METRIC_VERSION,runId:context.runId??null,scenarioId:context.scenarioId??null,runIndex:context.runIndex??null,
      month:state.month,modelVersion:state.version,geographyType:'district',geographyId:district.id,districtName:district.name??district.id,
      metricId:metric.id,value,unit:metric.unit,numerator:reason?null:sum,denominator,sampleCount:eligible.length,
      coverage:{sourceRecords:rows.length,validRecords:rows.length-invalid,unlocatedRecords:unlocated},status:reason?'unavailable':'available',reason,
      cellValue:null,locationBasis:'unavailable',provenance:{source:metric.source,field:metric.field,reducer:metric.reducer,evidenceClass:metric.evidenceClass,seed:state.seed}};
  }));
}
