import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
import {stormIntensityAt} from '../world/weather/parcel-storm.js';
import {createStormEffects} from '../world/render/environment/storm-effects.js';
const make=()=>createWorld(buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:45}),{startMinute:420,recordHistory:true});
test('storm uses exact IDs, walks without teleporting, rises, clears and replays checkpoint',()=>{
 const world=make(),home=world.buildings[world.people[0].home],person=world.people[0],before=[person.x,person.z];
 const result=world.startStorm({floodedIds:[home.index],intensity:.7});
 expect(result.floodedNow).toBe(1);expect(result.displaced).toBeGreaterThan(0);
 expect([person.x,person.z]).toEqual(before);expect(person.mode).toBe('moving');expect(person.path.length).toBeGreaterThan(0);
 expect(world.policy.storm.floodedParcelIds).toEqual([String(home.id)]);
 const initial=home.state.floodDepthMeters;world.step(20);expect(home.state.floodDepthMeters).toBeGreaterThan(initial);
 const saved=world.captureCheckpoint();world.step(160);const expected=world.captureCheckpoint();
 expect(home.state.flooded).toBe(false);expect(home.state.floodDepthMeters).toBe(0);expect(world.policy.floodedNow).toBe(0);
 expect(stormIntensityAt(world.policy.storm,world.t)).toBe(0);
 expect(world.policy.storm.evacuations.some(e=>e.status==='arrived')).toBe(true);
 const restored=make();restored.restoreCheckpoint(saved);restored.step(160);expect(restored.captureCheckpoint()).toEqual(expected);
});
test('zero intensity and invalid intensity never invent exposure',()=>{const world=make(),ids=world.buildings.map(b=>b.index);expect(()=>world.startStorm({floodedIds:ids,intensity:NaN})).toThrow();expect(world.policy?.storm).toBeUndefined();expect(world.startStorm({floodedIds:ids,intensity:0})).toEqual({floodedNow:0,displaced:0});});
test('no safe destination is explicit and repeated storms replace exposure',()=>{const world=make();world.startStorm({floodedIds:world.buildings.map(b=>b.index)});expect(world.policy.storm.evacuations.every(e=>e.status==='no-safe-home')).toBe(true);expect(world.policy.displaced).toBe(0);world.startStorm({floodedIds:[]});expect(world.policy.floodedNow).toBe(0);expect(world.buildings.every(b=>!b.state.flooded&&b.state.floodDepthMeters===0)).toBe(true);});
test('renderer maps positive depths only and bounds LOW and reduced motion work',()=>{
 const town={buildings:[{id:'wet',poly:[[0,0],[8,0],[8,8],[0,8]],state:{flooded:true,floodDepthMeters:.7}},{id:'dry',poly:[[10,0],[18,0],[18,8]],state:{flooded:false,floodDepthMeters:3}},{id:'unknown',poly:[[20,0],[28,0],[28,8]],state:{flooded:true}}]};
 const scene=new THREE.Scene(),fx=createStormEffects(scene,town),camera=new THREE.PerspectiveCamera();fx.update({intensity:1,low:true},camera);
 expect(fx.getState()).toMatchObject({floodedParcelIds:['wet'],depths:[{id:'wet',depthMeters:.7}],rainCount:300,waterDrawCalls:1});
 fx.update({intensity:.5},camera);expect(fx.getState().rainCount).toBe(600);
 fx.update({intensity:1,reducedMotion:true},camera);expect(fx.getState().rainCount).toBe(0);expect(fx.getState().floodedParcelIds).toEqual(['wet']);
 town.buildings[0].state.flooded=false;fx.update({},camera);expect(fx.getState().floodedParcelIds).toEqual([]);fx.dispose();expect(scene.children.length).toBe(0);
});

test('water geometry follows recorded lot polygon and unchanged paused state skips uploads',()=>{
 const building={id:'a',poly:[[0,0],[2,0],[2,2],[0,2]],state:{flooded:true,floodDepthMeters:.5,floodSurfacePoly:[[-1,-1],[3,-1],[3,3],[-1,3]]}};
 const scene=new THREE.Scene(),fx=createStormEffects(scene,{buildings:[building]});fx.update({minute:1});
 const water=scene.getObjectByName('flooded-parcel-water'),position=water.geometry.getAttribute('position');
 expect([...position.array].filter((_,i)=>i%3===1).every(y=>y===.5)).toBe(true);
 expect(Math.min(...[...position.array].filter((_,i)=>i%3===0))).toBe(-1);
 const version=position.version;fx.update({minute:1});expect(position.version).toBe(version);
 building.state.floodSurfacePoly=[[5,5],[6,5],[6,6],[5,6]];fx.update({minute:1});
 expect(Math.min(...[...position.array].filter((_,i)=>i%3===0))).toBe(5);fx.dispose();
});

test('a normal user command interrupts evacuation without claiming safe-home arrival',()=>{
 const w=make(),p=w.people[0];w.startStorm({floodedIds:[p.home]});
 const record=w.policy.storm.evacuations.find(e=>e.personId===String(p.id));
 w.commandPerson(p.id,{type:'walk',destination:{x:p.x+40,z:p.z}});
 expect(record.status).toBe('interrupted');expect(p.evacuation).toBeUndefined();w.step(1);expect(record.arrivedMinute).toBeUndefined();
});
