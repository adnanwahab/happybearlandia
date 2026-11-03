/** Exact coordinate adapter; never substitutes a hull for an OSM footprint. */
export function sceneBuildGeometry(site,walls=[]){
 const point=p=>Array.isArray(p)?{x:p[0],z:p[1]}:{x:p.x,z:p.z};
 const outer=site?.status==='mapped'?site.footprint.outer.map(point):[{x:-6.7,z:-5.7},{x:6.7,z:-5.7},{x:6.7,z:5.7},{x:-6.7,z:5.7}];
 const holes=(site?.footprint?.holes??[]).map(r=>r.map(point)),sourceWalls=site?.status==='mapped'?[outer,...holes].flatMap((ring,k)=>ring.map((a,i)=>({id:`site-${k}-wall-${i}`,a,b:ring[(i+1)%ring.length]}))):[];
 return{bounds:{outer,holes},walls:[...sourceWalls,...walls.map(w=>{const dx=Math.cos(w.rotation)*w.length/2,dz=-Math.sin(w.rotation)*w.length/2;return{id:w.id,a:{x:w.x-dx,z:w.z-dz},b:{x:w.x+dx,z:w.z+dz}};})]};
}
export function wallOffset(wall,point){const dx=wall.b.x-wall.a.x,dz=wall.b.z-wall.a.z,length2=dx*dx+dz*dz;return length2?Math.max(0,Math.min(1,((point.x-wall.a.x)*dx+(point.z-wall.a.z)*dz)/length2)):0;}
/** Pure transform of canonical room placement into the renderer's inferred
 * fitted room. Caller supplies {x,z,scale} from that exact layout, never a new fit. */
export function roomLocalToSite(placement,room){if(!placement||!room||![placement.x,placement.z,room.x,room.z,room.scale??1].every(Number.isFinite))return null;return{x:room.x+placement.x*(room.scale??1),z:room.z+placement.z*(room.scale??1)};}
