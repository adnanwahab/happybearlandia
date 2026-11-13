// These demos deliberately require WebGPU; never substitute a WebGL backend.
export function showWebGPUError(error) {
  let notice = document.getElementById('webgpu-error');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'webgpu-error';
    notice.setAttribute('role', 'alert');
    Object.assign(notice.style, { position: 'fixed', zIndex: '10000', left: '16px', right: '16px', bottom: '16px', padding: '18px', borderRadius: '10px', background: '#172333', color: '#fff', font: '16px/1.5 system-ui' });
    document.body.append(notice);
  }
  notice.textContent = `This 3D demo requires WebGPU. Use a WebGPU-enabled browser with hardware acceleration over HTTPS or localhost, then reload. ${error?.message || ''}`;
}

export async function createWebGPUDemoRenderer(THREE, options = {}) {
  if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser.');
  const renderer = new THREE.WebGPURenderer(options);
  // Three.js installs its WebGL fallback internally; disable it before init.
  renderer._getFallback = null;
  try {
    await renderer.init();
    if (!renderer.backend.isWebGPUBackend) throw new Error('A WebGPU device could not be initialized.');
    return renderer;
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

export function manageWebGPUDemo(renderer, scene, controls) {
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    // Cleanup must not prevent the user-visible loss notice or reject device.lost.
    const failures = [];
    const attempt = action => { try { action(); } catch (error) { failures.push(error); } };
    attempt(() => renderer.setAnimationLoop(null));
    attempt(() => controls?.dispose());
    const geometries = new Set(), materials = new Set(), textures = new Set();
    attempt(() => scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [object.material].flat().filter(Boolean)) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    }));
    for (const resource of [...geometries, ...materials, ...textures]) attempt(() => resource.dispose());
    attempt(() => renderer.dispose());
    if (failures.length) showWebGPUError(new Error('Graphics cleanup failed. Reload to restart this demo.'));
  };
  window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
  const fail = error => {
    if (disposed) return;
    dispose();
    showWebGPUError(error);
  };
  renderer.backend.device?.lost.then(
    info => fail(new Error(info.message || 'The GPU device was lost. Reload to reconnect.')),
    error => fail(new Error(`GPU connection failed. Reload to reconnect. ${error?.message || ''}`)),
  );
  return dispose;
}
