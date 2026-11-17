import {MEDIA_BUDGETS} from '../../shared/media/pipeline.js';

// Cosmetic heuristics, never measured traffic or modeled environmental noise.
export function ambientScene({target, height, buildings = [], minute} = {}) {
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z) || !Number.isFinite(minute)) return null;
  let park = false, nearby = 0;
  for (const b of buildings) {
    if (!Array.isArray(b.center)) continue;
    const distance = Math.hypot(b.center[0] - target.x, b.center[1] - target.z);
    if (distance < 65 && b.kind === 'park') park = true;
    if (distance < 100 && b.kind !== 'park') nearby++;
  }
  const environment = height > 100 ? 'skyline' : park ? 'park' : nearby >= 4 ? 'avenue' : 'skyline';
  const hour = ((minute % 1440) + 1440) % 1440 / 60;
  return {environment, night: hour < 6 || hour >= 20, pan: Math.max(-.6, Math.min(.6, target.x / 500))};
}

export const LOOP_BYTES = 3 * 2 * 22050 * 4;
if (LOOP_BYTES > MEDIA_BUDGETS.audio) throw Error('Ambient buffer budget exceeded');

export function createAmbientMixer({createContext = () => new AudioContext()} = {}) {
  let context, voices = [], disposed = false, enabled = false, volume = 0, scene = null, hidden = false, revision = 0;
  function apply() {
    if (!context || disposed) return;
    const audible = enabled && !hidden && scene && volume > 0;
    for (const voice of voices) {
      const gain = audible && voice.name === scene.environment ? volume * (scene.night ? .22 : .38) * (Number.isFinite(scene.strength) ? Math.max(0, Math.min(1, scene.strength)) : 1) : 0;
      const param = voice.gain.gain, now = context.currentTime;
      // Exponential retargeting is continuous even during rapid camera/time changes.
      param.cancelScheduledValues(now);
      param.setTargetAtTime(gain, now, .25);
      voice.pan.pan.setTargetAtTime(scene?.pan || 0, now, .25);
    }
  }
  function initialize() {
    context = createContext();
    let seed = 516; // Local cosmetic generator; never consumes simulation randomness.
    for (const [index, name] of ['skyline', 'park', 'avenue'].entries()) {
      const buffer = context.createBuffer(1, 44100, 22050), samples = buffer.getChannelData(0);
      let low = 0;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        low = .94 * low + .06 * (seed / 2147483648 - 1);
        const t = i / 22050, envelope = Math.sin(Math.PI * i / (samples.length - 1)) ** 2;
        samples[i] = envelope * (name === 'park' ? .08 * Math.sin(2 * Math.PI * 880 * t) * Math.sin(2 * Math.PI * 3 * t) ** 12 + low * .3 : low * (index + 1));
      }
      const source = context.createBufferSource(), gain = context.createGain(), pan = context.createStereoPanner();
      source.buffer = buffer; source.loop = true; gain.gain.value = 0;
      source.connect(gain); gain.connect(pan); pan.connect(context.destination);
      voices.push({name, source, gain, pan}); source.start();
    }
  }
  return {
    async enable(value) {
      if (disposed) return false;
      enabled = Boolean(value); const current = ++revision;
      try {
        if (enabled && !context) initialize();
        if (enabled) await context.resume();
        if (disposed || current !== revision) return false;
        apply(); return enabled;
      } catch {
        this.dispose(); return false;
      }
    },
    update(value) {scene = value; apply();},
    volume(value) {volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; apply();},
    hidden(value) {hidden = Boolean(value); apply(); if (hidden) void context?.suspend().catch(()=>{}); else if(enabled) void context?.resume().catch(()=>{});},
    dispose() {
      if (disposed) return;
      disposed = true; enabled = false; revision++;
      for (const {source, gain, pan} of voices) {source.stop(); source.disconnect(); gain.disconnect(); pan.disconnect(); source.buffer = null;}
      voices = []; if(context) void context.close().catch(()=>{});
    },
  };
}
