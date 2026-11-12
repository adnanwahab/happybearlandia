// One asynchronous transfer at most, sampled independently of animation cadence.
export class GPUProfiler {
  constructor(renderer, {intervalMs = 250, clock = () => performance.now()} = {}) {
    this.renderer = renderer; this.clock = clock; this.intervalMs = intervalMs;
    this.supported = renderer.hasFeature('timestamp-query');
    this.enabled = this.supported; this.pending = false; this.disposed = false;
    this.ms = null; this.latest = null; this.lastRequest = -Infinity; this.generation = 0;
  }
  setEnabled(enabled) {
    this.enabled = !!enabled && this.supported && !this.disposed;
    // Disable query recording too: Three.js otherwise auto-resolves a full pool.
    if (this.renderer.backend) this.renderer.backend.trackTimestamp = this.enabled;
    this.generation++; this.ms = null; this.latest = null;
  }
  sample(now = this.clock(), frame = null) {
    if (!this.enabled || this.pending || now - this.lastRequest < this.intervalMs) return;
    this.pending = true; this.lastRequest = now;
    const generation = this.generation;
    // Start in a microtask so synchronous backend errors also release the slot.
    Promise.resolve().then(() => {
      if (generation !== this.generation) return null;
      return this.renderer.resolveTimestampsAsync('render');
    }).then(ms => {
      if (generation !== this.generation || this.disposed) return;
      this.ms = Number.isFinite(ms) && ms > 0 ? ms : null;
      this.latest = this.ms === null ? null : {ms:this.ms, requestedAt:now, completedAt:this.clock(), requestFrame:frame};
    }).catch(() => {
      if (generation !== this.generation) return;
      this.enabled = false; this.ms = null; this.latest = null;
    }).finally(() => { this.pending = false; });
  }
  getSnapshot(now = this.clock()) {
    const latest = this.latest;
    return {enabled:this.enabled,supported:this.supported,pending:this.pending,intervalMs:this.intervalMs,
      latest:latest ? {...latest,ageMs:Math.max(0,now-latest.requestedAt)} : null};
  }
  dispose() { this.setEnabled(false); this.disposed = true; }
}
