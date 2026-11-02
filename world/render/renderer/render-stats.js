export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}
export function summarize(samples) {
  const frames = samples.map(s => s.frameMs), gpu = samples.map(s => s.gpuMs).filter(Number.isFinite);
  const avg = a => a.length ? a.reduce((x,y) => x+y, 0) / a.length : null;
  const slowest = [...frames].sort((a,b) => b-a).slice(0, Math.max(1, Math.ceil(frames.length * .01)));
  return { frames: frames.length, medianFrameMs: percentile(frames,.5), p95FrameMs: percentile(frames,.95),
    p99FrameMs: percentile(frames,.99), cpuMedianMs: percentile(samples.map(s=>s.cpuMs),.5),
    averageDrawCalls: avg(samples.map(s=>s.drawCalls).filter(Number.isFinite)),
    averageTriangles: avg(samples.map(s=>s.triangles).filter(Number.isFinite)),
    averageVisibleObjects: avg(samples.map(s=>s.visibleObjects).filter(Number.isFinite)),
    peakTextures: Math.max(0,...samples.map(s=>s.textures).filter(Number.isFinite)),
    averageGpuMs: avg(gpu), gpuP95Ms: percentile(gpu,.95), fps: frames.length ? 1000 / avg(frames) : null,
    onePercentLowFps: slowest.length ? 1000 / avg(slowest) : null,
    slowFrames: frames.filter(ms=>ms > 16.67).length,
    droppedFrames: frames.reduce((n,ms)=>n+Math.max(0,Math.round(ms / (1000/60))-1),0) };
}
export class RenderStats {
  constructor() { this.samples = []; this.recording = null; this.lastReport = null; }
  start(now, metadata = {}, durationMs = 30000) { this.recording = { start: now, durationMs, metadata, samples: [] }; }
  push(sample, now) {
    this.samples.push(sample); if(this.samples.length > 600) this.samples.shift();
    if (this.recording) {
      this.recording.samples.push(sample);
      if(now - this.recording.start >= this.recording.durationMs) {
        this.lastReport = { ...this.recording.metadata, durationMs: now - this.recording.start,
          ...summarize(this.recording.samples), lastFrame: sample };
        this.recording = null;
      }
    }
  }
  get current() { return { ...summarize(this.samples), ...this.samples.at(-1) }; }
}
