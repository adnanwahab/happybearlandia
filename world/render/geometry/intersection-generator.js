import {MeshBuilder,cleanPolygon} from './mesh-data.js';
export function generateIntersectionGeometry(intersection,quality='BALANCED') {
 const x=intersection.x??0,z=intersection.z??0,r=intersection.radius??(intersection.width??9)/2;
 if(![x,z,r].every(Number.isFinite)||r<=0)throw new RangeError('Intersection coordinates and radius must be finite');
 const polygon=cleanPolygon(intersection.footprint||[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]]),builder=new MeshBuilder();builder.extrude(polygon,0,.03);
 return builder.finish({category:'intersection',lod:quality==='LOW'?2:1,priority:.8});
}
