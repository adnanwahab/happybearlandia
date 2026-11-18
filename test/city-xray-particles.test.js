import {test,expect} from 'bun:test';
import * as THREE from 'three/webgpu';
import {roadFrame} from '../world/city-xray/columns-demo/frame.js';
import {prepareParticles,mountParticles} from '../world/city-xray/particles.js';
import {canonical} from '../world/city-xray/contract.js';
const frame=roadFrame(0),metricId=frame.metrics[0].id;
test('deterministic bounded immutable display distribution; missing/zero absent',()=>{
 const before=canonical(frame),a=prepareParticles(frame,{metricId}),b=prepareParticles(frame,{metricId});expect(a.rows).toEqual(b.rows);expect(a.rows.length).toBe(18000);expect(a.missing).toBe(1);expect(a.zero).toBe(1);expect(a.rows.every(r=>r.value>0&&r.size<2)).toBe(true);expect(canonical(frame)).toBe(before);expect(prepareParticles(frame,{metricId,seed:4}).rows).not.toEqual(a.rows);
 for(const capacity of [-1,24001,NaN])expect(()=>prepareParticles(frame,{metricId,capacity})).toThrow();expect(prepareParticles(frame,{metricId,capacity:0}).rows).toHaveLength(0);
 const empty=structuredClone(frame);empty.samples=[];empty.metrics[0].missingCount=0;empty.display.symbolCount=0;expect(prepareParticles(empty,{metricId}).rows).toHaveLength(0);
});
test('single instanced draw, repeat/pause/seek uniform only and lifecycle',async()=>{
 const scene=new THREE.Scene(),layer=mountParticles({scene,renderer:{},frame,metricId});expect(await layer.ready).toBe(true);expect(layer.stats().drawCalls).toBe(1);expect(scene.children[0].isInstancedMesh).toBe(true);const bytes=layer.stats().allocatedBufferBytes,mat=scene.children[0].instanceMatrix.version;
 layer.setTime(5);expect(layer.stats().phase).toBe(5);layer.setTime(17);expect(layer.stats().phase).toBe(5);layer.setTime(0);expect(scene.children[0].instanceMatrix.version).toBe(mat);expect(layer.stats().allocatedBufferBytes).toBe(bytes);expect(()=>layer.setTime(NaN)).toThrow();expect(()=>layer.update(roadFrame(1))).toThrow();layer.setEnabled(false);expect(scene.children).toHaveLength(0);expect(layer.stats().allocatedBufferBytes).toBe(0);layer.setEnabled(true);expect(layer.stats().count).toBe(18000);layer.dispose();layer.dispose();expect(scene.children).toHaveLength(0);
});
test('reduced motion, initialization failure, loss and late dispose',async()=>{
 let lose;const layer=mountParticles({scene:new THREE.Scene(),renderer:{backend:{device:{lost:new Promise(r=>lose=r)}}},frame,metricId,reducedMotion:true});await layer.ready;layer.setTime(8);expect(layer.stats().phase).toBe(0);lose();await Promise.resolve();expect(layer.stats().state).toBe('device-lost');expect(layer.stats().allocatedBufferBytes).toBe(0);expect(layer.setEnabled(true)).toBe(false);
 const failed=mountParticles({scene:new THREE.Scene(),renderer:{init:()=>Promise.reject(Error())},frame,metricId});expect(await failed.ready).toBe(false);
 let finish;const scene=new THREE.Scene(),late=mountParticles({scene,renderer:{init:()=>new Promise(r=>finish=r)},frame,metricId});await Promise.resolve();late.dispose();finish();expect(await late.ready).toBe(false);expect(scene.children).toHaveLength(0);
});
test('all zero, null roads and explicit disposal events',async()=>{
 const empty=structuredClone(frame);for(const s of empty.samples)if(s.value!==null)s.value=0;expect(prepareParticles(empty,{metricId}).rows).toHaveLength(0);
 const scene=new THREE.Scene(),l=mountParticles({scene,renderer:{},frame,metricId,capacity:24000});await l.ready;expect(l.stats().allocatedBufferBytes).toBeLessThan(1900000);let events=0;const m=scene.children[0];for(const o of [m,m.geometry,m.material])o.addEventListener('dispose',()=>events++);l.dispose();expect(events).toBe(3);
 const absent=mountParticles({scene,renderer:{},frame,metricId,capacity:0});await absent.ready;expect(absent.stats().drawCalls).toBe(0);expect(absent.stats().allocatedBufferBytes).toBe(0);absent.dispose();
 const noLayer=structuredClone(frame);noLayer.supportedLayers=['roads'];expect(()=>prepareParticles(noLayer,{metricId})).toThrow();
});
