import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {HOUSE_FLOORING,validateFlooring} from '../world/house/flooring.js';
import {createInterior} from '../world/house/scene/interior.js';
import {createPopulationRuntime} from '../world/population/runtime.js';
test('floor styles render per room with world-space tile UVs without changing wall geometry',()=>{
 const interior=createInterior(THREE,new THREE.Scene()),rooms=['bedroom','kitchen','living','study'].map(id=>({id}));
 interior.build({home:{},rooms,objects:[]});const walls=interior.editableWalls();
 for(const style of Object.keys(HOUSE_FLOORING)){
  interior.build({home:{flooring:{kitchen:style}},rooms,objects:[]});const floors=[];interior.root.traverse(mesh=>{if(mesh.userData.flooringStyle)floors.push(mesh);});
  expect(floors).toHaveLength(1);expect(floors[0].userData.pick.record.id).toBe('kitchen');expect(floors[0].geometry.getAttribute('uv').count).toBe(floors[0].geometry.getAttribute('position').count);expect(interior.editableWalls()).toEqual(walls);
 }
 interior.build({home:{flooring:{}},rooms,objects:[]});let count=0;interior.root.traverse(mesh=>{if(mesh.userData.flooringStyle)count++;});expect(count).toBe(0);interior.destroy();
 expect(()=>validateFlooring('garden','oak')).toThrow();expect(()=>validateFlooring('kitchen','unknown')).toThrow();
});
test('floor edits preserve room finishes through worker checkpoints and can reset only one room',async()=>{
 const runtime=createPopulationRuntime({config:{population:8,householdSize:4},initialMinute:360,stepMinutes:1});try{await runtime.ready;const householdId=runtime.getSnapshot().households[0].id,before=await runtime.inspectHousehold(householdId);
 const result=await runtime.householdAction({householdId,type:'editFlooring',roomId:'kitchen',flooring:'checkerTile'});expect(result.accepted).toBe(true);expect(result.cost).toBe(0);
 await runtime.householdAction({householdId,type:'editFlooring',roomId:'bedroom',flooring:'walnut'});await runtime.restoreCheckpoint(await runtime.exportCheckpoint());
 let after=await runtime.inspectHousehold(householdId);expect(after.house.flooring).toEqual({kitchen:'checkerTile',bedroom:'walnut'});expect(after.house.objects).toEqual(before.house.objects);expect(after.savings).toBe(before.savings);expect(runtime.getSnapshot().minute).toBe(360);
 await runtime.householdAction({householdId,type:'editFlooring',roomId:'kitchen',flooring:'default'});expect((await runtime.inspectHousehold(householdId)).house.flooring).toEqual({bedroom:'walnut'});
 await expect(runtime.householdAction({householdId,type:'editFlooring',roomId:'garden',flooring:'oak'})).rejects.toThrow();
 }finally{runtime.destroy();}
});

test('a painted square is clipped to the room and does not cover neighboring squares',()=>{
 const interior=createInterior(THREE,new THREE.Scene()),rooms=['bedroom','kitchen','living','study'].map(id=>({id}));
 interior.build({home:{floorTiles:{'kitchen:1:-3':{roomId:'kitchen',x:1,z:-3,style:'terracotta'}}},rooms,objects:[]});
 const tiles=[];interior.root.traverse(mesh=>{if(mesh.userData.floorTile)tiles.push(mesh);});expect(tiles).toHaveLength(1);const positions=tiles[0].geometry.getAttribute('position');expect(positions.count).toBeGreaterThan(0);for(let i=0;i<positions.count;i++){expect(positions.getX(i)).toBeGreaterThanOrEqual(1);expect(positions.getX(i)).toBeLessThanOrEqual(2);expect(positions.getZ(i)).toBeGreaterThanOrEqual(-3);expect(positions.getZ(i)).toBeLessThanOrEqual(-2);}interior.destroy();
});
test('painting, replacing and erasing a single saved square preserves other cells and room finishes',async()=>{
 const runtime=createPopulationRuntime({config:{population:8,householdSize:4},initialMinute:360,stepMinutes:1});try{await runtime.ready;const householdId=runtime.getSnapshot().households[0].id;
 const paint=(x,z,flooring)=>runtime.householdAction({householdId,type:'editFlooring',roomId:'kitchen',flooring,tile:{x,z}});
 await paint(1,-3,'terracotta');await paint(2,-3,'creamTile');await paint(1,-3,'slateTile');await runtime.restoreCheckpoint(await runtime.exportCheckpoint());let home=(await runtime.inspectHousehold(householdId)).house;
 expect(home.floorTiles['kitchen:1:-3'].style).toBe('slateTile');expect(home.floorTiles['kitchen:2:-3'].style).toBe('creamTile');expect(home.flooring).toBeUndefined();
 await paint(1,-3,null);await runtime.restoreCheckpoint(await runtime.exportCheckpoint());home=(await runtime.inspectHousehold(householdId)).house;expect(home.floorTiles['kitchen:1:-3'].style).toBeNull();expect(home.floorTiles['kitchen:2:-3'].style).toBe('creamTile');await paint(1,-3,'default');home=(await runtime.inspectHousehold(householdId)).house;expect(Object.keys(home.floorTiles)).toEqual(['kitchen:2:-3']);expect(runtime.getSnapshot().minute).toBe(360);
 await expect(paint(.5,-3,'oak')).rejects.toThrow();
 }finally{runtime.destroy();}
});
