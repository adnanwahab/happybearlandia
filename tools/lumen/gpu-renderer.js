/** Create only a native WebGPU renderer; Three's WebGL fallback is forbidden. */
export async function createWebGPURenderer(THREE, canvas, gpu = globalThis.navigator?.gpu) {
  if (!gpu) throw new Error('This browser does not expose WebGPU.');
  const renderer = new THREE.WebGPURenderer({
    canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance', logarithmicDepthBuffer: true,
  });
  // Three caches its fallback callback during construction. Clear the cached
  // callback before init so an adapter/device failure cannot create WebGL.
  renderer._getFallback = null;
  try {
    await renderer.init();
    if (!renderer.backend.isWebGPUBackend) throw new Error('The active backend is not WebGPU.');
    return renderer;
  } catch (error) {
    // Initialization can fail before Three's dispose infrastructure is ready.
    if (renderer.backend.device) renderer.dispose();
    throw error;
  }
}
