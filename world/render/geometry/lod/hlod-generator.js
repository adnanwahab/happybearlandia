import {MeshBuilder,bounds,cleanPolygon} from '../mesh-data.js';
export function buildChunkHLOD(chunk) {
 const builder=new MeshBuilder();
 for(const b of chunk.buildings||[]) {
  if(b.kind==='park'){builder.extrude(cleanPolygon(b.footprint||b.poly),0,Math.max(.05,b.height||.1));continue;}
  const box=bounds(b.footprint||b.poly);builder.box((box.minX+box.maxX)/2,(b.height||3)/2,(box.minZ+box.maxZ)/2,box.maxX-box.minX,b.height||3,box.maxZ-box.minZ);}
 return builder.finish({category:'district',lod:3,priority:.2,buildings:chunk.buildings?.length||0});
}
