/** One renderer for the existing City scene; no simulation or scene ownership. */
export async function createRendererBackend({
  THREE, preferWebGPU = true, forceWebGL = false,
  loadWebGPU = () => import('three/webgpu'), timeoutMs = 6000,
} = {}) {
  if (typeof THREE?.WebGLRenderer !== 'function') throw new TypeError('THREE.WebGLRenderer required');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new RangeError('Renderer timeout must be 1–60000 milliseconds');
  const fallback = reason => ({renderer: new THREE.WebGLRenderer({antialias: true, alpha: false}), backend: 'webgl', reason});
  if (forceWebGL) return fallback('WebGL explicitly selected');
  if (!preferWebGPU) return fallback('WebGPU preference disabled');
  if (!globalThis.navigator?.gpu) return fallback('WebGPU API unavailable');

  let candidate = null, abandoned = false, settled = false, timer;
  // Cleanup cannot hold fallback hostage. Three r186 skips backend disposal
  // before successful init, so failed partial initialization needs it explicitly.
  function release() {
    if (!candidate) return;
    if (candidate._initialized === false) {
      // Renderer.dispose() also calls setAnimationLoop(), which retries init()
      // without awaiting it in r186. Do not resurrect failed/pending init.
      try { Promise.resolve(candidate.backend?.dispose?.()).catch(() => {}); } catch {}
    } else {
      try { Promise.resolve(candidate.dispose()).catch(() => {}); } catch {}
    }
  }
  const attempt = (async () => {
    try {
      const module = await loadWebGPU();
      if (abandoned) throw new Error('WebGPU load completed after deadline');
      if (typeof module?.WebGPURenderer !== 'function') throw new Error('WebGPURenderer export unavailable');
      candidate = new module.WebGPURenderer({antialias: true, alpha: false});
      await candidate.init();
      if (candidate.backend?.isWebGPUBackend !== true) throw new Error('WebGPU renderer selected a non-WebGPU backend');
      return candidate;
    } finally { settled = true; }
  })();
  try {
    const renderer = await Promise.race([
      attempt,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`WebGPU initialization exceeded ${timeoutMs}ms`)), timeoutMs); }),
    ]);
    return {renderer, backend: 'webgpu', reason: null};
  } catch (error) {
    abandoned = true;
    release();
    // init() cannot be canceled and may acquire resources after first cleanup.
    // Release again when it eventually settles, on success OR failure.
    if (!settled) attempt.then(release, release);
    return fallback(error instanceof Error ? error.message : 'WebGPU initialization failed');
  } finally { clearTimeout(timer); }
}
