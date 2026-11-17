import {test,expect} from 'bun:test';
import {curtainCompatibility,curtainSlices} from '../world/future-machine/scene/curtain.js';
import {createSpatialMapping} from '../world/future-machine/scene/mapping.js';
const state=(buildings=[{id:'same',floors:2}])=>({month:0,buildings,projects:[]});
test('curtain shares schematic positions and permits recorded additions and heights without mutating states',()=>{
 const a=state(),b=state([{id:'same',floors:4},{id:'new',floors:2}]),before=JSON.stringify([a,b]);
 expect(curtainCompatibility(createSpatialMapping().frame(a,b))).toBeNull();expect(JSON.stringify([a,b])).toBe(before);
 expect(curtainSlices(801,.25)).toEqual([{arm:0,x:0,width:200},{arm:1,x:200,width:601}]);
 for(const fraction of [0,.1,.5,.9,1]){const [a,b]=curtainSlices(801,fraction);expect(a.width+b.width).toBe(801);expect(b.x).toBe(a.width);}
});
test('missing inventory, unrelated entities, unsupported and shifted geographic footprints fail closed',()=>{
 expect(curtainCompatibility(null)).toContain('required');
 expect(curtainCompatibility(createSpatialMapping().frame(state(),state([{id:'other'}])))).toContain('common');
 const building={id:'same',source:'osm',sourceId:'way/1',geometry:{type:'Polygon',coordinates:[[[0,0],[.01,0],[.01,.01],[0,0]]]},floors:2};
 const mapping=createSpatialMapping();expect(curtainCompatibility(mapping.frame(state([building]),state([building])))).toBeNull();
 const shifted=structuredClone(building);shifted.geometry.coordinates[0][1][0]=.02;
 expect(curtainCompatibility(mapping.frame(state([building]),state([shifted])))).toContain('alignment');
 shifted.geometry.type='MultiPolygon';expect(curtainCompatibility(mapping.frame(state([building]),state([shifted])))).toContain('Unsupported');
});
