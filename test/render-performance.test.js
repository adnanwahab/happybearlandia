import {test,expect} from 'bun:test';
import {QualityManager} from '../world/render/renderer/quality-manager.js';
import {RenderStats,summarize} from '../world/render/renderer/render-stats.js';
import {CityVisibility} from '../world/render/city/visibility.js';
import * as THREE from 'three';
test('quality degrades only after sustained load and recovers slowly',()=>{
 const q=new QualityManager();for(let i=0;i<59;i++)q.sample(22,12,4);expect(q.level).toBe(0);
 q.sample(22,12,4);expect(q.level).toBe(1);
 for(let i=0;i<599;i++)q.sample(16.67,7,3);expect(q.level).toBe(1);
 q.sample(16.67,7,3);expect(q.level).toBe(0);
 for(let i=0;i<2000;i++)q.sample(25,15,8);expect(q.settings.scale).toBeCloseTo(.65);expect(q.settings.shadows).toBe(false);
 expect(()=>q.setPreset('invalid')).toThrow();
});
test('recording reports real percentiles, slow frames, drops and unavailable GPU',()=>{
 const samples=[10,10,20,40].map(frameMs=>({frameMs,cpuMs:3,gpuMs:null}));
 const report=summarize(samples);expect(report.medianFrameMs).toBe(10);expect(report.p95FrameMs).toBe(40);expect(report.averageGpuMs).toBe(null);expect(report.slowFrames).toBe(2);expect(report.droppedFrames).toBe(1);
 const stats=new RenderStats();stats.start(0,{feature:'off'},30);samples.forEach((s,i)=>stats.push(s,i*10));expect(stats.recording).toBe(null);expect(stats.lastReport.feature).toBe('off');expect(stats.lastReport.frames).toBe(4);
});
test('chunk culling preserves selected building and never changes simulation fields',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10));mesh.geometry.translate(2000,5,2000);
 const b={id:'far',index:0,center:[2000,2000],kind:'home',height:10,mesh};
 const camera=new THREE.PerspectiveCamera(45,1,1,5000);camera.position.set(0,50,100);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
 const visibility=new CityVisibility([b]);visibility.update(camera,500,null);expect(mesh.visible).toBe(false);
 visibility.update(camera,500,'far');expect(mesh.visible).toBe(true);expect(b.height).toBe(10);expect(b.center).toEqual([2000,2000]);
});

import {BuildingLOD} from '../world/render/city/lod-manager.js';
import {BuildingCutaway} from '../world/render/buildings/cutaway.js';
import {ConstructionRenderer} from '../world/render/buildings/construction-renderer.js';
import {benchmarkScene,scriptedCamera} from '../world/render/bench/scenes.js';
test('distant buildings batch with hysteresis and selected originals recover',()=>{
 const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(20,30,20),new THREE.MeshStandardMaterial());mesh.geometry.translate(0,15,0);mesh.geometry.computeBoundingBox();
 const b={id:'tower',index:0,center:[0,0],kind:'home',mesh};const lod=new BuildingLOD(scene,new Map([['0',{buildings:[b]}]]));const camera=new THREE.PerspectiveCamera(45);camera.position.set(0,80,700);
 expect(lod.update(camera,null)).toBe(1);expect(mesh.visible).toBe(false);
 mesh.visible=true;camera.position.z=510;expect(lod.update(camera,null)).toBe(1);
 mesh.visible=true;expect(lod.update(camera,'tower')).toBe(0);expect(mesh.visible).toBe(true);lod.dispose();
});
test('cutaway and construction use detached visual state and dispose cleanly',()=>{
 const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(20,34,20));mesh.geometry.translate(0,17,0);mesh.geometry.computeBoundingBox();
 const cutaway=new BuildingCutaway(scene);cutaway.select({mesh},.8);cutaway.enabled=true;cutaway.update(1000);expect(cutaway.group.userData.floors).toBe(10);expect(mesh.visible).toBe(false);
 const projects=[{id:'one',height:40,phase:'frame',progress:.5}];const original=JSON.stringify(projects),construction=new ConstructionRenderer(scene);construction.update(projects);construction.animate(1000);expect(construction.cranes.length).toBe(1);expect(JSON.stringify(projects)).toBe(original);construction.dispose();cutaway.dispose();expect(scene.children.length).toBe(0);
});
test('benchmark routes are allowlisted and camera path is deterministic',()=>{
 expect(benchmarkScene('/world/bench/rain')).toBe('rain');expect(benchmarkScene('/world/bench/invalid')).toBe(null);
 const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3()};scriptedCamera(camera,controls,18);expect(camera.position.toArray()).toEqual([20,10,100]);
});

test('park footprints stay visible and never become oversized rectangular distance proxies',()=>{
 const scene=new THREE.Scene(),parkMesh=new THREE.Mesh(new THREE.BoxGeometry(40,.3,20));parkMesh.geometry.computeBoundingBox();
 const park={id:'park',index:0,kind:'park',center:[0,0],mesh:parkMesh};
 const towerMesh=new THREE.Mesh(new THREE.BoxGeometry(20,30,20),new THREE.MeshStandardMaterial());towerMesh.geometry.translate(100,15,0);towerMesh.geometry.computeBoundingBox();
 const tower={id:'tower',index:1,kind:'home',center:[100,0],mesh:towerMesh};
 const lod=new BuildingLOD(scene,new Map([['mixed',{buildings:[park,tower]}],['park-only',{buildings:[park]}]]));
 expect(lod.chunks).toHaveLength(1);expect(lod.chunks[0].entries.map(e=>e.b.id)).toEqual(['tower']);
 const camera=new THREE.PerspectiveCamera(45);for(const distance of [100,700,3000]){camera.position.set(0,80,distance);parkMesh.visible=true;towerMesh.visible=true;lod.update(camera,null);expect(parkMesh.visible).toBe(true);}
 lod.dispose();parkMesh.geometry.dispose();towerMesh.geometry.dispose();towerMesh.material.dispose();
});

test('severe half-second frames trigger adaptation instead of being discarded',()=>{const q=new QualityManager();expect(q.sample(500,null,20)).toBe(false);q.sample(500,null,20);expect(q.sample(500,null,20)).toBe(true);expect(q.level).toBe(2);for(let i=0;i<3;i++)q.sample(500,null,20);expect(q.level).toBe(4);expect(q.settings.shadows).toBe(false);expect(q.settings.distance).toBeLessThan(1100);expect(q.settings.interiors).toBe(false);});
test('120 FPS is an explicit quality budget rather than a promised or artificial frame cap',()=>{const q=new QualityManager('LOW',{targetFPS:120});expect(q.settings.targetFPS).toBe(120);for(let i=0;i<60;i++)q.sample(12,null,2);expect(q.level).toBe(1);expect(()=>q.setTargetFPS(0)).toThrow();expect(q.sample(NaN,null,2)).toBe(false);});
