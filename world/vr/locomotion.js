// View-only assumptions: flat road centerlines, 1.65m desktop eye height.
// These are schematic viewpoints, not a surveyed pedestrian navigation mesh.
const finitePoint=p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite);
function inside(point,poly){const [x,z]=point;let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
export function streetStops(town){
 const buildings=(town?.buildings??[]).map(b=>b.poly).filter(p=>Array.isArray(p)&&p.length>=3&&p.every(finitePoint));
 const stops=[],keys=new Set();
 for(const road of town?.roads??[]){const pts=road.pts;if(!Array.isArray(pts))continue;for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i];if(!finitePoint(a)||!finitePoint(b))continue;
  const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<1||distance>5000)continue;
  const n=Math.ceil(distance/8);for(let j=0;j<=n&&stops.length<512;j++){
   const point=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],key=point.map(v=>Math.round(v*10)).join(':');
   if(keys.has(key)||buildings.some(poly=>inside(point,poly)))continue;keys.add(key);stops.push(Object.freeze({id:`street-${stops.length}`,x:point[0],z:point[1]}));
  }
 }}return Object.freeze(stops);
}
export function nearestStop(stops,point,maxDistance=Infinity){let best=null,distance=maxDistance;for(const stop of stops){const d=Math.hypot(stop.x-point.x,stop.z-point.z);if(d<distance){best=stop;distance=d;}}return best;}
export function snapDirection(axis,latched){if(!Number.isFinite(axis))return{direction:0,latched};if(Math.abs(axis)<.25)return{direction:0,latched:false};if(!latched&&Math.abs(axis)>.7)return{direction:Math.sign(axis),latched:true};return{direction:0,latched};}
