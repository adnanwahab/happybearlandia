import {test,expect} from 'bun:test';
import {measurement,footprintArea,snapPoint} from '../world/measure/model.js';
test('known 3D coordinates, height and horizontal distance preserve zero',()=>{
 expect(measurement({x:0,y:0,z:0},{x:3,y:12,z:4})).toEqual({distance:13,height:12,horizontal:5});
 expect(measurement({x:-3,y:12,z:-4},{x:0,y:0,z:0}).distance).toBe(13);
 expect(measurement({x:0,y:0,z:0},{x:0,y:0,z:0}).distance).toBe(0);
 expect(()=>measurement({x:NaN,y:0,z:0},{})).toThrow();
});
test('projected footprints and missing polygons',()=>{
 expect(footprintArea([[0,0],[3,0],[3,4],[0,4]])).toBe(12);
 expect(footprintArea([[0,4],[3,4],[3,0],[0,0]])).toBe(12);
 expect(footprintArea(null)).toBeNull();expect(footprintArea([[0,0],[NaN,0],[1,1]])).toBeNull();
});
test('corner snapping is bounded in world metres and retains free surfaces',()=>{
 const p={x:1,y:0,z:0};expect(snapPoint(p,[{x:0,y:0,z:0}])).toEqual({x:0,y:0,z:0});
 expect(snapPoint(p,[{x:5,y:0,z:0}])).toEqual(p);
});
import * as THREE from 'three';
import {pickMeasurementSurface} from '../world/measure/picking.js';
test('raycast uses visible world geometry, preserves source ID, and handles empty sky',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,10,6),new THREE.MeshBasicMaterial());mesh.position.y=5;mesh.userData.b={id:'source/42',height:10,poly:[[-2,-3],[2,-3],[2,3],[-2,3]]};mesh.updateMatrixWorld();
 const camera=new THREE.PerspectiveCamera(60,1,0.1,100);camera.position.set(0,5,20);camera.lookAt(0,5,0);
 const options={camera,meshes:[mesh],rect:{left:0,top:0,width:100,height:100},x:50,y:50,snap:false};
 const hit=pickMeasurementSurface(THREE,options);expect(hit.point.z).toBeCloseTo(3);expect(hit.point.y).toBeCloseTo(5);expect(hit.area).toBe(24);expect(hit.tag).toContain('source/42');
 mesh.visible=false;expect(pickMeasurementSurface(THREE,options)).toBeNull();
 camera.lookAt(0,0,0);const ground=pickMeasurementSurface(THREE,options);expect(ground.point.y).toBe(0);expect(ground.tag).toBe('scene ground plane');
 mesh.geometry.dispose();mesh.material.dispose();
});
