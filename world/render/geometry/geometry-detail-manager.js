import {toBufferGeometry} from './geometry-cache.js';
import {projectedPixels} from './lod/geometry-lod.js';
// High-detail requests are queued in the worker; coarse shells remain visible
// until complete. Selection never waits for the whole district to regenerate.
export class GeometryDetailManager {
 constructor(buildings,cache){this.buildings=buildings;this.cache=cache;this.pending=new Set();this.geometries=new Map();this.destroyed=false;this.last=0;this.quality='MEDIUM';this.error=null;}
 update(now,camera,selected,viewportHeight=900) {
  if(now-this.last<250)return;this.last=now;let scheduled=0;
  for(const b of [...this.buildings].sort((a,b)=>Number(b.index===selected||String(b.id)===String(selected))-Number(a.index===selected||String(a.id)===String(selected)))) {
   if(b.kind==='park'||b.mesh?.userData?.loadingGeometry)continue;
   const focus=b.index===selected||String(b.id)===String(selected),distance=Math.hypot(b.center[0]-camera.position.x,camera.position.y,b.center[1]-camera.position.z),pixels=projectedPixels(b.height,distance,camera.fov,viewportHeight);
   const current=b.mesh.userData.geometryTier??1,detail=focus?3:this.quality==='LOW'?0:this.quality==='ULTRA'&&pixels>240?3:this.quality==='HIGH'&&pixels>240?2:1;
   if(current===detail||this.pending.has(b.id)||scheduled>=4)continue;
   const key=`${b.id}:${detail}`;
   if(this.geometries.has(key)){b.mesh.geometry=this.geometries.get(key);b.mesh.userData.geometryTier=detail;continue;}
   this.pending.add(b.id);scheduled++;
   const input={id:b.id,poly:b.poly,height:b.height,kind:b.kind,architecture:b.architecture,worldRevision:b.worldRevision};
   this.cache.building(input,detail).then(data=>{if(this.destroyed)return;const geometry=toBufferGeometry(data);this.geometries.set(key,geometry);b.mesh.geometry=geometry;b.mesh.userData.geometryTier=detail;}).catch(error=>{this.error=error.message;}).finally(()=>this.pending.delete(b.id));
  }
 }
 dispose(){this.destroyed=true;for(const geometry of this.geometries.values())geometry.dispose();this.geometries.clear();}
}
