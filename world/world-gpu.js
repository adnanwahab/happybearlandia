import {installPresentationHost} from './city-xray/render-host.js';
import { WebGPURenderer, ACESFilmicToneMapping } from 'three/webgpu';

/** One native backend, shared by every World mode. */
export async function createWorldGPU({antialias=true,canvas}={}){
  if(!globalThis.navigator?.gpu)throw new Error('This browser does not expose WebGPU.');
  // Reuse the entrypoint's native preflight; retain its reference for pagehide cleanup.
  const prepared=globalThis.window?.hblPreparedWorldGraphics;
  if(prepared?.renderer.backend?.isWebGPUBackend&&!prepared.claimed){prepared.claimed=true;return prepared;}
  const graphics=await initializeWorldGPU(new WebGPURenderer({antialias,trackTimestamp:true,...(canvas?{canvas}:{})}));
  if(globalThis.document?.getElementById('city-xray-toggle'))installPresentationHost(graphics.renderer,{announce:(type,host)=>window.dispatchEvent(new CustomEvent('hbl:world-presentation',{detail:{type,host}}))});
  return graphics;
}

/** Kept separate so adapter rejection and partial-device cleanup are testable. */
export async function initializeWorldGPU(renderer){
  try{
    // Disable Three's implicit WebGL backend: failure must stay visible.
    renderer._getFallback=null;
    await renderer.init();
    if(!renderer.backend.isWebGPUBackend)throw new Error('A WebGPU adapter could not be initialized.');
    renderer.toneMapping=ACESFilmicToneMapping;
    renderer.toneMappingExposure=.85;
    return{renderer,mode:'webgpu'};
  }catch(error){
    // Three r186 dispose() can retry init through setAnimationLoop before init
    // succeeds. Release a partially initialized backend directly instead.
    try{
      const cleanup=renderer._initialized===false?renderer.backend?.dispose?.():renderer.dispose();
      Promise.resolve(cleanup).catch(()=>{});
    }catch{}
    throw error instanceof Error ? error : new Error(typeof error==='string'?error:'WebGPU adapter initialization failed.',{cause:error});
  }
}
