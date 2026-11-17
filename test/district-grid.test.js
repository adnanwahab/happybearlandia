import {test, expect} from 'bun:test';
import {createDistrictGrid} from '../world/city/district-grid.js';
import {VERSION} from '../world/city/contracts.js';
import {createEngine, addIntervention} from '../world/city/engine.js';
import {initialForRecipe} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {districtHeatmap} from '../world/causal/heatmap.js';
const scope = {runId:'experiment/42',initialHash:'fixture-original',modelVersion:VERSION,seed:42};

test('real paired Month 0/16/120 measurements preserve identities through reverse scrub without mutation',()=>{
 const initial=initialForRecipe(), engine=createEngine();
 const histories=[initial,addIntervention(initial,DEFAULT_RECIPE.intervention)].map(start=>{const states=[initial];let state=start;for(let i=0;i<120;i++){state=engine.step(state).state;states.push(state);}return states;});
 const grid=createDistrictGrid({scope,districts:initial.districts});
 const reordered=createDistrictGrid({scope,districts:[...initial.districts].reverse()});
 expect(reordered.cells).toEqual(grid.cells);
 for(const month of [0,16,120,16,0])for(const states of histories){
  const state=states[month], before=JSON.stringify(state), measurements=districtHeatmap(state,'rent');
  const projected=grid.project(state,{scope,measurements});
  expect(projected.rows.map(r=>r.cellId)).toEqual(grid.cells.map(c=>c.cellId));
  for(const row of projected.rows){expect(row.measurement).toEqual(measurements.find(m=>m.id===row.districtId));expect(row.geographicCoverage).toBe('unsupported');expect(row.month).toBe(month);}
  expect(projected.unlocated).toEqual([]);expect(JSON.stringify(state)).toBe(before);
 }
});

test('zero, null, missing, absent and unknown districts remain distinct',()=>{
 const districts=['a','b','c','d'].map(id=>({id})), grid=createDistrictGrid({scope,districts});
 const state={version:VERSION,seed:42,month:16,districts:[...districts.slice(0,3),{id:'new'}]};
 const result=grid.project(state,{scope,measurements:[{id:'a',value:0,count:1},{id:'b',value:null,count:0},{id:'d',value:9},{id:'new',value:7},{id:'unknown',value:3}]});
 expect(result.rows.map(r=>[r.status,r.value])).toEqual([['available',0],['measurement_unavailable',null],['measurement_missing',null],['district_absent',null]]);
 expect(result.unlocated.map(r=>r.districtId)).toEqual(['d','new','unknown']);
 expect(result.unlocated.find(r=>r.districtId==='new').measurement.value).toBe(7);
 expect(grid.cells).toHaveLength(4);
});

test('ambiguous and incompatible identities fail closed; scope and delimiter changes cannot collide',()=>{
 const districts=[{id:'a:b'},{id:'a/b'}],grid=createDistrictGrid({scope,districts});
 const state={version:VERSION,seed:42,month:0,districts};
 for(const patch of [{seed:43},{runId:'other'},{initialHash:'other'},{modelVersion:'population-v2'}])expect(()=>grid.project(state,{scope:{...scope,...patch},measurements:[]})).toThrow();
 expect(()=>createDistrictGrid({scope,districts:[{id:'a'},{id:'a'}]})).toThrow();
 for(const measurements of [[{id:'a',value:1},{id:'a',value:2}],[{id:'a',value:Infinity}],[{id:'a',value:undefined}]])expect(()=>grid.project(state,{scope,measurements})).toThrow();
 expect(new Set(grid.cells.map(c=>c.cellId)).size).toBe(2);
 expect(createDistrictGrid({scope:{...scope,runId:'other'},districts}).cells[0].cellId).not.toBe(grid.cells[0].cellId);
 expect(()=>grid.project({...state,seed:0},{scope,measurements:[]})).toThrow();
 expect(()=>grid.project({...state,districts:[...districts,districts[0]]},{scope,measurements:[]})).toThrow();
});

test('empty/bounded inventories and returned records cannot mutate mapping or source',()=>{
 const empty=createDistrictGrid({scope,districts:[]});
 expect(empty.project({version:VERSION,seed:42,month:0,districts:[]},{scope,measurements:[]}).rows).toEqual([]);
 expect(()=>createDistrictGrid({scope,districts:Array.from({length:1025},(_,i)=>({id:String(i)}))})).toThrow();
 const districts=[{id:'a'}],grid=createDistrictGrid({scope,districts});
 const state={version:VERSION,seed:42,month:0,districts},measurements=[{id:'a',value:0,source:{kind:'synthetic'}}];
 const result=grid.project(state,{scope,measurements});
 result.rows[0].measurement.source.kind='changed';result.rows[0].cellId='changed';result.scope.runId='changed';
 const again=grid.project(state,{scope,measurements});
 expect(again.rows[0].measurement.source.kind).toBe('synthetic');
 expect(again.rows[0].cellId).toBe(grid.cells[0].cellId);
 expect(again.scope).toEqual(scope);
 expect(Object.isFrozen(grid.cells[0])).toBe(true);
});
