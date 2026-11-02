import {MeshBuilder,cleanPolygon,bounds,visualSeed} from './mesh-data.js';
import {ARCHETYPES,facadeLayout} from './facade-layout.js';
import {podiumSections} from './podium-generator.js';
import {appendRoof} from './roof-generator.js';
export const GEOMETRY_QUALITY=Object.freeze({LOW:0,MEDIUM:1,BALANCED:1,HIGH:2,ULTRA:3,CINEMATIC:3});
export function generateBuildingGeometry(building,quality='BALANCED') {
 const detail=typeof quality==='number'?quality:GEOMETRY_QUALITY[quality];if(!Number.isInteger(detail)||detail<0||detail>3)throw new RangeError('Unknown geometry quality');
 let footprint=cleanPolygon(building.footprint||building.poly),seed=visualSeed(building.id??'building',building.worldRevision??0),parameters=building.architecture||building;
 const archetype=parameters.archetype||(building.kind==='home'?(building.height>35?'podium-tower':building.height>12?'mid-rise':'single-family'):building.kind==='school'?'school':building.kind==='work'?'office':'shopping');
 const template=ARCHETYPES[archetype];if(!template)throw new RangeError(`Unknown architectural archetype: ${archetype}`);
 const explicitHeight=Number(building.height),rawFloors=parameters.floors??Math.max(1,Math.round((explicitHeight||10)/template.floorHeight));
 const floors=Math.max(1,Math.min(200,Math.round(rawFloors)));if(!Number.isFinite(floors))throw new TypeError('Floors must be finite');
 let floorHeight=parameters.floorHeight??(explicitHeight>0?explicitHeight/floors:template.floorHeight);if(!Number.isFinite(floorHeight)||floorHeight<=0||floorHeight>50)throw new RangeError('Floor height must be between 0 and 50m');
 if(detail>=2&&['flat','parapet','mechanical','green'].includes(parameters.roofType||template.roofType)&&(parameters.cornerStyle==='chamfer'||detail===3))footprint=footprint.flatMap((p,i)=>{const a=footprint[(i+footprint.length-1)%footprint.length],b=footprint[(i+1)%footprint.length],cut=Math.min(.12,Math.hypot(p[0]-a[0],p[1]-a[1])*.1,Math.hypot(p[0]-b[0],p[1]-b[1])*.1),la=Math.hypot(a[0]-p[0],a[1]-p[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]);return [[p[0]+(a[0]-p[0])*cut/la,p[1]+(a[1]-p[1])*cut/la],[p[0]+(b[0]-p[0])*cut/lb,p[1]+(b[1]-p[1])*cut/lb]];});
 const height=floors*floorHeight,b=bounds(footprint),builder=new MeshBuilder();
 if(building.kind==='park'){builder.extrude(footprint,0,Math.max(.05,explicitHeight||.1));return builder.finish({category:'park',lod:detail,seed,priority:.2});}
 const setbacks=parameters.setbacks||(detail>0&&floors>10?[{floor:Math.round(floors*.65),inset:Math.min(2,(b.maxX-b.minX)*.08)}]:[]);
 if(setbacks.length>12||setbacks.some(s=>!Number.isFinite(s.floor)||!Number.isFinite(s.inset)))throw new RangeError('Setbacks must contain at most 12 finite floor/inset pairs');
 const sections=podiumSections(footprint,floors,floorHeight,detail>0?setbacks:[],detail>0&&(parameters.podium??template.podium));
 for(const section of sections)builder.extrude(section.polygon,section.bottom,section.top);
 const roofType=parameters.roofType||template.roofType;appendRoof(builder,sections.at(-1).polygon,height,roofType,detail);
 if(detail>=1){ // Large entrance/awning: actual profile; windows remain procedural.
  const frontage=Math.min(6,(b.maxX-b.minX)*.55);builder.box((b.minX+b.maxX)/2,2.7,b.maxZ+.5,frontage,.22,1.2);
 }
 if(detail>=2&&floors>3){
  const balconyCount=Math.min(12,floors-1);for(let i=0;i<balconyCount;i++)builder.box(b.minX+(b.maxX-b.minX)*.25,(i+1)*floorHeight,b.maxZ+.6,Math.min(3,(b.maxX-b.minX)*.25),.18,1.3);
 }
 return builder.finish({category:'building',lod:Math.max(0,2-detail),priority:building.selected?1:.6,seed,archetype,floors,floorHeight,height,roofType,facade:facadeLayout(parameters.facadeStyle||template.facadeStyle),bounds:b});
}
