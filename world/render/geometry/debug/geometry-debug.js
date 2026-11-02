import {projectedPixels} from '../lod/geometry-lod.js';
const COLORS=[0x48c68b,0x74ace5,0xf0c465,0xd88ad7];
export class GeometryDebug {
 constructor(buildings){this.buildings=buildings;this.mode='off';this.wireframe=false;this.stats={};this.saved=new Map();}
 update(camera,selected,viewportHeight=900) {
  const categories={},lodCounts=[0,0,0,0];let triangles=0,bytes=0,visibleObjects=0;const unique=new Set();
  for(const b of this.buildings) {
   const mesh=b.mesh,data=mesh.geometry.userData||{},lod=mesh.visible?Math.max(0,2-(mesh.userData.geometryTier??1)):3,distance=Math.hypot(b.center[0]-camera.position.x,camera.position.y,b.center[1]-camera.position.z),pixels=projectedPixels(b.height,distance,camera.fov,viewportHeight),count=mesh.geometry.index?mesh.geometry.index.count/3:mesh.geometry.attributes.position.count/3;
   lodCounts[lod]++;mesh.userData.geometryStats={category:data.category||'building',lod,triangles:count,priority:data.priority??.6,distance,screenPixels:pixels};
   if(mesh.visible){triangles+=count;visibleObjects++;categories[data.category||'building']=(categories[data.category||'building']||0)+count;}
   if(!unique.has(mesh.geometry)){unique.add(mesh.geometry);for(const attribute of Object.values(mesh.geometry.attributes))bytes+=attribute.array.byteLength;}
   mesh.material.wireframe=this.wireframe&&(selected==null||b.index===selected||String(b.id)===String(selected));
   if(this.mode!=='off') {
    if(!this.saved.has(mesh))this.saved.set(mesh,mesh.material.color.clone());
    if(this.mode==='lod')mesh.material.color.setHex(COLORS[lod]);
    else {const cost=count/Math.max(1,pixels*pixels);mesh.material.color.setHex(cost>.3?0xe35e49:cost>.04?0xe2b945:0x48b77c);}
   }else if(this.saved.has(mesh)){mesh.material.color.copy(this.saved.get(mesh));this.saved.delete(mesh);}
  }
  this.stats={triangles,bytes,visibleObjects,lodCounts,categories};return this.stats;
 }
 getGeometryStats(){return structuredClone(this.stats);}
 dispose(){for(const [mesh,color] of this.saved){mesh.material.color.copy(color);mesh.material.wireframe=false;}this.saved.clear();}
}
