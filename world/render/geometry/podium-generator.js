import {insetPolygon,bounds} from './mesh-data.js';
export function podiumSections(footprint,floors,floorHeight,setbacks=[],podium=false) {
 const b=bounds(footprint),maxInset=Math.min(b.maxX-b.minX,b.maxZ-b.minZ)*.22;
 const levels=[{floor:0,inset:0},...setbacks.filter(s=>s.floor>0&&s.floor<floors)];
 if(podium&&floors>5&&!levels.some(s=>s.floor===3))levels.push({floor:3,inset:Math.min(3,maxInset)});
 levels.sort((a,b)=>a.floor-b.floor);
 return levels.map((s,i)=>({polygon:insetPolygon(footprint,Math.min(maxInset,Math.max(0,s.inset||0))),bottom:s.floor*floorHeight,top:(levels[i+1]?.floor??floors)*floorHeight}));
}
