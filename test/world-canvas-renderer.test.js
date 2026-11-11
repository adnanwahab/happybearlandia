import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createCanvasRenderer,hull} from '../world/render/renderer/canvas-renderer.js';
test('Canvas fallback projects real scene bounds and reports no GPU support',()=>{
 let fills=0,removed=false;const context={fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fills++;},stroke(){}};
 const canvas={getContext:()=>context,setAttribute(){},dataset:{},style:{},remove(){removed=true;}};
 const {renderer,mode}=createCanvasRenderer({canvas});renderer.setSize(400,300);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,4/3,.1,1000);camera.position.set(20,20,20);camera.lookAt(0,0,0);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,8,4),new THREE.MeshStandardMaterial({color:0x80afba}));scene.add(mesh);renderer.render(scene,camera);
 expect(mode).toBe('canvas2d');expect(fills).toBe(1);expect(renderer.hasFeature('timestamp-query')).toBe(false);expect(mesh.position.toArray()).toEqual([0,0,0]);renderer.dispose();expect(removed).toBe(true);
});
test('convex hull removes interior points without modifying geometry inputs',()=>{const points=[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2},{x:1,y:1}];expect(hull(points)).toHaveLength(4);expect(points).toHaveLength(5);});
