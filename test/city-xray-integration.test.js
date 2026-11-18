import {test,expect} from 'bun:test';
import {installPresentationHost} from '../world/city-xray/render-host.js';
import {readFileSync} from 'node:fs';
test('one World draw routes presentation only while enabled, preserves arguments and owns no loop',()=>{
 const draws=[],events=[],renderer={domElement:{isConnected:true},render(...args){draws.push(args);return 7;},dispose(){draws.push('dispose');}};
 const original=renderer.render,host=installPresentationHost(renderer,{announce:(type,h)=>events.push([type,h]),clock:()=>42});
 const world={},camera={},frame=[];expect(renderer.render(world,camera)).toBe(7);expect(events[0]).toEqual(['ready',host]);
 const p={scene:{xray:true},camera:{aerial:true},beforeRender:now=>frame.push(now),dispose:()=>frame.push('disposed')};host.setPresentation(p);renderer.render(world,camera);expect(draws[1]).toEqual([p.scene,p.camera]);expect(host.normal).toEqual({scene:world,camera});expect(frame).toEqual([42]);host.setPresentation(null);renderer.render(world,camera);expect(draws[2]).toEqual([world,camera]);renderer.dispose();renderer.render(world,camera);renderer.dispose();expect(draws).toHaveLength(4);expect(events.map(e=>e[0])).toEqual(['ready','disposed']);
});
test('loss blocks further GPU submission and disposes presentation once',async()=>{
 let lose,draws=0,disposed=0;const renderer={backend:{device:{lost:new Promise(r=>lose=r)}},domElement:{isConnected:true},render(){draws++;}};
 const host=installPresentationHost(renderer);host.setPresentation({scene:{},camera:{},beforeRender(){},dispose(){disposed++;}});renderer.render({},{});lose();await Promise.resolve();expect(host.available).toBe(false);expect(disposed).toBe(1);expect(()=>host.setPresentation({})).toThrow();renderer.render({},{});expect(draws).toBe(1);renderer.dispose();expect(disposed).toBe(1);
});
test('integration hooks do not introduce model imports or a second scheduler',()=>{
 for(const file of ['app.js','scene.js','render-host.js']){const source=readFileSync(new URL('../world/city-xray/'+file,import.meta.url),'utf8');expect(source).not.toMatch(/requestAnimationFrame|setAnimationLoop|setInterval|\.step\(/);}
});
test('World consumes its existing native preflight rather than allocating a second renderer',async()=>{
 const {createWorldGPU}=await import('../world/world-gpu.js');const n=Object.getOwnPropertyDescriptor(globalThis,'navigator'),w=Object.getOwnPropertyDescriptor(globalThis,'window');
 const prepared={renderer:{backend:{isWebGPUBackend:true}},mode:'webgpu'};
 Object.defineProperty(globalThis,'navigator',{value:{gpu:{}},configurable:true});Object.defineProperty(globalThis,'window',{value:{hblPreparedWorldGraphics:prepared},configurable:true});
 try{expect(await createWorldGPU()).toBe(prepared);expect(prepared.claimed).toBe(true);}finally{for(const [key,descriptor]of[['navigator',n],['window',w]])if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
