import {test, expect} from 'bun:test';
import {buildingMaterialTags, inspectBuildingMaterial} from '../world/material-microscope.js';
const area={source:'osm',buildings:[{id:'w653',materialTags:{'building:material':'brick','roof:material':'slate'},kind:'home',color:'red'}]};
test('explicit tags retain exact identity and separate reports from renderer appearance',()=>{
 const before=structuredClone(area),wall=inspectBuildingMaterial(area,'w653');
 expect(wall.status).toBe('tagged');expect(wall.message).toContain('Contributor-reported');expect(wall.renderer).toContain('not evidence');
 expect(wall.sourceRecord.geometry).toEqual(area.buildings[0]);expect(inspectBuildingMaterial(area,'w653','roof').message).toContain('slate');
 wall.sourceRecord.geometry.id='changed';expect(area).toEqual(before);
});
test('synthetic colors, absent evidence and missing identity never imply construction material',()=>{
 expect(inspectBuildingMaterial({...area,source:'synthetic'},'w653').status).toBe('unsupported');
 expect(inspectBuildingMaterial({source:'osm',buildings:[{id:'x',kind:'home',material:'brick',color:'red'}]},'x').message).toContain('unknown');
 expect(inspectBuildingMaterial(area,'missing').status).toBe('missing');expect(()=>inspectBuildingMaterial(area,'w653','floor')).toThrow();
});
test('bounded material whitelist preserves raw contributor values only',()=>{
 expect(buildingMaterialTags({'building:material':'brick;stone','roof:material':42,name:'private'})).toEqual({'building:material':'brick;stone'});
 expect(buildingMaterialTags({'building:material':'x'.repeat(301),'roof:material':'  '})).toEqual({});
});
