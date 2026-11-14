import {test, expect} from 'bun:test';
import * as THREE from 'three';
import {createParkWildlife, wildlifeLayout, WILDLIFE_LIMIT} from '../world/render/environment/park-wildlife.js';
const park = {id:'park',kind:'park',poly:[[-10,-10],[10,-10],[10,10],[-10,10]]};
const town = {seedKey:'fixture',buildings:[park]};
test('layout is seeded, bounded, parks only and leaves source state unchanged', () => {
 const before = JSON.stringify(town);
 expect(wildlifeLayout(town)).toEqual(wildlifeLayout(town));
 expect(wildlifeLayout({...town,seedKey:'other'})).not.toEqual(wildlifeLayout(town));
 expect(wildlifeLayout({buildings:Array(30).fill(park)})).toHaveLength(WILDLIFE_LIMIT);
 expect(wildlifeLayout()).toEqual([]);
 expect(wildlifeLayout({buildings:[{...park,kind:'office'},{...park,poly:[[NaN,0]]}]})).toEqual([]);
 expect(JSON.stringify(town)).toBe(before);
});
test('navigation is stateless; quality, motion and empty fallback hide; disposal releases resources', () => {
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(); camera.position.set(0,5,0);
 const toy=createParkWildlife(scene,town), mesh=scene.children[0].children[0];
 const options={enabled:true,quality:'BALANCED'};
 const before=JSON.stringify(town);
 toy.update(1000,camera,options); expect(toy.getStats().visible).toBe(6);
 const matrices=Array.from(mesh.instanceMatrix.array);
 for(let i=0;i<100;i++){camera.position.set(i*100,70,0);toy.update(i*1e6,camera,options);}
 camera.position.set(0,5,0);toy.update(1000,camera,options);
 expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices);
 for(const override of [{enabled:false},{reducedMotion:true},{quality:'LOW'},{level:2}]){
  toy.update(1000,camera,{...options,...override});expect(toy.getStats().visible).toBe(0);
 }
 expect(JSON.stringify(town)).toBe(before);
 let released=0;
 for(const resource of [mesh,mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>released++);
 toy.dispose();toy.dispose();toy.update(1000,camera,options);
 expect(released).toBe(3);expect(scene.children).toHaveLength(0);expect(toy.getStats().disposed).toBe(true);
 const empty=createParkWildlife(scene,{});empty.update(1000,camera,options);expect(empty.getStats().visible).toBe(0);empty.dispose();
});
