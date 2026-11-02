import {test,expect} from 'bun:test';
import {generateBuildingGeometry} from '../world/render/geometry/building-generator.js';
import {ARCHETYPES} from '../world/render/geometry/facade-layout.js';
import {ROOF_TYPES} from '../world/render/geometry/roof-generator.js';
import {generateRoadGeometry} from '../world/render/geometry/road-generator.js';
import {generateRoadNetwork} from '../world/render/geometry/road-network.js';
import {generateIntersectionGeometry} from '../world/render/geometry/intersection-generator.js';
import {generateConstructionGeometry} from '../world/render/geometry/construction-geometry.js';
import {buildChunkHLOD} from '../world/render/geometry/lod/hlod-generator.js';
import {GeometryCache,toBufferGeometry} from '../world/render/geometry/geometry-cache.js';
import {geometryLOD} from '../world/render/geometry/lod/geometry-lod.js';
const footprint=[[0,0],[30,0],[30,25],[0,25]],tower={id:'tower',footprint,floors:24,floorHeight:3.2,setbacks:[{floor:8,inset:2},{floor:18,inset:4}],roofType:'mechanical',archetype:'podium-tower'};
function valid(data){expect(data.positions.length%9).toBe(0);expect(data.normals.length).toBe(data.positions.length);expect(data.uvs.length).toBe(data.positions.length/3*2);expect([...data.positions,...data.normals,...data.uvs].every(Number.isFinite)).toBe(true);expect(data.metadata.triangles).toBe(data.positions.length/9);}
test('setback tower is deterministic, immutable, and silhouette detail fits a small triangle budget',()=>{
 const before=JSON.stringify(tower),a=generateBuildingGeometry(tower,'HIGH'),b=generateBuildingGeometry(tower,'HIGH');valid(a);expect(a.positions).toEqual(b.positions);expect(JSON.stringify(tower)).toBe(before);expect(a.metadata.triangles).toBeLessThan(1000);expect(a.metadata.height).toBeCloseTo(76.8);
 const low=generateBuildingGeometry(tower,'LOW');expect(low.metadata.triangles).toBeLessThan(a.metadata.triangles);expect(Math.max(...a.positions.filter((_,i)=>i%3===1))).toBeGreaterThan(76.8);
});
test('real concave footprint preserves outline and upward roof normals',()=>{
 const poly=[[0,0],[20,0],[20,8],[8,8],[8,20],[0,20]];const data=generateBuildingGeometry({id:'gis',poly,height:10,roofType:'flat',archetype:'shopping'},'LOW');valid(data);
 for(let i=0;i<data.positions.length;i+=3){expect(data.positions[i]).toBeGreaterThanOrEqual(0);expect(data.positions[i]).toBeLessThanOrEqual(20);expect(data.positions[i+2]).toBeGreaterThanOrEqual(0);}
 expect([...data.normals].filter((_,i)=>i%3===1).some(n=>n>.99)).toBe(true);
});
test('architectural and roof kits all produce finite geometries',()=>{
 for(const archetype of Object.keys(ARCHETYPES))valid(generateBuildingGeometry({...tower,archetype},'HIGH'));
 for(const roofType of ROOF_TYPES)valid(generateBuildingGeometry({...tower,roofType},'BALANCED'));
 expect(()=>generateBuildingGeometry({...tower,footprint:[[0,0],[0,0],[0,0]]})).toThrow();
 expect(()=>generateBuildingGeometry({...tower,floors:NaN})).toThrow();
});
test('ribbons have raised sidewalks; junctions replace overlaps and retain two material draws',()=>{
 const ribbon=generateRoadGeometry({pts:[[0,0],[20,0],[30,10]],width:9});valid(ribbon);expect([...ribbon.positions].filter((_,i)=>i%3===1)).toContain(Math.fround(.18));
 const network=generateRoadNetwork([{pts:[[-40,0],[40,0]]},{pts:[[0,-40],[0,40]]}]);valid(network);expect(network.metadata.junctions).toBe(1);expect(network.metadata.groups.length).toBe(2);
 valid(generateIntersectionGeometry({x:0,z:0,width:9}));expect(()=>generateRoadGeometry({pts:[[0,0],[NaN,1]]})).toThrow();
});
test('construction uses reusable instance transforms, rising core and lower facade',()=>{
 const data=generateConstructionGeometry({floors:30,floorsBuilt:15,facadeFloors:8,width:24,depth:20});expect(data.slabs.length).toBe(16);expect(data.columns.length).toBe(4);expect(data.core.scale[1]).toBeGreaterThan(15*3.4);expect(data.facade.scale[1]).toBeCloseTo(8*3.4);expect(data.metadata.triangles).toBeLessThan(300);
});
test('chunk proxy is cheap and geometry cache is bounded',async()=>{
 const data=buildChunkHLOD({buildings:[{poly:footprint,height:80},{poly:footprint,height:20}]});valid(data);expect(data.metadata.triangles).toBe(20);
 const cache=new GeometryCache({worker:false,maxBytes:20000});const a=await cache.building(tower);expect(await cache.building(tower)).toBe(a);expect(cache.bytes).toBeLessThanOrEqual(20000);const geometry=toBufferGeometry(a);expect(geometry.boundingBox.max.y).toBeGreaterThan(76);geometry.dispose();cache.dispose();expect(cache.bytes).toBe(0);
});
test('screen size LOD has hysteresis and selected buildings always receive detail',()=>{expect(geometryLOD(290,1)).toBe(1);expect(geometryLOD(400,1)).toBe(0);expect(geometryLOD(6,1)).toBe(3);expect(geometryLOD(1,3,true)).toBe(0);});
