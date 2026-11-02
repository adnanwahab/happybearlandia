export {generateBuildingGeometry} from './building-generator.js';
export {generateRoadGeometry} from './road-generator.js';
export {generateIntersectionGeometry} from './intersection-generator.js';
export {generateConstructionGeometry} from './construction-geometry.js';
export {updateGeometryLOD} from './lod/geometry-lod.js';
export {buildChunkHLOD} from './lod/hlod-generator.js';
export function getGeometryStats(objects=[]) {
 const unique=new Set(),categories={};let triangles=0,bytes=0;
 for(const object of objects){const geometry=object.geometry||object,data=geometry.metadata||geometry.userData||{};const count=(data.triangles??(geometry.index?geometry.index.count/3:geometry.attributes?.position?.count/3))||0;triangles+=count*(object.count??1);categories[data.category||'unknown']=(categories[data.category||'unknown']||0)+count;
  if(!unique.has(geometry)){unique.add(geometry);bytes+=data.bytes??Object.values(geometry.attributes||{}).reduce((sum,a)=>sum+a.array.byteLength,0);}}
 return {triangles,bytes,categories,uniqueGeometries:unique.size};
}
