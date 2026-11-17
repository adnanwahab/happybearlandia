import {test,expect} from 'bun:test';
import {createShaderWarmup} from '../world/render/shader-warmup.js';
test('uncompiled visible objects wait off-frame and restore visibility even when rendering fails',async()=>{
 const object={visible:true,geometry:{id:1},material:{id:2,version:0}},jobs=[];let finish,calls=0;
 const scene={traverseVisible(fn){if(object.visible)fn(object)}};
 const renderer={compileAsync:()=>{calls++;return new Promise(resolve=>finish=resolve)}};
 const warmup=createShaderWarmup({renderer,scene,camera:{},schedule:fn=>jobs.push(fn)});
 warmup.draw(()=>expect(object.visible).toBe(false));expect(object.visible).toBe(true);expect(calls).toBe(0);
 jobs.shift()();await Promise.resolve();expect(calls).toBe(1);finish();await new Promise(r=>setTimeout(r,0));
 warmup.draw(()=>expect(object.visible).toBe(true));expect(warmup.getStats()).toEqual({pending:0,compiled:1,failed:0});
 object.material.version++;expect(()=>warmup.draw(()=>{throw Error('render failed')})).toThrow('render failed');expect(object.visible).toBe(true);warmup.dispose();
});
test('unsupported compilation preserves renderer and rejected warmup fails open',async()=>{
 const object={visible:true,geometry:{id:1},material:{id:2}},scene={traverseVisible:fn=>fn(object)},jobs=[];
 createShaderWarmup({renderer:{},scene}).draw(()=>expect(object.visible).toBe(true));
 const warmup=createShaderWarmup({renderer:{compileAsync:()=>Promise.reject(Error('unavailable'))},scene,schedule:fn=>jobs.push(fn)});
 warmup.draw(()=>{});jobs.shift()();await new Promise(r=>setTimeout(r,0));warmup.draw(()=>expect(object.visible).toBe(true));expect(warmup.getStats().failed).toBe(1);warmup.dispose();
});
test('pending compilation is bounded and delayed assets become visible after timeout',()=>{
 let time=0;const objects=Array.from({length:200},(_,id)=>({visible:true,geometry:{id},material:{id}})),jobs=[];
 const scene={traverseVisible(fn){objects.forEach(fn)}};
 const warmup=createShaderWarmup({renderer:{compileAsync:()=>new Promise(()=>{})},scene,schedule:fn=>jobs.push(fn),now:()=>time,maxPending:8,visibilityTimeoutMs:100});
 warmup.draw(()=>expect(objects.every(o=>!o.visible)).toBe(true));expect(warmup.getStats().pending).toBe(8);expect(objects.every(o=>o.visible)).toBe(true);
 time=101;warmup.draw(()=>expect(objects.every(o=>o.visible)).toBe(true));warmup.dispose();
});
test('buffer replacements with identical layout reuse warmed shader; new layout recompiles',async()=>{
 const material={id:2,version:0},object={visible:true,geometry:{id:1,attributes:{position:{itemSize:3,array:new Float32Array(3)}}},material},jobs=[];let calls=0;
 const warmup=createShaderWarmup({renderer:{compileAsync:async()=>{calls++;}},scene:{traverseVisible:fn=>fn(object)},schedule:fn=>jobs.push(fn)});
 warmup.draw(()=>{});jobs.shift()();await new Promise(r=>setTimeout(r,0));
 object.geometry={id:3,attributes:{position:{itemSize:3,array:new Float32Array(6)}}};warmup.draw(()=>expect(object.visible).toBe(true));expect(calls).toBe(1);expect(warmup.getStats().pending).toBe(0);
 object.geometry.attributes.uv={itemSize:2,array:new Float32Array(2)};warmup.draw(()=>expect(object.visible).toBe(false));expect(warmup.getStats().pending).toBe(1);warmup.dispose();
});
