import { WebGPURenderer, ACESFilmicToneMapping } from 'three/webgpu';
export async function createCityRenderer({ forceWebGL = false, antialias = true } = {}) {
  let renderer = new WebGPURenderer({ antialias, forceWebGL, trackTimestamp: true });
  try { await renderer.init(); }
  catch (error) {
    renderer.dispose();
    if (forceWebGL) throw error;
    renderer = new WebGPURenderer({ antialias, forceWebGL: true, trackTimestamp: true });
    await renderer.init();
  }
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = .85;
  return { renderer, mode: renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2' };
}
