import {MeshBuilder} from './mesh-data.js';
import {sidewalkProfile} from './sidewalk-generator.js';
export function generateRoadGeometry(segment,quality='BALANCED') {
 const points=segment.points||segment.pts;if(!Array.isArray(points)||points.length<2||points.length>4096||points.some(p=>!p||!Number.isFinite(p[0])||!Number.isFinite(p[1])))throw new RangeError('Road requires 2–4096 finite points');
 const builder=new MeshBuilder(),groups=[],profile=sidewalkProfile(segment),height=(segment.curbHeight??.15)+.03,half=(segment.width??9)/2;
 function group(surface,fn){const start=builder.positions.length/3;fn();groups.push({start,count:builder.positions.length/3-start,materialIndex:surface});}
 const normals=points.map((p,i)=>{
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1e-6)throw new RangeError('Duplicate road points');return [-dz/len,dx/len];
 });
 for(let i=1;i<points.length;i++) {
  const a=points[i-1],b=points[i],n=normals[i-1],m=normals[i],vertex=(p,normal,offset,y)=>[p[0]+normal[0]*offset,y,p[1]+normal[1]*offset];
  for(const strip of profile)group(strip.surface,()=>builder.quad(vertex(a,n,strip.from,strip.y),vertex(a,n,strip.to,strip.y),vertex(b,m,strip.to,strip.y),vertex(b,m,strip.from,strip.y)));
  for(const sign of [-1,1])group(1,()=>builder.quad(vertex(a,n,half*sign,.03),vertex(a,n,half*sign,height),vertex(b,m,half*sign,height),vertex(b,m,half*sign,.03)));
 }
 return builder.finish({category:'road',lod:quality==='LOW'?2:1,groups,priority:.7});
}
