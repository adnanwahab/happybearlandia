import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createInterior} from '../world/house/scene/interior.js';
import {normalizeHouseWalls} from '../world/house/walls.js';
import {createPopulationRuntime} from '../world/population/runtime.js';
const wall=(id,length=2)=>({id,x:0,z:0,length,thickness:.14,height:2.4,rotation:0});
test('deleting a wall retains valid short generated segments and exact remaining selection IDs',()=>{
 const scene=new THREE.Scene(),interior=createInterior(THREE,scene),records=[{...wall('wall-1',.16),thickness:.05},wall('wall-2'),wall('wall-3')];
 const remaining=normalizeHouseWalls(records.filter(w=>w.id!=='wall-2'));
 interior.build({home:{wallLayout:{walls:remaining}},rooms:[],objects:[]});
 expect([...interior.wallMeshes.keys()]).toEqual(['wall-1','wall-3']);
 expect(interior.placementWalls.map(w=>w.id)).toEqual(['wall-1','wall-3']);
 expect(interior.wallMeshes.has('wall-2')).toBe(false);expect(interior.editableWalls()).toEqual(remaining);
 expect(()=>normalizeHouseWalls([wall('bad',0)])).toThrow();
 interior.destroy();
});
test('worker wall deletion retains short segments, empty layouts and checkpoint state without time or cost',async()=>{
 const runtime=createPopulationRuntime({config:{population:8,householdSize:4},initialMinute:360,stepMinutes:1});
 try{await runtime.ready;const householdId=runtime.getSnapshot().households[0].id;
 await runtime.householdAction({householdId,type:'editWalls',walls:[{...wall('tiny',.16),thickness:.05},wall('selected')]});
 const result=await runtime.householdAction({householdId,type:'editWalls',walls:[{...wall('tiny',.16),thickness:.05}]});
 expect(result.accepted).toBe(true);expect(result.cost).toBe(0);
 let home=(await runtime.inspectHousehold(householdId)).house;expect(home.wallLayout.walls.map(w=>w.id)).toEqual(['tiny']);
 await runtime.restoreCheckpoint(await runtime.exportCheckpoint());
 home=(await runtime.inspectHousehold(householdId)).house;expect(home.wallLayout.walls.map(w=>w.id)).toEqual(['tiny']);
 await runtime.householdAction({householdId,type:'editWalls',walls:[]});expect((await runtime.inspectHousehold(householdId)).house.wallLayout.walls).toEqual([]);
 expect(runtime.getSnapshot().minute).toBe(360);
 }finally{runtime.destroy();}
});
