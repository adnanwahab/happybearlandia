import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createMediaPipeline,validateEmbeddedGLB,validateAnimationClips} from '../shared/media/pipeline.js';
import {createMediaPreferences} from '../shared/media/preferences.js';

test('shared cache deduplicates, accounts actual bytes and rejects conflicting identities',async()=>{
 let calls=0;const p=createMediaPipeline({fetchImpl:async()=>{calls++;return new Response(new Uint8Array(3));},budgets:{animation:4,audio:4,total:5}});
 const a=p.load('walk','animation','/walk');expect(p.load('walk','animation','/walk')).toBe(a);await a;
 await expect(p.load('sound','audio','/sound')).rejects.toThrow('budget');expect(p.stats().bytes).toBe(3);expect(p.stats().assets).toBe(1);expect(calls).toBe(2);
 await expect(p.load('walk','audio','/else')).rejects.toThrow('identity');
});
test('concurrent streams share kind and aggregate caps; failure permits retry',async()=>{
 const controls=[];const p=createMediaPipeline({budgets:{animation:4,audio:4,total:5},fetchImpl:async()=>new Response(new ReadableStream({start(c){controls.push(c);}}))});
 const a=p.load('a','animation','/a'),b=p.load('b','animation','/b');await Promise.resolve();
 controls[0].enqueue(new Uint8Array(3));controls[0].close();await a;
 controls[1].enqueue(new Uint8Array(2));controls[1].close();await expect(b).rejects.toThrow('budget');expect(p.stats().bytes).toBe(3);
 const retry=p.load('b','audio','/b');await Promise.resolve();controls[2].enqueue(new Uint8Array(2));controls[2].close();await retry;expect(p.stats().bytes).toBe(5);
});
test('declared oversize, HTTP failure and disposed acquisition reject',async()=>{
 const p=createMediaPipeline({fetchImpl:async()=>new Response('a',{headers:{'content-length':'99999999'}})});await expect(p.load('a','audio','/a')).rejects.toThrow('budget');expect(p.stats().bytes).toBe(0);
 const q=createMediaPipeline({fetchImpl:async()=>new Response('',{status:404})});await expect(q.load('a','audio','/a')).rejects.toThrow('404');q.dispose();await expect(q.load('a','audio','/a')).rejects.toThrow('disposed');
});
test('real production bear is embedded and actual assets fit encoded budgets',async()=>{
 const p=createMediaPipeline({fetchImpl:async path=>new Response(readFileSync('.'+path))});
 const bear=await p.load('bear','animation','/data/glb/bear-player.glb');expect(validateEmbeddedGLB(bear)).toBe(bear);
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(bear,'',resolve,reject));
 const clips=validateAnimationClips(gltf.animations);expect(clips).toHaveLength(2);
 expect(clips.reduce((n,c)=>n+c.tracks.length,0)).toBe(10);
 expect(clips.flatMap(c=>c.tracks).reduce((n,t)=>n+t.times.length,0)).toBe(44);
 await p.load('collision','audio','/game/sound.m4a');expect(p.stats().assets).toBe(2);expect(p.stats().bytes).toBe(bear.byteLength+readFileSync('./game/sound.m4a').byteLength);
 const json=new TextEncoder().encode(JSON.stringify({images:[{uri:'outside.png'}]}));const data=new ArrayBuffer(json.length+20),v=new DataView(data);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,data.byteLength,true);v.setUint32(12,json.length,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(data,20).set(json);expect(()=>validateEmbeddedGLB(data)).toThrow('embed');
});
test('motion follows live OS changes, local override and clamped persisted volume',()=>{
 const listeners=new Set();const query={matches:false,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};let saved=null;
 const window={matchMedia:()=>query,localStorage:{getItem:()=>saved,setItem:(_,v)=>saved=v}},p=createMediaPreferences(window),states=[];p.subscribe(s=>states.push(s));expect(p.get().volume).toBe(0);
 p.set({volume:2});expect(p.get().volume).toBe(1);query.matches=true;for(const fn of listeners)fn();expect(states.at(-1).reducedMotion).toBe(true);
 p.set({motion:'reduce'});query.matches=false;for(const fn of listeners)fn();expect(p.get().reducedMotion).toBe(true);p.dispose();expect(listeners.size).toBe(0);expect(createMediaPreferences(window).get().volume).toBe(1);
});

test('dispose releases cache and cancels pending streams without negative accounting',async()=>{
 let control;const p=createMediaPipeline({fetchImpl:async()=>new Response(new ReadableStream({start(c){control=c;}}))});
 const pending=p.load('a','audio','/a');await Promise.resolve();control.enqueue(new Uint8Array(2));await Promise.resolve();p.dispose();await expect(pending).rejects.toThrow('disposed');expect(p.stats()).toMatchObject({bytes:0,assets:0});
});

test('decoded animation duration, track and key counts are bounded',()=>{
 const clips=[{duration:2,tracks:[{times:new Float32Array(10)}]}];expect(validateAnimationClips(clips)).toBe(clips);
 expect(()=>validateAnimationClips([{duration:121,tracks:[]}])).toThrow('duration');
 expect(()=>validateAnimationClips(Array(33).fill(clips[0]))).toThrow('clip');
 expect(()=>validateAnimationClips([{duration:1,tracks:[{times:{length:200001}}]}])).toThrow('key');
});
