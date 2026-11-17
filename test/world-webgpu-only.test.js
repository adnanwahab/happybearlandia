import {test,expect} from 'bun:test';
import {initializeWorldGPU,createWorldGPU} from '../world/world-gpu.js';
test('native initialization disables implicit fallback and returns the sole supported backend',async()=>{
 const renderer={_initialized:true,_getFallback:()=>{throw Error('fallback must never run');},backend:{isWebGPUBackend:true},async init(){expect(this._getFallback).toBeNull();},dispose(){throw Error('successful renderer must stay alive');}};
 const result=await initializeWorldGPU(renderer);expect(result).toEqual({renderer,mode:'webgpu'});expect(renderer.toneMappingExposure).toBe(.85);
});
test('adapter rejection releases the partial backend without invoking init-retrying renderer disposal',async()=>{
 const failure=new Error('adapter unavailable');let backendDisposed=0,rendererDisposed=0;
 const renderer={_initialized:false,backend:{dispose(){backendDisposed++;}},async init(){throw failure;},dispose(){rendererDisposed++;}};
 await expect(initializeWorldGPU(renderer)).rejects.toBe(failure);expect(backendDisposed).toBe(1);expect(rendererDisposed).toBe(0);
});
test('unexpected non-WebGPU backend is rejected and fully initialized resources are disposed',async()=>{
 let disposed=0;const renderer={_initialized:true,backend:{isWebGPUBackend:false},async init(){},dispose(){disposed++;}};
 await expect(initializeWorldGPU(renderer)).rejects.toThrow('A WebGPU adapter could not be initialized.');expect(disposed).toBe(1);
});
test('cleanup failures preserve the original initialization error',async()=>{
 const failure=new Error('device rejected');for(const asynchronous of [false,true]){const renderer={_initialized:false,backend:{dispose(){if(asynchronous)return Promise.reject(Error('cleanup rejected'));throw Error('cleanup threw');}},async init(){throw failure;}};await expect(initializeWorldGPU(renderer)).rejects.toBe(failure);}
});

test('null adapter rejection remains a readable Error and releases partial resources',async()=>{let disposed=0;const renderer={_initialized:false,backend:{dispose(){disposed++;}},async init(){throw null;}};await expect(initializeWorldGPU(renderer)).rejects.toThrow('WebGPU adapter initialization failed.');expect(disposed).toBe(1);});
test('unsupported browser fails before constructing a graphics backend',async()=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});try{await expect(createWorldGPU()).rejects.toThrow('This browser does not expose WebGPU.');}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}});
