import {test,expect} from 'bun:test';
import {computeRealityHotspots} from '../world/reality/hotspots.js';
import {childInspectorRows} from '../world/population/child-inspector.js';
test('hotspots use matched field deltas, declared scales and actual anchors without mutating states',()=>{
 const baseline={units:[{id:'u',buildingId:'b',rent:500}],households:[{id:'h',unitId:'u',income:1000}]},current={units:[{id:'u',buildingId:'b',rent:550}],households:[{id:'h',unitId:'u',income:1500}]},before=structuredClone({baseline,current});
 const report=computeRealityHotspots({baseline,current,worldContext:{buildings:[{id:'b',center:[4,9]}]}});
 expect(report.hotspots).toHaveLength(1);expect(report.hotspots[0]).toMatchObject({strength:.5,direction:'mixed',anchor:{x:4,z:9}});expect(report.changedFields).toBe(2);expect({baseline,current}).toEqual(before);
});
test('unlocated changes and unmatched samples never become invented geographic impacts',()=>{
 const report=computeRealityHotspots({engine:'population',baseline:{visibleAgents:[{id:'a',income:1000}]},current:{visibleAgents:[{id:'a',income:2000},{id:'new',income:5000}]}});
 expect(report.hotspots).toHaveLength(0);expect(report.unmappedFields).toBe(1);expect(report.changedFields).toBe(1);
});
test('child inspector retains recorded false, zero and parent constraints without creating missing facts',()=>{
 const person={ageYears:7,child:{parentIds:['p1'],careEnrolled:false,academicExposureProxy:0},parentCare:null},original=structuredClone(person),rows=childInspectorRows(person);
 expect(rows).toContainEqual(['Care enrolled',false]);expect(rows).toContainEqual(['Academic exposure proxy (not grades)',0]);expect(rows.some(([label])=>label==='School location')).toBe(false);expect(person).toEqual(original);
});
