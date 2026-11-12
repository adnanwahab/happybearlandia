import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createPopulationRenderer} from '../world/population/renderer.js';
import {clusterPopulationRows,populationLOD,populationDisplayCounts} from '../world/population/render-lod.js';
test('deterministic clusters conserve sampled identities including negative boundaries',()=>{
 const rows=[{id:'a',x:-1,z:0},{id:'b',x:0,z:0},{id:'c',x:39,z:0},{id:'d',x:40,z:0}];
 const clusters=clusterPopulationRows(rows);expect(clusters.map(c=>c.count)).toEqual([1,2,1]);expect(clusters.flatMap(c=>c.memberIds).sort()).toEqual(['a','b','c','d']);expect(clusterPopulationRows(rows)).toEqual(clusters);
 expect([349,350,899,900].map(populationLOD)).toEqual(['residents','clusters','clusters','heat']);expect(populationDisplayCounts(null).residentRecords).toBeNull();
});
test('zoom changes display only; full totals, selected identity and disabled counts remain truthful',()=>{
 const frame={population:10000,metrics:{syntheticPopulation:10000,meanStress:.2},districts:[{id:'d',population:10000}],visibleAgents:[{id:'a',x:0,z:0},{id:'b',x:1,z:1},{id:'c',x:100,z:100}]};
 const before=JSON.stringify(frame),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,10,10);let distance=100;
 const view=createPopulationRenderer({scene,camera,THREE,getViewDistance:()=>distance,worldContext:{districts:[{id:'d',bounds:{minX:0,maxX:200,minZ:0,maxZ:200}}]}});view.setActive(true);view.updateFrame(frame,0);view.update(200);
 expect(view.getStats().drawnIndividuals).toBe(3);
 distance=500;view.update(201);expect(view.getStats().drawnClusters).toBe(2);expect(view.getStats().drawnIndividuals).toBe(0);
 view.setSelected('a');view.update(202);expect(view.getStats().drawnIndividuals).toBe(1);
 distance=1000;view.update(203);expect(view.getStats().heatCells).toBe(1);expect(view.getStats().drawnClusters).toBe(0);expect(view.getStats().residentRecords).toBe(10000);expect(JSON.stringify(frame)).toBe(before);
 view.setActive(false);expect(view.getStats().drawnIndividuals).toBe(0);expect(view.getStats().heatCells).toBe(0);view.destroy();expect(scene.children).toHaveLength(0);
});
