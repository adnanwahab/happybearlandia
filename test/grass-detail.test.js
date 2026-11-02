import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {generateGrassTile,insidePolygon,segmentDistance} from '../world/render/vegetation/grass-distribution.js';
import {createGrass} from '../world/render/vegetation/grass.js';
import {validateDetailAsset,DetailAssetLibrary} from '../world/render/assets/instanced-glb.js';
const park={id:'park',kind:'park',height:.3,poly:[[-40,-40],[40,-40],[40,40],[-40,40]]};
test('grass scatter is deterministic, masked to the polygon and clear of roads',()=>{
 const concave={...park,poly:[[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]]},road={a:[0,0],b:[4,0],clearance:1};
 const data=generateGrassTile(0,0,[concave],[road]);expect(data.length).toBeGreaterThan(0);expect(data).toEqual(generateGrassTile(0,0,[concave],[road]));
 for(const blade of data){expect(insidePolygon(blade.x,blade.z,concave.poly)).toBe(true);expect(segmentDistance(blade.x,blade.z,road.a,road.b)).toBeGreaterThanOrEqual(1);expect(blade.y).toBeCloseTo(.308);expect(blade.height).toBeGreaterThanOrEqual(.085);expect(blade.height).toBeLessThanOrEqual(.255);}
 expect(generateGrassTile(100,100,[park])).toEqual([]);
});
test('grass obeys density/capacity, has one draw, disappears aerially and returns after toggling',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,0);camera.lookAt(0,.3,-10);
 const grass=createGrass(scene,{buildings:[park],roads:[]});
 for(let i=0;i<100;i++)grass.update(1000+i*17,camera,{density:.5},true,'BALANCED');
 expect(grass.getStats().blades).toBe(8000);expect(grass.getStats().drawCalls).toBe(1);expect(grass.getStats().cachedTiles).toBeLessThanOrEqual(192);
 grass.update(4000,camera,{density:1},false);expect(grass.getStats().blades).toBe(0);
 for(let i=0;i<100;i++)grass.update(5000+i*17,camera,{density:.5},true,'LOW');expect(grass.getStats().blades).toBe(2500);
 camera.position.y=100;grass.update(8000,camera,{density:1});expect(grass.getStats().blades).toBe(0);
 grass.dispose();expect(scene.children).toHaveLength(0);
});
test('GLB preview parses and static instancing rejects expensive and skinned assets',async()=>{
 const binary=await Bun.file(new URL('../world/render/assets/models/bench-preview.glb',import.meta.url)).arrayBuffer();const gltf=await new GLTFLoader().parseAsync(binary,'');
 expect(validateDetailAsset(gltf,{maxTriangles:1000,maxParts:2}).triangles).toBeGreaterThan(0);expect(()=>validateDetailAsset(gltf,{maxTriangles:1})).toThrow();
 expect(()=>validateDetailAsset({scene:new THREE.Group()})).toThrow();const scene=new THREE.Group();scene.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));expect(()=>validateDetailAsset({scene})).toThrow();
});
test('GLB instances share geometry and release resources on unload',async()=>{
 const binary=await Bun.file(new URL('../world/render/assets/models/bench-preview.glb',import.meta.url)).arrayBuffer(),scene=new THREE.Scene(),library=new DetailAssetLibrary(scene);
 library.loader.loadAsync=()=>new GLTFLoader().parseAsync(binary,'');
 const handle=await library.load({url:'/bench.glb',transforms:[{position:[0,0,0]},{position:[3,0,0]}]});const camera=new THREE.PerspectiveCamera();camera.position.set(0,3,5);
 library.update(1000,camera,{density:1},{});expect(handle.getStats().instances).toBe(2);expect(scene.children[0].children).toHaveLength(1);expect(handle.getStats().drawCalls).toBe(1);
 handle.dispose();expect(scene.children).toHaveLength(0);expect(library.getStats()).toEqual([]);library.dispose();
});
