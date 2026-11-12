import {test,expect} from 'bun:test';
import {rememberDemoClick,consumeDemoClick,createDemoTiming} from '../world/future-machine/demo-performance.js';
test('cross-navigation timestamp is single-use, bounded and storage optional',()=>{
 const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k)};
 rememberDemoClick(storage,100);expect(consumeDemoClick(storage,140)).toBe(100);expect(consumeDemoClick(storage,140)).toBeNull();
 for(const start of [NaN,200, -60000]){rememberDemoClick(storage,start);expect(consumeDemoClick(storage,140)).toBeNull();}
 const denied={getItem(){throw Error();},setItem(){throw Error();}};rememberDemoClick(denied,100);expect(consumeDemoClick(denied,140)).toBeNull();
});
test('records only successful graphics endpoints and resets stale attempts',()=>{
 let now=100;const timer=createDemoTiming({now:()=>now});timer.start();now=125;
 expect(timer.finish('inventory-fallback',false)).toBeNull();expect(timer.result).toBeNull();
 expect(timer.finish('webgl',false)).toEqual({version:1,source:'button',renderer:'webgl',state:'cold',durationMs:25,endpoint:'visible-city-after-paint'});
 timer.start();expect(timer.result).toBeNull();now=130;expect(timer.finish('canvas2d',true).durationMs).toBe(5);
 timer.start();timer.cancel();expect(timer.finish('webgpu',false)).toBeNull();
});
test('visibility gate rejects hidden, disconnected, offscreen and zero-size canvases',async()=>{
 const {visibleCity}=await import('../world/future-machine/demo-performance.js');
 const names=['getComputedStyle','innerWidth','innerHeight'],before=names.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 try{
  globalThis.getComputedStyle=()=>({visibility:'visible',opacity:'1'});globalThis.innerWidth=800;globalThis.innerHeight=600;
  let rect={width:100,height:100,top:0,left:0,bottom:100,right:100};
  const canvas={isConnected:true,checkVisibility:()=>true,getBoundingClientRect:()=>rect};
  expect(visibleCity(canvas,{visibilityState:'visible'})).toBe(true);
  expect(visibleCity(canvas,{visibilityState:'hidden'})).toBe(false);
  canvas.isConnected=false;expect(visibleCity(canvas,{visibilityState:'visible'})).toBe(false);canvas.isConnected=true;
  rect={...rect,top:700,bottom:800};expect(visibleCity(canvas,{visibilityState:'visible'})).toBe(false);
  rect={...rect,top:0,bottom:100,width:0};expect(visibleCity(canvas,{visibilityState:'visible'})).toBe(false);
  rect={...rect,width:100};canvas.checkVisibility=()=>false;expect(visibleCity(canvas,{visibilityState:'visible'})).toBe(false);
 }finally{names.forEach((name,i)=>{if(before[i])Object.defineProperty(globalThis,name,before[i]);else delete globalThis[name];});}
});
