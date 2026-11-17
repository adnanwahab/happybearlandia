// Scene coordinates are metres. These calculations do not establish surveyed dimensions.
export function measurement(a,b){
 if(![a,b].every(p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]))))throw Error('Surface coordinates unavailable');
 return {distance:Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),height:Math.abs(b.y-a.y),horizontal:Math.hypot(b.x-a.x,b.z-a.z)};
}
export function footprintArea(poly){
 if(!Array.isArray(poly)||poly.length<3||!poly.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)))return null;
 return Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
}
export function snapPoint(point,vertices,radius=2){
 const candidates=vertices.filter(p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])));
 const nearest=candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y,a.z-point.z)-Math.hypot(b.x-point.x,b.y-point.y,b.z-point.z))[0];
 return nearest&&Math.hypot(nearest.x-point.x,nearest.y-point.y,nearest.z-point.z)<=radius?{...nearest}:{...point};
}
