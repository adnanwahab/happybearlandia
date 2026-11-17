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
 // Explicit authored visual detail is required; a shell bounding box does not
 // establish modeled floors, inhabitants or an interior layout (SHE-606).
 const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(20,34,20),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(geometry,material);
 geometry.translate(0,17,0);geometry.computeBoundingBox();
 const detailGeometry=new THREE.Group(),detail=new THREE.Mesh(new THREE.BoxGeometry(8,.2,8),new THREE.MeshStandardMaterial());detailGeometry.add(detail);detailGeometry.visible=false;scene.add(mesh,detailGeometry);
 const fields=Object.freeze({id:'osm:fixture',kind:'home',height:34,center:Object.freeze([0,0])}),building=Object.freeze({...fields,mesh,detailGeometry});
 const originalFields=JSON.stringify(fields),originalPositions=Array.from(geometry.attributes.position.array),originalMaterial=material.toJSON();
 const triangles=g=>{const positions=g.attributes.position,index=g.index,rows=[];for(let i=0;i<(index?.count??positions.count);i+=3){const vertices=[];for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j;vertices.push([positions.getX(k),positions.getY(k),positions.getZ(k)]);}rows.push(JSON.stringify(vertices));}return rows.sort();};
 const originalTriangles=triangles(geometry),cutaway=new BuildingCutaway(scene);cutaway.select(building);expect(cutaway.setEnabled(true)).toBe(true);cutaway.update(1000,.1);
 expect(cutaway.status.id).toBe(fields.id);expect(mesh.parent).toBe(scene);expect(mesh.visible).toBe(true);expect(mesh.geometry).not.toBe(geometry);
 expect(mesh.geometry.index.count).toBeGreaterThan(0);expect(cutaway.roof.geometry.index.count).toBeGreaterThan(0);
 expect([...triangles(mesh.geometry),...triangles(cutaway.roof.geometry)].sort()).toEqual(originalTriangles);
 expect(mesh.material).toBe(material);expect(material.toJSON()).toEqual(originalMaterial);expect(Array.from(geometry.attributes.position.array)).toEqual(originalPositions);expect(JSON.stringify(fields)).toBe(originalFields);
 const resources=[...cutaway.resources],disposed=new Map(resources.map(resource=>[resource,0]));expect(resources).toHaveLength(3);for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
 let hostDisposed=0;for(const resource of [geometry,material,detail.geometry,detail.material])resource.addEventListener('dispose',()=>hostDisposed++);
 cutaway.update(1001,1,true);expect(cutaway.progress).toBe(1);expect(detailGeometry.visible).toBe(true);expect(cutaway.roof.visible).toBe(false);
 const projects=[{id:'one',height:40,phase:'frame',progress:.5}];const original=JSON.stringify(projects),construction=new ConstructionRenderer(scene);construction.update(projects);construction.animate(1000);expect(construction.cranes.length).toBe(1);expect(JSON.stringify(projects)).toBe(original);construction.dispose();
 cutaway.setEnabled(false);cutaway.update(1002,1,true);expect(mesh.geometry).toBe(geometry);expect(detailGeometry.visible).toBe(false);expect(cutaway.resources).toHaveLength(0);expect(cutaway.roof).toBeNull();expect([...disposed.values()]).toEqual(resources.map(()=>1));
 cutaway.dispose();expect([...disposed.values()]).toEqual(resources.map(()=>1));expect(hostDisposed).toBe(0);expect(scene.children).toEqual([mesh,detailGeometry]);expect(building.id).toBe(fields.id);expect(building.mesh).toBe(mesh);expect(building.detailGeometry).toBe(detailGeometry);expect(JSON.stringify(fields)).toBe(originalFields);expect(mesh.material).toBe(material);
 scene.clear();for(const resource of [geometry,material,detail.geometry,detail.material])resource.dispose();expect(hostDisposed).toBe(4);expect(scene.children).toHaveLength(0);
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
