/** Read-only comparison of recorded causal snapshots. Never runs or invents outcomes.
 * Inputs: {snapshot:CausalSnapshot, status, manifest, provenance?, interventions?,
 * distributions?: {[metricId]: {[entityId]: {tick,unit,samples:[{seed,value}]}}}}.
 * A manifest is supplied by the recording model, never inferred from output values.
 * Scalar comparisons require matching world, scenario, model, seed and current tick.
 */
import {CausalSnapshotSchema, MetricDefinitionSchema} from '../shared/causality/index.js';
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
const quantile = (values,q) => {const x=[...values].sort((a,b)=>a-b),p=(x.length-1)*q,l=Math.floor(p);return x[l]+(x[Math.ceil(p)]-x[l])*(p-l);};
export function pairedDistribution(baseline=[],child=[]) {
 const index = rows => {const map=new Map();let invalid=0;for(const row of rows){if(!row||!['string','number'].includes(typeof row.seed)||row.seed===''||!Number.isFinite(row.value)){invalid++;continue;}const key=String(row.seed);if(map.has(key))throw new TypeError('Duplicate seed in metric distribution');map.set(key,row.value);}return {map,invalid};};
 const left=index(baseline),right=index(child),a=left.map,b=right.map,pairs=[...a].filter(([seed])=>b.has(seed)).map(([seed,value])=>({seed,baseline:value,child:b.get(seed),delta:b.get(seed)-value}));
 const deltas=pairs.map(p=>p.delta);
 return {status:pairs.length?'available':'unavailable',pairs,count:pairs.length,invalidBaseline:left.invalid,invalidChild:right.invalid,unpairedBaseline:a.size-pairs.length,unpairedChild:b.size-pairs.length,mean:pairs.length?deltas.reduce((s,x)=>s+x,0)/pairs.length:null,p10:pairs.length?quantile(deltas,.1):null,p50:pairs.length?quantile(deltas,.5):null,p90:pairs.length?quantile(deltas,.9):null,notice:'Empirical paired-seed range; not a confidence interval or forecast.'};
}
export function comparisonCompatibility(baseline, child) {
 const reasons=[];
 for(const run of [baseline,child]){if(run?.incomplete)reasons.push('Recorded data is incomplete');if(run?.status&&run.status!=='completed')reasons.push('Run is not completed');}
 if(!baseline?.snapshot||!child?.snapshot)reasons.push('Recorded causal snapshot unavailable');
 else {const a=baseline.snapshot.context,b=child.snapshot.context;for(const key of ['universeId','worldId','scenarioId','modelVersion','seed','tick'])if(a[key]!==b[key])reasons.push(`${key} differs`);}
 if(!baseline?.manifest||!child?.manifest)reasons.push('Model manifest unavailable');
 else if(stable(baseline.manifest)!==stable(child.manifest))reasons.push('Model manifests differ');
 return {compatible:!reasons.length,reasons};
}
function graphDifference(a,b) {
 // Compare exact endpoint identity. Do not infer cross-run node correspondences.
 const key=e=>stable([e.fromId,e.toId,e.relation]);
 const left=new Map(a.map(e=>[key(e),e])),right=new Map(b.map(e=>[key(e),e]));
 return {status:'available',removed:[...left].filter(([k])=>!right.has(k)).map(([,e])=>e),added:[...right].filter(([k])=>!left.has(k)).map(([,e])=>e),changed:[...left].filter(([k,e])=>right.has(k)&&stable([e.confidence,e.evidenceIds,e.provenance.kind,e.provenance.source])!==stable([right.get(k).confidence,right.get(k).evidenceIds,right.get(k).provenance.kind,right.get(k).provenance.source])).map(([k,before])=>({before,after:right.get(k)}))};
}
export function compareRecordedRuns(baseline,child,{metrics=[],entityId}={}) {
 for(const run of [baseline,child])if(run?.snapshot)CausalSnapshotSchema.parse(run.snapshot);
 const definitions=new Map();for(const m of metrics){const d=MetricDefinitionSchema.parse(m);if(definitions.has(d.id)&&stable(definitions.get(d.id))!==stable(d))throw new TypeError('Conflicting metric definitions');definitions.set(d.id,d);}
 const compatibility=comparisonCompatibility(baseline,child);
 const result={schemaVersion:'paired-future-comparison.v1',compatibility,baseline:{runId:baseline?.snapshot?.context.runId??baseline?.runId??null,context:baseline?.snapshot?.context??null,manifest:baseline?.manifest??null,provenance:baseline?.provenance??null,status:baseline?.status??'unknown'},child:{runId:child?.snapshot?.context.runId??child?.runId??null,context:child?.snapshot?.context??null,manifest:child?.manifest??null,provenance:child?.provenance??null,status:child?.status??'unknown'},interventions:child?.interventions??[],metrics:[],graph:{status:'unavailable',reason:compatibility.reasons.join('; ')},notice:'Recorded model differences are conditional simulation results, not observed effects or forecasts.'};
 if(!compatibility.compatible)return result;
 const a=baseline.snapshot,b=child.snapshot;
 const keys=new Map();for(const row of [...a.observations,...b.observations])if(!entityId||row.entityId===entityId)keys.set(stable([row.entityId,row.metricId,row.context.tick]),row);
 for(const row of keys.values()) {
  const matches=s=>s.observations.filter(x=>x.entityId===row.entityId&&x.metricId===row.metricId&&x.context.tick===row.context.tick);
  const l=matches(a),r=matches(b),definition=definitions.get(row.metricId);
  let reason=!definition?'Metric definition unavailable':l.length!==1||r.length!==1?'Missing or ambiguous recorded observation':l[0].unit!==r[0].unit||l[0].unit!==definition.unit?'Metric units differ':null;
  const available=!reason;
  const samples=run=>{const d=run.distributions?.[row.metricId]?.[row.entityId];return d?.tick===row.context.tick&&d?.unit===definition?.unit&&Array.isArray(d.samples)?d.samples:[];};
  result.metrics.push({metricId:row.metricId,entityId:row.entityId,tick:row.context.tick,label:definition?.label??row.metricId,unit:definition?.unit??null,status:available?'available':'unavailable',reason,baseline:available?l[0].value:null,child:available?r[0].value:null,delta:available?r[0].value-l[0].value:null,provenance:{baseline:l[0]?.provenance??null,child:r[0]?.provenance??null},distribution:available?pairedDistribution(samples(baseline),samples(child)):{status:'unavailable'}});
 }
 result.graph={...graphDifference(a.edges,b.edges),notice:'Edges are matched by exact recorded endpoint IDs and relation; run-local node IDs may appear as additions/removals.'};return result;
}
