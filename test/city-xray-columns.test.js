import {test,expect} from 'bun:test';
import * as THREE from 'three/webgpu';
import {roadFrame} from '../world/city-xray/columns-demo/frame.js';
import {mapColumnValue,prepareColumns,mountColumns} from '../world/city-xray/columns.js';
import {intensityColor} from '../world/city-xray/columns-material.js';
import {cityFixture} from '../world/city-xray/fixtures/city-v1.js';
import {canonical,frameHash} from '../world/city-xray/contract.js';
const frame=roadFrame(0),metricId=frame.metrics[0].id,metric=frame.metrics[0];
test('fixed scale, exact ramp boundaries, units and zero/null semantics',()=>{
 expect(mapColumnValue(0,metric).height).toBe(0);expect(mapColumnValue(100,metric).height).toBe(108);expect(mapColumnValue(50,metric).height).toBe(54);expect(mapColumnValue(null,metric)).toBeNull();
 expect(intensityColor(0)).toEqual([.12,1,.2]);expect(intensityColor(1)).toEqual([1,.035,.015]);expect(intensityColor(1/3)).toEqual([1,1,.12]);expect(intensityColor(2/3)).toEqual([1,.38,.03]);
 for(const v of [-1,101,NaN,Infinity])expect(()=>mapColumnValue(v,metric)).toThrow();
 expect(()=>mapColumnValue(1,{...metric,units:'trips'})).toThrow();expect(()=>mapColumnValue(1,{...metric,normalization:{method:'auto',min:0,max:100}})).toThrow();
 expect(mapColumnValue(1,{...metric,units:'residents'}).units).toBe('residents');
});
test('read-only deterministic roads, stable IDs, no false place metric conversion',async()=>{
 const original=canonical(cityFixture(0)),before=canonical(frame);const a=prepareColumns(frame,{metricId}),b=prepareColumns(roadFrame(0),{metricId});
 expect(a.rows).toEqual(b.rows);expect(new Set(a.rows.map(r=>r.id)).size).toBe(4344);expect(a.rows.length).toBe(4344);expect(a.missing).toBe(1);expect(a.zero).toBe(1);
 expect(a.rows[0].position).toHaveLength(3);expect(a.rows.every(r=>frame.roads.some(s=>s.id===r.roadId)&&r.runId===frame.identity.run.id)).toBe(true);
 expect(canonical(frame)).toBe(before);expect(canonical(cityFixture(0))).toBe(original);expect(await frameHash(frame)).toBe(await frameHash(roadFrame(0)));
 expect(prepareColumns(cityFixture(0),{metricId:'demo-intensity'}).rows).toHaveLength(0);
});
test('budgets are deterministic, thin dimensions bounded, invalid joins fail closed',()=>{
 const a=prepareColumns(frame,{metricId,capacity:17});expect(a.rows.length).toBe(17);expect(a.omitted).toBe(4327);
 for(const options of [{capacity:8193},{samplesPerRoad:0},{width:8},{maxHeight:NaN}])expect(()=>prepareColumns(frame,{metricId,...options})).toThrow();
 const bad=structuredClone(frame);bad.samples[0].units='residents';expect(()=>prepareColumns(bad,{metricId})).toThrow();
});
test('two instanced draws, buffers, culling, disposal, disable/re-enable, identity rejection',async()=>{
 const scene=new THREE.Scene(),layer=mountColumns({scene,renderer:{init:async()=>{}},frame,metricId});expect(await layer.ready).toBe(true);
 const stats=layer.stats();expect(stats.count).toBe(4344);expect(stats.drawCalls).toBe(2);expect(stats.instanceBufferBytes).toBe(4352*76*2);expect(stats.allocatedBufferBytes).toBeGreaterThan(stats.instanceBufferBytes);
 expect(scene.children.every(m=>m.isInstancedMesh)).toBe(true);expect(scene.children[1].material.forceSinglePass).toBe(true);const selected=layer.resolve(20);expect(selected.sampleId).toBe(JSON.stringify([metricId,selected.roadId]));expect(layer.resolve(-1)).toBeNull();
 layer.setView({stride:4});expect(layer.stats().count).toBe(1086);
 const camera=new THREE.PerspectiveCamera(45,1,1,100);camera.position.set(10000,10000,10000);camera.lookAt(11000,10000,10000);camera.updateMatrixWorld();layer.setView({camera,maxDistance:5});expect(layer.stats().count).toBe(0);
 const bad=structuredClone(frame);bad.clock.tick=3;bad.metrics[0].clock.tick=3;expect(()=>layer.update(bad)).toThrow('stale');expect(()=>layer.update(roadFrame(1))).toThrow();const clock=structuredClone(frame);clock.clock={...clock.clock,authority:'monthly-city',unit:'month',tick:5,value:61};clock.metrics[0].clock=clock.clock;expect(()=>layer.update(clock)).toThrow('clock authority');
 const meshes=[...scene.children];let events=0;meshes.forEach(m=>{m.addEventListener('dispose',()=>events++);m.geometry.addEventListener('dispose',()=>events++);m.material.addEventListener('dispose',()=>events++);});
 layer.setEnabled(false);expect(events).toBe(6);expect(layer.stats().allocatedBufferBytes).toBe(0);expect(scene.children.length).toBe(0);
 layer.setEnabled(true);expect(layer.stats().count).toBe(4344);layer.dispose();layer.dispose();expect(scene.children.length).toBe(0);expect(layer.stats().state).toBe('disposed');expect(()=>layer.update(frame)).toThrow();
});
test('device loss and late initialization cannot resurrect buffers',async()=>{
 let lose;const lost=new Promise(resolve=>lose=resolve),scene=new THREE.Scene(),layer=mountColumns({scene,renderer:{init:async()=>{},backend:{device:{lost}}},frame,metricId});await layer.ready;lose({reason:'destroyed'});await Promise.resolve();expect(layer.stats().state).toBe('device-lost');expect(layer.stats().allocatedBufferBytes).toBe(0);expect(layer.setEnabled(true)).toBe(false);
 let finish;const other=mountColumns({scene,renderer:{init:()=>new Promise(resolve=>finish=resolve)},frame,metricId});other.dispose();finish();expect(await other.ready).toBe(false);expect(scene.children).toHaveLength(0);
});
test('exact polyline positions, buffer capacity remains fixed across later display budgets',async()=>{
 const f=structuredClone(frame);f.display.maxColumns=8;const layer=mountColumns({scene:new THREE.Scene(),renderer:{},frame:f,metricId});await layer.ready;
 const bytes=layer.stats().allocatedBufferBytes;layer.update(frame);expect(layer.stats().count).toBe(8);expect(layer.stats().allocatedBufferBytes).toBe(bytes);
 const row=layer.data.rows[0],road=frame.roads.find(r=>r.id===row.roadId);expect(row.fraction).toBe(1/16);expect(row.position).toEqual(road.path[0].map((v,k)=>v+(road.path[1][k]-v)/16));
 expect(layer.data.rows.every(r=>r.value===frame.samples.find(s=>s.targetId===r.roadId).value)).toBe(true);layer.dispose();
 const empty=structuredClone(frame);empty.display.maxColumns=0;const zero=mountColumns({scene:new THREE.Scene(),renderer:{},frame:empty,metricId});await zero.ready;expect(zero.update(empty).drawCalls).toBe(0);zero.dispose();
});

test('a later tick cannot switch clock authority and units',async()=>{
 const layer=mountColumns({scene:new THREE.Scene(),renderer:{},frame,metricId});await layer.ready;
 const bad=structuredClone(frame);bad.clock={...bad.clock,authority:'monthly-city',unit:'month',tick:5,value:61};bad.metrics[0].clock=bad.clock;
 expect(()=>layer.update(bad)).toThrow('clock authority/unit');expect(layer.stats().count).toBe(4344);layer.dispose();
});
