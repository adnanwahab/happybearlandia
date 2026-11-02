import { test, expect } from 'bun:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { shirtColorFor } from '../world/render/people/human-renderer.js';

test('original human GLB is self-contained and loads clothed named instancing parts', async () => {
  const bytes=await Bun.file(new URL('../world/assets/human-person.glb',import.meta.url)).arrayBuffer();
  const header=new DataView(bytes);
  expect(header.getUint32(0,true)).toBe(0x46546c67);
  expect(header.getUint32(4,true)).toBe(2);
  expect(header.getUint32(8,true)).toBe(bytes.byteLength);
  const jsonLength=header.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength)));
  expect((json.buffers||[]).every(buffer=>!buffer.uri)).toBe(true);
  const gltf=await new GLTFLoader().parseAsync(bytes,'');
  const parts=[];
  gltf.scene.traverse(node=>{if(node.isMesh)parts.push(node);});
  expect(parts.map(mesh=>mesh.name).sort()).toEqual(['Hair','Pants','Shoes','Skin','TShirt']);
  expect(parts.every(mesh=>mesh.geometry.attributes.position.count>0&&mesh.material.name===mesh.name)).toBe(true);
  const size=new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  expect(size.y).toBeGreaterThan(1.7);
  expect(size.y).toBeLessThan(1.95);
  expect(size.x).toBeLessThan(1);
  expect(new Set(Array.from({length:50},(_,id)=>shirtColorFor(`person-${id}`))).size).toBeGreaterThan(6);
  expect(shirtColorFor('person-10')).toBe(shirtColorFor('person-10'));
  for(const mesh of parts){mesh.geometry.dispose();mesh.material.dispose();}
});
