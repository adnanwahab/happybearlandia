// Readback never blocks the animation loop. Unsupported timing stays null.
export class GPUProfiler {
  constructor(renderer) { this.renderer = renderer; this.ms = null; this.pending = false; this.enabled = renderer.hasFeature('timestamp-query'); }
  sample() {
    if (!this.enabled || this.pending) return;
    this.pending = true;
    this.renderer.resolveTimestampsAsync('render').then(ms => {
      this.ms = Number.isFinite(ms) && ms > 0 ? ms : null;
    }).catch(() => { this.enabled = false; this.ms = null; }).finally(() => { this.pending = false; });
  }
}
