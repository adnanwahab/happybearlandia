import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {disposeObjectResources} from '../world/future-machine/scene/resources.js';

test('scene cleanup releases shared buffers, material arrays and textures once',()=>{
 const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),texture=new THREE.Texture();
 const material=new THREE.MeshBasicMaterial({map:texture});
 const counts={geometry:0,material:0,texture:0};
 for(const [name,resource] of Object.entries({geometry,material,texture}))resource.addEventListener('dispose',()=>counts[name]++);
 scene.add(new THREE.Mesh(geometry,[material,material]),new THREE.Mesh(geometry,material));
 // GridHelper owns geometry and an array of materials too.
 const grid=new THREE.GridHelper();let gridDisposed=0;
 grid.geometry.addEventListener('dispose',()=>gridDisposed++);scene.add(grid);
 disposeObjectResources(scene);
 expect(counts).toEqual({geometry:1,material:1,texture:1});expect(gridDisposed).toBe(1);
});


test('one teardown shares disposal ownership across detached roots and effect material restoration',async()=>{
 const {createVisualEffects}=await import('../world/future-machine/scene/effects.js');
 const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture});
 const first=new THREE.Mesh(geometry,material),second=new THREE.Mesh(geometry,material),counts={geometry:0,texture:0,material:0,clone:0};
 for(const [name,resource] of Object.entries({geometry,texture,material}))resource.addEventListener('dispose',()=>counts[name]++);
 const effects=createVisualEffects({THREE});effects.apply(first,{collection:'buildings',id:'b',height:1},{changed:true});
 first.material.addEventListener('dispose',()=>counts.clone++);effects.remove(first);
 const released=disposeObjectResources(first);disposeObjectResources(second,released);effects.dispose();
 expect(counts).toEqual({geometry:1,texture:1,material:1,clone:1});
});
