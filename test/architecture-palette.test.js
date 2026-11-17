import {test,expect} from 'bun:test';
import {architecturePalette} from '../world/render/geometry/architecture-palette.js';
import {generateBuildingGeometry} from '../world/render/geometry/building-generator.js';
const poly=[[0,0],[20,0],[20,20],[0,20]];
test('supported categories are repeatable, immutable and diverse without model randomness',()=>{
 for(const kind of ['home','work','shop','food','school']){
  const building={id:'one',kind,worldRevision:4,poly,height:12};const before=JSON.stringify(building);
  const a=architecturePalette(building);expect(a).toEqual(architecturePalette(structuredClone(building)));
  expect(a.storefront).toBe(['shop','food'].includes(kind));expect(JSON.stringify(building)).toBe(before);
  expect(new Set(Array.from({length:30},(_,i)=>architecturePalette({...building,id:String(i)}).variant)).size).toBe(3);
 }
});
test('missing and unsupported categories retain fallback without commercial claims',()=>{
 for(const value of [{},{kind:'unknown'},{kind:'park'}])expect(architecturePalette(value)).toBeNull();
 const data=generateBuildingGeometry({id:'unknown',kind:'unknown',poly,height:10});expect(data.metadata.facade.storefront).toBeUndefined();
});
test('rapid detail changes retain the palette and low geometry sheds attachments',()=>{
 const building={id:'shop',kind:'shop',poly,height:12};const low=generateBuildingGeometry(building,'LOW');
 for(let i=0;i<20;i++){
  const high=generateBuildingGeometry(building,i%2?'HIGH':'BALANCED');
  expect(high.metadata.facade).toEqual(low.metadata.facade);expect(high.metadata.triangles).toBeGreaterThan(low.metadata.triangles);
 }
 expect(generateBuildingGeometry({...building,roofType:'hip'}).metadata.roofType).toBe('hip');
 expect(generateBuildingGeometry({...building,architecture:{archetype:'warehouse'}}).metadata.roofType).toBe('sawtooth');
});
