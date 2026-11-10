import { WebGPURenderer, ACESFilmicToneMapping } from 'three/webgpu';

/** Main World requires a real GPU backend; never substitutes WebGL. */
export async function createWorldGPU({ antialias = true } = {}) {
  let renderer;
  try {
    if (!navigator.gpu) throw new Error('This browser does not expose WebGPU.');
    renderer = new WebGPURenderer({ antialias, trackTimestamp: true });
    await renderer.init();
    if (!renderer.backend.isWebGPUBackend) throw new Error('A WebGPU adapter could not be initialized.');
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = .85;
    return { renderer, mode: 'webgpu' };
  } catch (error) {
    renderer?.dispose();
    const loading = document.getElementById('loading');
    if (loading) {
      loading.replaceChildren();
      loading.setAttribute('role', 'alert');
      const title = document.createElement('strong'); title.textContent = 'World needs WebGPU';
      const message = document.createElement('p'); message.textContent = 'Enable hardware acceleration and open this page in a browser with WebGPU support, then reload. A compatible GPU is required.';
      const retry = document.createElement('button'); retry.textContent = 'Try again'; retry.onclick = () => location.reload();
      const home = document.createElement('a'); home.href = '/'; home.textContent = ' Return home';
      loading.append(title, message, retry, home);
      Object.assign(loading.style, {zIndex:'200', maxWidth:'440px', padding:'28px', background:'var(--panel)', borderRadius:'16px'});
    }
    throw error;
  }
}
