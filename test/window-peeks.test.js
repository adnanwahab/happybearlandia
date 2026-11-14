import {test,expect} from 'bun:test';
import {windowPeeks} from '../world/population/window-peeks.js';
const person={id:'p1',synthetic:true,householdId:'h1',homeId:'b1',locationId:'b1',currentActivity:'HOME',x:0,z:0,name:'PRIVATE',journal:'PRIVATE'};
const frame=()=>({schemaVersion:'population-snapshot.v1',tick:4,minute:30,households:[{id:'h1'}],visibleAgents:[{...person}]});
test('exact household and tick, whitelisted facts, observational projection',()=>{
 const f=frame(),before=JSON.stringify(f),rows=windowPeeks(f,{x:0,z:0});
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({householdId:'h1',tick:4,minute:30,activity:'HOME'});
 expect(JSON.stringify(rows)).not.toContain('PRIVATE');expect(JSON.stringify(f)).toBe(before);
});
test('empty, unmatched, non-synthetic, traveling and unsupported activity stay opaque',()=>{
 expect(windowPeeks(null,{x:0,z:0})).toEqual([]);
 for(const patch of [{synthetic:false},{householdId:'other'},{homeId:null},{locationId:'elsewhere'},{currentActivity:'WORK'},{x:NaN}]){
  const f=frame();Object.assign(f.visibleAgents[0],patch);expect(windowPeeks(f,{x:0,z:0})).toEqual([]);
 }
 for(const patch of [{tick:undefined},{minute:NaN},{schemaVersion:'other'}])expect(windowPeeks({...frame(),...patch},{x:0,z:0})).toEqual([]);
});
test('rapid tick/camera changes use only the current frame and bound card budget',()=>{
 for(let tick=0;tick<100;tick++){
  const f=frame();f.tick=tick;expect(windowPeeks(f,{x:0,z:0})[0].tick).toBe(tick);
  expect(windowPeeks(f,{x:1000,z:0})).toEqual([]);
 }
 const f=frame();f.households=Array.from({length:10},(_,i)=>({id:`h${i}`}));
 f.visibleAgents=f.households.flatMap(h=>[{...person,householdId:h.id},{...person,householdId:h.id}]);
 expect(windowPeeks(f,{x:0,z:0})).toHaveLength(3);
});
