// Portable typed-array geometry. No renderer imports: usable in module workers.
export function polygonArea(points) { return points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2; }
export function cleanPolygon(input) {
 if(!Array.isArray(input)||input.length<3||input.length>256)throw new RangeError('Footprint must contain 3–256 vertices');
 const points=input.map(p=>{if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))throw new TypeError('Footprint coordinates must be finite');return [p[0],p[1]];});
 if(points.length>3&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();
 for(let i=points.length-1;i>0;i--)if(Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])<1e-6)points.splice(i,1);
 if(points.length<3||Math.abs(polygonArea(points))<1e-5)throw new RangeError('Degenerate footprint');
 if(polygonArea(points)<0)points.reverse();return points;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function triangulate(points) {
 const remaining=points.map((_,i)=>i),triangles=[];let guard=0;
 while(remaining.length>3) {
  let clipped=false;
  for(let i=0;i<remaining.length;i++) {
   const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
   if(cross(points[a],points[b],points[c])<=1e-8)continue;
   if(remaining.some(j=>j!==a&&j!==b&&j!==c&&cross(points[a],points[b],points[j])>=-1e-8&&cross(points[b],points[c],points[j])>=-1e-8&&cross(points[c],points[a],points[j])>=-1e-8))continue;
   triangles.push([a,b,c]);remaining.splice(i,1);clipped=true;break;
  }
  if(!clipped||guard++>points.length*2)throw new RangeError('Footprint must be a simple polygon without holes');
 }
 triangles.push([...remaining]);return triangles;
}
export class MeshBuilder {
 constructor(){this.positions=[];this.normals=[];this.uvs=[];}
 triangle(a,b,c,uvs=null) {
  const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...n);if(length<1e-9)return;n=n.map(v=>v/length);
  for(const [i,p] of [a,b,c].entries()){this.positions.push(...p);this.normals.push(...n);this.uvs.push(...(uvs?.[i]||[p[0],p[2]]));}
 }
 quad(a,b,c,d,uvs=null){this.triangle(a,b,c,uvs&&[uvs[0],uvs[1],uvs[2]]);this.triangle(a,c,d,uvs&&[uvs[0],uvs[2],uvs[3]]);}
 extrude(points,bottom,top,{cap=true}={}) {
  let offset=0;
  for(let i=0;i<points.length;i++) {const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   this.quad([a[0],bottom,a[1]],[a[0],top,a[1]],[b[0],top,b[1]],[b[0],bottom,b[1]],[[offset,bottom],[offset,top],[offset+length,top],[offset+length,bottom]]);offset+=length;
  }
  if(cap)for(const [a,b,c] of triangulate(points))this.triangle([points[c][0],top,points[c][1]],[points[b][0],top,points[b][1]],[points[a][0],top,points[a][1]]);
 }
 box(x,y,z,w,h,d){this.extrude([[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],y-h/2,y+h/2);}
 finish(metadata={}){return {positions:new Float32Array(this.positions),normals:new Float32Array(this.normals),uvs:new Float32Array(this.uvs),metadata:{...metadata,triangles:this.positions.length/9,bytes:(this.positions.length+this.normals.length+this.uvs.length)*4}};}
}
export function insetPolygon(points,inset) {
 if(inset<=0)return points.map(p=>[...p]);
 const result=[];
 for(let i=0;i<points.length;i++) {
  const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],ul=Math.hypot(...u),vl=Math.hypot(...v);
  const n=[-u[1]/ul-v[1]/vl,u[0]/ul+v[0]/vl],den=n[0]*(-v[1]/vl)+n[1]*(v[0]/vl);
  const f=Math.abs(den)>.1?Math.min(inset/den,inset*4):inset;
  result.push([b[0]+n[0]*f,b[1]+n[1]*f]);
 }
 if(polygonArea(result)<=0||Math.abs(polygonArea(result))>Math.abs(polygonArea(points)))throw new RangeError('Setback collapses footprint');
 return result;
}
export function bounds(points){const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);return {minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};}
export function visualSeed(id,revision=0){let h=2166136261;for(const c of `${id}:${revision}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
