import {WebGPURenderer,ACESFilmicToneMapping} from 'three/webgpu';
/** Route-local strict backend: Three may otherwise silently select WebGL. */
export async function createConstitutionRenderer({canvas,antialias=true}={}){
 if(!globalThis.navigator?.gpu)throw new Error('This browser does not expose WebGPU');
 const renderer=new WebGPURenderer({canvas,antialias,forceWebGL:false});
 try{
  await renderer.init();
  if(!renderer.backend?.isWebGPUBackend)throw new Error('A WebGPU device could not be initialized');
  renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
  return{renderer,mode:'webgpu'};
 }catch(error){renderer.dispose();throw error;}
}
