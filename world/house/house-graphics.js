/** All house scene objects share the WebGPU build's core types and material conversion. */
export async function createHouseGraphics(THREE,{canvas,pixelRatio=1,color='#d4d4bd'}={}){
 const renderer=new THREE.WebGPURenderer({...(canvas?{canvas}:{}),antialias:true,alpha:false,powerPreference:'high-performance',forceWebGL:false});
 try{await renderer.init();if(!renderer.backend?.isWebGPUBackend)throw new Error('WebGPU is unavailable. Enable WebGPU in a supported browser and reload.');renderer.setPixelRatio(Math.min(1,pixelRatio));renderer.setClearColor(color);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.domElement.dataset.houseGraphicsBackend=houseGraphicsBackend(renderer);return renderer;}catch(error){try{renderer.dispose();}catch{}throw error;}
}
export function houseGraphicsBackend(renderer){return renderer?.backend?.isWebGPUBackend?'webgpu':renderer?.backend?.isWebGLBackend?'webgl2':renderer?'initializing':'unavailable';}
