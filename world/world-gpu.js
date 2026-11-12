import { WebGPURenderer, ACESFilmicToneMapping } from 'three/webgpu';

/** Probe the native backend; the World host owns supported fallback and notices. */
export async function createWorldGPU({ antialias = true } = {}) {
  let renderer;
  try {
    if (!navigator.gpu) throw new Error('This browser does not expose WebGPU.');
    renderer = new WebGPURenderer({ antialias, trackTimestamp: true });
    // Let the host select fallback so the adapter failure reason is retained.
    renderer._getFallback = null;
    await renderer.init();
    if (!renderer.backend.isWebGPUBackend) throw new Error('A WebGPU adapter could not be initialized.');
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = .85;
    return { renderer, mode: 'webgpu' };
  } catch (error) {
    // Three r186 dispose() retries init through setAnimationLoop before init
    // succeeds. Release the partial backend directly so rejection stays final.
    try {
      const cleanup = renderer?._initialized === false
        ? renderer.backend?.dispose?.() : renderer?.dispose();
      Promise.resolve(cleanup).catch(() => {});
    } catch {}
    throw error;
  }
}
