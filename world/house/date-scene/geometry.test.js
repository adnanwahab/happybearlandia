import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createDateGeometry} from './geometry.js';
test('mapped footprint orientation and height survive extrusion; building occlusion reveals actual participants',()=>{
 const scene=new THREE.Scene(),kit=createDateGeometry(THREE,scene),building=kit.addBuilding({kind:'building',height:6,polygon:[[0,0],[10,0],[10,10],[0,10]]});scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(building);expect(bounds.min.x).toBeCloseTo(0);expect(bounds.max.z).toBeCloseTo(10);expect(bounds.max.y).toBeCloseTo(6);const camera=new THREE.PerspectiveCamera();camera.position.set(5,8,20);kit.revealPeople([{x:5,z:5}],camera);expect(building.material.transparent).toBe(true);expect(building.material.depthWrite).toBe(false);kit.revealPeople([],camera);expect(building.material.transparent).toBe(false);kit.destroy();expect(scene.children).toHaveLength(0);expect(kit.geometries.size).toBe(0);
});
test('road geometry has a hard segment budget',()=>{const scene=new THREE.Scene(),kit=createDateGeometry(THREE,scene),points=Array.from({length:2200},(_,i)=>[i%100,(i%2)*2]);kit.addRoad({points});expect(kit.geometries.size).toBe(2001);kit.destroy();});
