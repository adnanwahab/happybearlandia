/** Presentation-only route planner. Each cubic span stays on its verified line
 * segment (zero tangent at joins), so collision checks cover the entire curve.
 * Bounds are conservative scene envelopes, not surveyed traversable space.
 */
const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
export function clearCameraSegment(a,b,boxes){
 if(!finite(a)||!finite(b))return false;
 return !boxes.some(box=>{
  let lo=0,hi=1;
  for(const [axis,min,max] of [['x',box.minX,box.maxX],['y',-Infinity,box.top],['z',box.minZ,box.maxZ]]){
   const delta=b[axis]-a[axis];
   if(delta===0){if(a[axis]<min||a[axis]>max)return false;}
   else {let s=(min-a[axis])/delta,t=(max-a[axis])/delta;if(s>t)[s,t]=[t,s];lo=Math.max(lo,s);hi=Math.min(hi,t);if(lo>hi)return false;}
  }
  return true;
 });
}
const validBox=b=>b&&['minX','maxX','minZ','maxZ','top'].every(k=>Number.isFinite(b[k]))&&b.minX<=b.maxX&&b.minZ<=b.maxZ;
export function planCameraRoute(start,end,boxes){
 if(!finite(end)||end.y<3||end.y>1200||!Array.isArray(boxes)||!boxes.every(validBox))return {kind:'unavailable',reason:'unsupported-geometry'};
 if(!clearCameraSegment(end,end,boxes))return {kind:'unavailable',reason:'blocked-destination'};
 const cut=reason=>({kind:'cut',position:{...end},reason});
 if(!finite(start)||start.y<3||start.y>1200)return cut('invalid-start');
 // Fixed work ceiling: no graph expansion and at most four segment scans.
 if(boxes.length>2048)return cut('geometry-budget');
 if(!clearCameraSegment(start,start,boxes))return cut('blocked-start');
 let points=[start,end];
 if(!clearCameraSegment(start,end,boxes)){
  const top=Math.max(start.y,end.y, ...boxes.map(b=>b.top+8));
  if(top>1200)return cut('height-budget');
  points=[start,{...start,y:top},{...end,y:top},end];
  if(points.slice(1).some((p,i)=>!clearCameraSegment(points[i],p,boxes)))return cut('no-route');
 }
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y,p.z-points[i].z));
 return {kind:'spline',points:points.map(p=>({...p})),lengths,distance:lengths.reduce((a,b)=>a+b,0)};
}
export function sampleCameraRoute(route,t){
 let distance=Math.max(0,Math.min(1,t))*route.distance,index=0;
 while(index<route.lengths.length-1&&distance>route.lengths[index])distance-=route.lengths[index++];
 const u=route.lengths[index]?distance/route.lengths[index]:1,s=u*u*(3-2*u),a=route.points[index],b=route.points[index+1];
 return Object.fromEntries(['x','y','z'].map(k=>[k,a[k]+(b[k]-a[k])*s]));
}
