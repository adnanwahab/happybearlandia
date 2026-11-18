import { cityFixture } from '../fixtures/city-v1.js';
import { readFrame } from '../contract.js';
/** Independent authored road metric, not a projection claiming place intensity is traffic. */
export function roadFrame(seed=0) {
 const f=structuredClone(cityFixture(seed));
 f.identity.model={id:'authored-road-intensity',version:'1'};
 f.identity.run={id:`synthetic-road-v1:${seed}`,version:'1'};
 f.identity.source={id:'city-grid-road-demo',version:'1'};
 f.clock.checkpoint=`${f.identity.run.id}:minute60`;
 for(const row of [...f.intersections,...f.roads,...f.entities])row.runId=f.identity.run.id;
 f.provenance={kind:'synthetic-demonstration',label:'Authored synthetic intensity on schematic roads; no people, trips, traffic observations or recorded model results',sourceRef:f.identity.source.id,retention:{limit:f.roads.length,missingCount:1,policy:'Complete authored road frame; one null, zero retained'}};
 f.metrics=[{id:'authored-road-intensity',quantity:'Authored synthetic intensity',units:'synthetic-symbols',clock:f.clock,missingCount:1,normalization:{method:'fixed-linear',min:0,max:100},semantics:'Version1 authored road-midpoint distance field; no behavioral inference. Eight shafts repeat each road sample; not eight measurements.'}];
 f.samples=f.roads.map((r,i)=>{
  const p=r.path[0].map((v,k)=>(v+r.path.at(-1)[k])/2);
  // Fixed authored clusters, not fitted to simulation outcomes; seed only affects fixture places.
  const d=Math.min(...[[-320,240],[320,-240],[0,0]].map(([x,z])=>Math.hypot(p[0]-x,p[2]-z)));
  return {metricId:f.metrics[0].id,targetId:r.id,runId:f.identity.run.id,units:'synthetic-symbols',value:i===0?0:i===1?null:Math.round(100*Math.exp(-d/420)),representedCount:null};
 });
 f.display={symbolCount:543,maxSymbols:544,maxColumns:4352,symbolMeaning:'Up to eight repeated display shafts per nonmissing authored road sample; zero has zero height'};
 return readFrame(f);
}
