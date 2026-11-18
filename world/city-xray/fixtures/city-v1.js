import { readFrame, SCHEMA_VERSION } from '../contract.js';
/** Authored diagnostic geometry, not a city simulator or observed resident/trip ledger.
 * Local PRNG is independent of simulation RNG. Coordinates have no geographic mapping. */
export function cityFixture(seed = 0) {
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff) throw new TypeError('uint32 seed required');
 let state=seed;
 const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
 const runId=`synthetic-city-v1:${seed}`,coordinateId='synthetic-grid.v1';
 const scope={runId,coordinateId};
 const clock={authority:'synthetic-demo',unit:'minute',value:60,tick:4,checkpoint:`${runId}:minute60`};
 const intersections=[],roads=[],entities=[],samples=[];
 for(let z=0;z<17;z++) for(let x=0;x<17;x++) intersections.push({id:`junction:${x}:${z}`,...scope,position:[(x-8)*80,0,(z-8)*80]});
 const junction=(x,z)=>intersections[z*17+x];
 for(let z=0;z<17;z++) for(let x=0;x<17;x++) for(const [dx,dz] of [[1,0],[0,1]]){
  if(x+dx>16||z+dz>16) continue;
  const a=junction(x,z),b=junction(x+dx,z+dz);
  roads.push({id:`road:${a.id}:${b.id}`,...scope,intersectionIds:[a.id,b.id],path:[a.position,b.position]});
 }
 // Gaussian distance falloff is an authored visual distribution, not behavioral activity.
 for(let i=0;i<4096;i++){
  const center=[[0,0],[320,-240],[-320,240]][i%3];
  const x=Math.max(-630,Math.min(630,center[0]+(random()+random()+random()-1.5)*400));
  const z=Math.max(-630,Math.min(630,center[1]+(random()+random()+random()-1.5)*400));
  const id=`symbol-place:${i}`;
  entities.push({id,...scope,kind:'place',position:[Math.round(x*100)/100,0,Math.round(z*100)/100]});
  const value=i===0?0:i===1?null:Math.round(100*Math.exp(-Math.hypot(x-center[0],z-center[1])/220));
  samples.push({metricId:'demo-intensity',targetId:id,runId,units:'synthetic-symbols',value,representedCount:null});
 }
 return readFrame({schemaVersion:SCHEMA_VERSION,identity:{engine:{id:'diagnostic-fixture',version:'1'},model:{id:'authored-spatial-distribution',version:'1'},run:{id:runId,version:'1'},source:{id:'city-grid-fixture',version:'1'}},seed,clock,coordinates:{id:coordinateId,frame:'local-x-y-z',units:'model-unit',origin:[0,0,0],axes:'x-east,y-up,z-south'},provenance:{kind:'synthetic-demonstration',label:'Synthetic demonstration geometry and symbols; no observed people, trips or recorded model results',sourceRef:'city-grid-fixture',retention:{limit:4096,missingCount:1,policy:'Complete authored fixture; one deliberately missing intensity'}},intersections,roads,entities,metrics:[{id:'demo-intensity',quantity:'Authored demonstration intensity',units:'synthetic-symbols',clock,missingCount:1,normalization:{method:'fixed-linear',min:0,max:100},semantics:'Visual distribution only; no population weight or encounter inference'}],samples,supportedLayers:['roads','columns','particles'],display:{symbolCount:4095,maxSymbols:4096,maxColumns:544,symbolMeaning:'One dot per nonmissing authored place; zero is present; represented residents unavailable'}});
}
