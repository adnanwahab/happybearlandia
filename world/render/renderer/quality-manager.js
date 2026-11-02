export const PRESETS = Object.freeze({
  LOW: { dpr: 1, shadowSize: 512, distance: 650, density: .35 },
  BALANCED: { dpr: 1.5, shadowSize: 1024, distance: 1100, density: .65 },
  HIGH: { dpr: 1.75, shadowSize: 2048, distance: 1600, density: .85 },
  ULTRA: { dpr: 2, shadowSize: 2048, distance: 2200, density: 1 },
});
export class QualityManager {
  constructor(preset = 'BALANCED') { this.setPreset(preset); }
  setPreset(name) {
    if (!PRESETS[name]) throw new RangeError(`Unknown quality preset: ${name}`);
    this.preset = name; this.level = 0; this.slow = 0; this.fast = 0;
  }
  get settings() {
    const p = PRESETS[this.preset];
    return { ...p, scale: Math.max(.65, 1 - this.level * .07),
      shadows: this.level < 4, shadowSize: Math.max(512, p.shadowSize >> Math.min(2, Math.floor(this.level / 2))),
      density: p.density * (1 - this.level * .1) };
  }
  sample(frameMs, gpuMs, cpuMs) {
    if (![frameMs, cpuMs].every(Number.isFinite) || frameMs > 250) return false;
    const slow = frameMs > 18 || (gpuMs != null && gpuMs > 10) || cpuMs > 6;
    const fast = frameMs < 17.2 && (gpuMs == null || gpuMs < 8) && cpuMs < 5;
    this.slow = slow ? this.slow + 1 : 0;
    this.fast = fast ? this.fast + 1 : 0;
    if (this.slow >= 60 && this.level < 5) { this.level++; this.slow = this.fast = 0; return true; }
    if (this.fast >= 600 && this.level > 0) { this.level--; this.slow = this.fast = 0; return true; }
    return false;
  }
}
