/** Rendering aggregate only: never changes resident state. All explicit residents,
 * including those at home, count once; weights are represented cohort mass. */
export function populationDensity(model, size=32) {
  if(!Number.isInteger(size)||size<1||size>128)throw Error('Density grid size must be 1–128');
  // Geography bounds are recomputed from run locations so saved checkpoints need
  // no extra cache state. No camera-dependent clamping or invented positions.
  const bounds={minX:0,maxX:0,minZ:0,maxZ:0};
  for(const point of model.locations||[]){if(Number.isFinite(point.x)){bounds.minX=Math.min(bounds.minX,point.x);bounds.maxX=Math.max(bounds.maxX,point.x);}if(Number.isFinite(point.z)){bounds.minZ=Math.min(bounds.minZ,point.z);bounds.maxZ=Math.max(bounds.maxZ,point.z);}}
  bounds.minX--;bounds.minZ--;bounds.maxX++;bounds.maxZ++;
  const explicit=new Uint32Array(size*size);let missing=0,outside=0;
  for(let i=0;i<model.people.x.length;i++){
    const x=model.people.x[i],z=model.people.z[i];
    if(!Number.isFinite(x)||!Number.isFinite(z)){missing++;continue;}
    if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ){outside++;continue;}
    const col=Math.min(size-1,Math.floor((x-bounds.minX)/(bounds.maxX-bounds.minX)*size)),row=Math.min(size-1,Math.floor((z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*size));
    explicit[row*size+col]++;
  }
  const counts=Array.from(explicit),weight=model.weight;
  return {schemaVersion:'population-density.v1',modelVersion:model.modelVersion,seed:model.config.seed,tick:model.tick,minute:model.minute,size,bounds,explicit:counts,weighted:counts.map(n=>n*weight),weight,total:model.people.x.length,located:counts.reduce((a,b)=>a+b,0),missing,outside,representedTotal:model.people.x.length*weight,source:'All current synthetic resident positions; no visible-sample extrapolation',units:'counts per tile; not people per square kilometre'};
}
export function densityColor(count,max){return count===0?'#142d35':`hsl(${Math.round(180-160*count/Math.max(1,max))} 75% 55%)`;}
export function densityLegend(field,mode){
  if(!field)return 'Density unavailable for this checkpoint.';
  const weighted=mode==='weighted',values=weighted?field.weighted:field.explicit,max=Math.max(0,...values),total=weighted?field.representedTotal:field.total;
  return `${weighted?'Weighted cohorts · represented people':'Explicit active agents · all simulated residents'} · tick ${field.tick} · minute ${field.minute} · 0 (dark) → ${max.toLocaleString()} per tile (orange) · total ${total.toLocaleString()} · mapped ${(field.located*(weighted?field.weight:1)).toLocaleString()} · missing ${field.missing} agents · outside ${field.outside} agents. Synthetic model state; ${field.units}.`;
}
