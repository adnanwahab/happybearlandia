import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createCityDetails} from '../world/render/environment/city-details.js';

test('empty detail families retain nonzero GPU matrix storage without drawing phantom instances',()=>{
 const scene=new THREE.Scene(),details=createCityDetails(scene,{roads:[],buildings:[]});
 try{
  const meshes=Object.values(details.groups).flat().filter(mesh=>mesh.isInstancedMesh);
  expect(meshes.length).toBeGreaterThan(0);
  const check=()=>{for(const mesh of meshes){expect(mesh.count).toBe(0);expect(mesh.instanceMatrix.array.byteLength).toBeGreaterThanOrEqual(64);}};
  check();details.update(1000,.016,new THREE.PerspectiveCamera(),{density:1,geometryRadius:1},{});check();
  expect(details.vehicleCount).toBe(0);expect(details.getVehicle(0)).toBeNull();expect(details.pickVehicle(new THREE.Raycaster())).toBeNull();
 }finally{details.dispose();}
 expect(scene.children).toHaveLength(0);
});
