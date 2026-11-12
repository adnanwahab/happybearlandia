import {test, expect} from 'bun:test';
import * as THREE from 'three';
import {createCanvasRenderer} from '../world/render/renderer/canvas-renderer.js';

test('World Canvas startup propagates denied contexts for the normal renderer recovery path',()=>{
  expect(()=>createCanvasRenderer({canvas:{getContext:()=>null}})).toThrow('Canvas2D is unavailable');
  expect(()=>createCanvasRenderer({canvas:{getContext(){throw new Error('context denied');}}})).toThrow('context denied');
});

test('World fallback draws supplied inventory without changing scene state and stops after disposal',()=>{
  let draws=0;
  const context=new Proxy({}, {get:(_,name)=>name==='fill'?()=>draws++:()=>{},set:()=>true});
  const canvas={style:{},dataset:{},setAttribute(){},getContext:()=>context,remove(){}};
  const {renderer}=createCanvasRenderer({canvas});renderer.setSize(390,844);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(45,390/844,.1,1000);
  camera.position.set(20,20,20);camera.lookAt(0,0,0);
  const building=new THREE.Mesh(new THREE.BoxGeometry(4,8,4),new THREE.MeshBasicMaterial());
  building.userData={id:'recorded-building',units:24};scene.add(building);
  const before=JSON.stringify(building.userData);renderer.render(scene,camera);
  expect(draws).toBe(1);expect(canvas.dataset.renderer).toBe('canvas2d');
  expect(JSON.stringify(building.userData)).toBe(before);
  renderer.dispose();renderer.render(scene,camera);expect(draws).toBe(1);
  building.geometry.dispose();building.material.dispose();
});
