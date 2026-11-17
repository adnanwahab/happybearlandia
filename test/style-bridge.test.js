import {test,expect} from 'bun:test';
import {createStyleBridge,supportsStyleBridge} from '../world/render/style-bridge.js';
test('style interpolates, reverses, clamps time and swaps immediately',()=>{
 const bridge=createStyleBridge();bridge.set(1);expect(bridge.update(.1)).toBeCloseTo(.3);
 bridge.set(0);expect(bridge.update(.05)).toBeCloseTo(.15);
 expect(bridge.update(-1)).toBeCloseTo(.15);expect(bridge.update(NaN)).toBeCloseTo(.15);
 bridge.set(1,{immediate:true});expect(bridge.getState()).toEqual({value:1,target:1});
 bridge.set(0);expect(bridge.update(0,{immediate:true})).toBe(0);
 expect(()=>bridge.set(NaN)).toThrow();expect(()=>bridge.set(2)).toThrow();
});

import * as THREE from 'three';
import {createFacadeMaterial} from '../world/render/buildings/facade-material.js';
test('material styles retain exact ray hits, geometry, transforms and source records',()=>{
 const source={id:'building-7',runId:'unchanged',seed:42,minute:17,policy:{tax:3}};
 const before=structuredClone(source),facade=createFacadeMaterial(0x998877),geometry=new THREE.BoxGeometry(4,8,4);
 const mesh=new THREE.Mesh(geometry,facade.material);mesh.userData.entity=source;mesh.updateMatrixWorld();
 const ray=new THREE.Raycaster(new THREE.Vector3(0,0,20),new THREE.Vector3(0,0,-1));
 const hit=()=>ray.intersectObject(mesh).map(h=>[h.object.uuid,h.distance,h.faceIndex,h.point.toArray()]);
 const expected=hit(),positions=Array.from(geometry.attributes.position.array),matrix=mesh.matrixWorld.toArray();
 for(const value of [0,.25,.5,1,0]){facade.setStyle(value);expect(hit()).toEqual(expected);expect(mesh.geometry).toBe(geometry);expect(Array.from(geometry.attributes.position.array)).toEqual(positions);expect(mesh.matrixWorld.toArray()).toEqual(matrix);expect(source).toEqual(before);}
 geometry.dispose();facade.material.dispose();
});

test('missing and unsupported facades remain unavailable',()=>{expect(supportsStyleBridge([])).toBe(false);expect(supportsStyleBridge([{},null])).toBe(false);expect(supportsStyleBridge([createFacadeMaterial(0xffffff)])).toBe(true);});
