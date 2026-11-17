// Same authored sun trajectory as the World directional light; not solar ephemeris.
export function visualSun(angle){return {x:Math.cos(angle)*400,y:Math.sin(angle)*500,z:200};}
export const SHADOW_METHOD='flat-ground-extrusion-v1';
const valid=p=>Array.isArray(p)&&p.length>=3&&p.every(v=>Array.isArray(v)&&Number.isFinite(v[0])&&Number.isFinite(v[1]));
export function atlasGeometry(buildings,sun){
 const daylight=Number.isFinite(sun?.y)&&sun.y>0.001&&Number.isFinite(sun.x)&&Number.isFinite(sun.z);
 return (buildings??[]).filter(b=>valid(b.poly)).slice(0,500).map(b=>{
  const poly=b.poly.map(p=>p.slice(0,2)),height=b.height;
  const supported=b.kind!=='park'&&Number.isFinite(height)&&height>0;
  const offset=daylight&&supported?[-sun.x*height/sun.y,-sun.z*height/sun.y]:null;
  // Each vertical wall projects to a ground quad. Roof projection closes the extrusion.
  const roof=offset?poly.map(([x,z])=>[x+offset[0],z+offset[1]]):[];
  const shadows=offset?[roof,...poly.map((p,i)=>[p,poly[(i+1)%poly.length],roof[(i+1)%poly.length],roof[i]])]:[];
  return {id:b.id,kind:b.kind,poly,height:supported?height:null,shadows};
 });
}
