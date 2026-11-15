/** Fail closed when a geographic comparison cannot establish a common block. */
export function curtainCompatibility(projection) {
  if (!projection?.a?.length || !projection?.b?.length) return 'Both checkpoint inventories are required.';
  const rows=[...projection.a,...projection.b];
  if(rows.some(r=>r.record?.geometry && r.mapping!=='sourced-footprint')) return 'Unsupported or ambiguous footprint geometry.';
  const common=projection.a.filter(a=>projection.b.some(b=>a.collection===b.collection&&a.id===b.id));
  if(!common.length) return 'No common City entity establishes alignment.';
  for(const a of common){const b=projection.b.find(b=>a.collection===b.collection&&a.id===b.id);
    if(a.mapping!==b.mapping || a.x!==b.x || a.z!==b.z || JSON.stringify(a.polygon)!==JSON.stringify(b.polygon) || a.record?.sourceId!==b.record?.sourceId) return 'Checkpoint footprint alignment differs.';
  }
  return null;
}
export function curtainSlices(width, fraction) {
  const edge=Math.round(width*Math.min(1,Math.max(0,fraction)));
  return [{arm:0,x:0,width:edge},{arm:1,x:edge,width:width-edge}];
}
