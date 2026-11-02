// Distribution is independent of rendering and stable across camera/replay paths.
export const GRASS_TILE_SIZE = 4;
export const GRASS_PRESETS = Object.freeze({
  LOW: { radius: 14, maxBlades: 5000 },
  BALANCED: { radius: 22, maxBlades: 16000 },
  HIGH: { radius: 28, maxBlades: 24000 },
  ULTRA: { radius: 34, maxBlades: 40000 },
});
export function hashGrass(x,z,seed=0) {
  let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(seed|0,1442695041);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
export function insidePolygon(x,z,polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function segmentDistance(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/length)):0;
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
export function generateGrassTile(tx,tz,parks,segments=[],samples=512) {
  const blades=[];
  for(let i=0;i<samples;i++){
    const x=(tx+hashGrass(tx,tz,i*3+1))*GRASS_TILE_SIZE,z=(tz+hashGrass(tx,tz,i*3+2))*GRASS_TILE_SIZE;
    const park=parks.find(p=>insidePolygon(x,z,p.poly));
    if(!park||segments.some(s=>segmentDistance(x,z,s.a,s.b)<s.clearance))continue;
    // Keep a soft, deterministic sparse edge instead of a ruler-straight fringe.
    const edge=Math.min(...park.poly.map((a,j)=>segmentDistance(x,z,a,park.poly[(j+1)%park.poly.length])));
    if(hashGrass(tx,tz,i+4000)>Math.min(1,edge*2))continue;
    const seed=hashGrass(tx,tz,i*3+3);
    blades.push({x,z,y:Math.max(.03,park.height||.3)+.008,parkId:park.id,height:.085+seed*.17,width:.65+hashGrass(tx,tz,i+1000)*.7,rotation:seed*Math.PI*2,tint:hashGrass(tx,tz,i+2000)});
  }
  return blades;
}
