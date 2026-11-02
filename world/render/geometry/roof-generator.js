import {bounds,insetPolygon} from './mesh-data.js';
export const ROOF_TYPES=Object.freeze(['flat','parapet','mechanical','sloped','gable','hip','sawtooth','green']);
export function appendRoof(builder,polygon,height,type='flat',detail=1) {
 if(!ROOF_TYPES.includes(type))throw new RangeError(`Unsupported roof: ${type}`);
 const b=bounds(polygon),w=b.maxX-b.minX,d=b.maxZ-b.minZ,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,rise=Math.min(4,Math.min(w,d)*.22);
 if(type==='flat')return;
 if(['parapet','mechanical','green'].includes(type)) {
  if(detail>0)for(let i=0;i<polygon.length;i++){const a=polygon[i],c=polygon[(i+1)%polygon.length];builder.quad([a[0],height,a[1]],[a[0],height+.65,a[1]],[c[0],height+.65,c[1]],[c[0],height,c[1]]);}
  if(type==='mechanical')builder.box(cx,height+1.5,cz,Math.max(1,w*.26),3,Math.max(1,d*.28));
  if(type==='green'&&detail>0)builder.extrude(insetPolygon(polygon,Math.min(1,w*.04)),height,height+.25);
  return;
 }
 // Pitched profiles stay inside the actual footprint. Non-rectangular GIS
 // polygons retain their precise flat roof rather than acquiring a bounding box.
 if(polygon.length!==4)return;
 const [x0,x1,z0,z1]=[b.minX,b.maxX,b.minZ,b.maxZ];
 const rectangle=polygon.every(p=>(p[0]===x0||p[0]===x1)&&(p[1]===z0||p[1]===z1));if(!rectangle)return;
 const a=[x0,height,z0],c=[x1,height,z0],e=[x1,height,z1],f=[x0,height,z1];
 if(type==='hip'){const peak=[cx,height+rise,cz];builder.triangle(a,peak,c);builder.triangle(c,peak,e);builder.triangle(e,peak,f);builder.triangle(f,peak,a);}
 else if(type==='sloped'){const up=[x0,height+rise,z1],vp=[x1,height+rise,z1];builder.quad(a,up,vp,c);builder.triangle(a,f,up);builder.triangle(c,vp,e);builder.quad(f,e,vp,up);}
 else {
  const count=type==='sawtooth'?Math.min(8,Math.max(2,Math.floor(w/8))):1;
  for(let i=0;i<count;i++){const left=x0+w*i/count,right=x0+w*(i+1)/count,mid=(left+right)/2,p=[mid,height+rise,z0],q=[mid,height+rise,z1];builder.quad([left,height,z0],[left,height,z1],q,p);builder.quad(p,q,[right,height,z1],[right,height,z0]);builder.triangle([left,height,z0],p,[right,height,z0]);builder.triangle([left,height,z1],[right,height,z1],q);}
 }
}
