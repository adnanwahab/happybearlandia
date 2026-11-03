export const PRESETS = Object.freeze({
  LOW: { dpr: 1, shadowSize: 512, distance: 650, density: .35 },
  BALANCED: { dpr: 1.5, shadowSize: 1024, distance: 1100, density: .65 },
  HIGH: { dpr: 1.75, shadowSize: 2048, distance: 1600, density: .85 },
  ULTRA: { dpr: 2, shadowSize: 2048, distance: 2200, density: 1 },
});
export class QualityManager {
  constructor(preset = 'BALANCED', {targetFPS=60}={}) { this.setTargetFPS(targetFPS); this.setPreset(preset); }
  setTargetFPS(value) { if(!Number.isInteger(value)||value<30||value>144)throw new RangeError('Frame target must be30–144 FPS');this.targetFPS=value;this.slow=this.fast=this.severe=0; }
  setPreset(name) {
    if (!PRESETS[name]) throw new RangeError(`Unknown quality preset: ${name}`);
    this.preset = name; this.level = 0; this.slow = 0; this.fast = 0; this.severe = 0;
  }
  get settings() {
    const p = PRESETS[this.preset];
    return { ...p, targetFPS:this.targetFPS, interiors:this.level<2, distance:p.distance*(1-this.level*.1), scale: Math.max(.65, 1 - this.level * .07),
      shadows: this.level < 4, shadowSize: Math.max(512, p.shadowSize >> Math.min(2, Math.floor(this.level / 2))),
      density: p.density * (1 - this.level * .1) };
  }
  sample(frameMs, gpuMs, cpuMs) {
    if (![frameMs, cpuMs].every(Number.isFinite) || frameMs<=0 || cpuMs<0) return false;
    const budget=1000/this.targetFPS;
    const slow = frameMs > budget*1.08 || (gpuMs != null && gpuMs > budget*.6) || cpuMs > budget*.36;
    const fast = frameMs < budget*1.032 && (gpuMs == null || gpuMs < budget*.48) && cpuMs < budget*.3;
    this.severe=frameMs>budget*4?this.severe+1:0;
    if(this.severe>=3&&this.level<5){this.level=Math.min(5,this.level+2);this.slow=this.fast=this.severe=0;return true;}
    this.slow = slow ? this.slow + 1 : 0;
    this.fast = fast ? this.fast + 1 : 0;
    if (this.slow >= 60 && this.level < 5) { this.level++; this.slow = this.fast = 0; return true; }
    if (this.fast >= 600 && this.level > 0) { this.level--; this.slow = this.fast = 0; return true; }
    return false;
  }
}
