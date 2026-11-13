/** Presentation-only lifecycle; no simulation state or renderer monkey-patching. */
export function createGlobalIllumination({renderer, scene, camera, mode, button,
  load = () => import('./ssgi-pipeline.js'), onChange = () => {}}) {
  let enabled = false, requested = false, disposed = false, pending = null, effect = null;
  let supported = mode === 'webgpu';
  let message = supported ? 'Screen-space indirect lighting. Extra GPU cost; off by default.' : 'Requires WebGPU. Direct lighting remains available.';
  function state() { return {enabled, supported, loading: !!pending, message}; }
  function update() {
    if (button) {
      button.disabled = !supported || !!pending || disposed;
      button.setAttribute('aria-pressed', String(enabled));
      button.dataset.state = pending ? 'LOADING' : !supported ? 'UNAVAILABLE' : enabled ? 'ON' : 'OFF';
      button.title = message;
      button.setAttribute('aria-description', message);
    }
    onChange(state());
  }
  function fail() {
    enabled = false; supported = false;
    message = 'Global illumination could not start. Direct lighting remains available.';
    effect?.dispose(); effect = null;
  }
  async function setEnabled(value) {
    if (disposed || !supported) return false;
    requested = !!value;
    if (!requested) { enabled = false; update(); return false; }
    if (!effect) {
      if (!pending) {
        pending = Promise.resolve().then(load).then(module => module.createSSGIPipeline({renderer, scene, camera}));
        update();
      }
      try {
        const created = await pending;
        if (disposed) { created.dispose(); return false; }
        effect = created;
      } catch { fail(); }
      finally { pending = null; }
    }
    enabled = requested && supported && !disposed && !!effect;
    update(); return enabled;
  }
  const click = () => { void setEnabled(!enabled); };
  button?.addEventListener('click', click);
  update();
  return {
    getState: state, setEnabled,
    render() {
      if (disposed) return;
      if (enabled && effect) {
        try { effect.render(); return; }
        catch { fail(); update(); }
      }
      renderer.render(scene, camera);
    },
    dispose() { if (disposed) return; disposed = true; enabled = false; button?.removeEventListener('click', click); effect?.dispose(); effect = null; update(); },
  };
}
