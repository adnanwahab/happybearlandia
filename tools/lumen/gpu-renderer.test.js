import {test,expect} from 'bun:test';
import {createWebGPURenderer} from './gpu-renderer.js';
function mock(init, native=true){
  return {WebGPURenderer:class{
    constructor(options){this.options=options;this._getFallback=()=>{throw Error('WebGL fallback invoked')};this.backend={parameters:{},isWebGPUBackend:native};}
    async init(){await init?.(this);}
  }};
}
test('rejects unsupported browsers before creating a renderer',async()=>{
  await expect(createWebGPURenderer({},null,null)).rejects.toThrow('does not expose WebGPU');
});
test('awaits native backend initialization',async()=>{
  let initialized=false; const canvas={};
  const renderer=await createWebGPURenderer(mock(async()=>{await Promise.resolve();initialized=true}),canvas,{});
  expect(initialized).toBe(true);expect(renderer.backend.isWebGPUBackend).toBe(true);expect(renderer.options.canvas).toBe(canvas);
});
test('blocks Three.js implicit WebGL fallback',async()=>{
  const renderer=await createWebGPURenderer(mock(r=>{expect(r._getFallback).toBeNull()}),null,{});
  expect(renderer._getFallback).toBeNull();
});
test('rejects a non-WebGPU backend even after initialization',async()=>{
  await expect(createWebGPURenderer(mock(null,false),null,{})).rejects.toThrow('not WebGPU');
});
test('surfaces device initialization failures',async()=>{
  await expect(createWebGPURenderer(mock(()=>{throw Error('Device denied')}),null,{})).rejects.toThrow('Device denied');
});
