/** Presentation validation only. Mapped sidewalks include synthetic access legs;
 * reject the entire preview when any leg intersects a supplied building polygon.
 * Missing terrain geometry is not evidence of universal walkability. */
export function validateGhostRoute(trip,from,buildings=[]){
 if(trip.routeKind!=='mapped-sidewalk')throw Error('Footstep preview unavailable: no mapped sidewalk route');
 const points=[from,...(trip.path??[])];
 if(points.length<2||points.length>10000||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('Invalid walking waypoints');
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const within=(a,b,p)=>Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
 const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||within(a,b,c)||within(a,b,d)||within(c,d,a)||within(c,d,b);
 const inside=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 for(const building of buildings){const poly=building.poly;if(!poly?.length||building.kind==='park')continue;
  for(let i=1;i<points.length;i++)if(inside(points[i-1],poly)||inside(points[i],poly)||poly.some((a,j)=>intersects(points[i-1],points[i],a,poly[(j+1)%poly.length])))throw Error('Footstep preview unavailable: route intersects blocked building terrain');
 }
 return points.map(p=>[...p]);
}
