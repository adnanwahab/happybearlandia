import {test,expect} from 'bun:test';
import {stableRealityChanges,populationRealityDiff,recordedProjectRows,populationWorldGeometry,realityComparable} from '../world/reality/world-views.js';
test('geographic changes join stable IDs rather than array order or field order',()=>{
 const a={buildings:[{id:'a',floors:2},{id:'b',floors:3}]},b={buildings:[{floors:3,id:'b'},{floors:4,id:'a'},{id:'c',floors:1}]};
 expect(stableRealityChanges(a,b,['buildings']).buildings).toEqual([{id:'a',status:'changed'},{id:'c',status:'added'}]);
 expect(realityComparable({seed:42,month:6,version:'v'},{seed:42,month:6,version:'v'})).toBe(true);
 expect(realityComparable({seed:42,month:6},{seed:43,month:6})).toBe(false);
 expect(realityComparable({seed:42,month:6},{seed:42,month:7})).toBe(false);
});
test('population sample churn never fabricates births, deaths or new physical buildings',()=>{
 const baseline={visibleAgents:[{id:'a',x:0,z:0},{id:'old',x:10,z:0}],buildingOccupancy:[{buildingId:'h',count:2}]};
 const current={visibleAgents:[{id:'a',x:1,z:0},{id:'new',x:20,z:0}],buildingOccupancy:[{buildingId:'h',count:3}]};
 const result=populationRealityDiff(baseline,current);
 expect(result.people).toEqual([{id:'a',status:'changed'}]);expect(result.unpairedSampleIds).toEqual(['old','new']);expect(result.occupancy).toEqual([{id:'h',status:'changed'}]);
});
test('construction reasons come from supplied project records; headcounts remain unavailable without assignments',()=>{
 const state={projects:[{id:'p',stage:'construction',progress:2,duration:6},{id:'q',stage:'permits',assignedWorkerIds:['w1','w2']}]};
 const result=recordedProjectRows(state,[{eventType:'MATERIAL_DELAY',payload:{projectId:'p',reason:'materials'}}]);
 expect(result[0]).toMatchObject({reason:'materials',reasonType:'MATERIAL_DELAY',assignedWorkers:null,progress:2,duration:6});
 expect(result[1]).toMatchObject({reason:null,assignedWorkers:2});expect(state.projects[0].workerCount).toBeUndefined();
});
test('population geometry preserves exact supplied park outlines and uses points for missing footprints',()=>{
 const context={buildings:[{id:'park',poly:[[0,0],[10,0],[3,7]]},{id:'h',center:[20,30]}]},before=structuredClone(context);
 const result=populationWorldGeometry(context);
 expect(result[0].poly).toEqual([[0,0],[10,0],[3,7]]);expect(result[1]).toMatchObject({center:[20,30],poly:null});expect(context).toEqual(before);
});

test('replay branch wrappers prefer actual population snapshots and unwrap city state explicitly',async()=>{
 const {unwrapRealityState}=await import('../world/reality/world-views.js');
 const city={seed:42,month:6,buildings:[]},snapshot={config:{seed:42},minute:60,visibleAgents:[]};
 expect(unwrapRealityState({state:city})).toBe(city);
 expect(unwrapRealityState({state:{people:{age:new Uint8Array(100)}},snapshot})).toBe(snapshot);
 expect(realityComparable({snapshot},{snapshot})).toBe(true);
});
