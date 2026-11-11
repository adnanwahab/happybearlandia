/** Viewport flights only: never change stored simulations or native 3D controls. */
export const TRANSITION_VERSION = 'decision-view-flight.v1';
function copy(value) {
  const result = structuredClone(value);
  const freeze = item => { if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); } return item; };
  return freeze(result);
}
function key(s) {
  if (!s || !['experimentId','runId','scenarioId','modelVersion'].every(k => typeof s[k] === 'string' && s[k])) throw new TypeError('Exact stored experiment/run/scenario/model identity required.');
  if (!Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff || !Number.isFinite(s.month) || s.month < 0) throw new TypeError('Exact uint32 seed and nonnegative month required.');
  return JSON.stringify([s.experimentId,s.runId,s.scenarioId,s.modelVersion,s.seed,s.month,s.comparison ?? null]);
}
/** getSelection supplies native metadata including synchronized comparison state. */
export function attachFutureTransitions({ multiverse, city, getSelection, duration = 850, environment = globalThis.window } = {}) {
  if (!multiverse || !city || typeof getSelection !== 'function' || !environment) throw new TypeError('Both views, selection reader and browser required.');
  if (!Number.isFinite(duration) || duration < 0 || duration > 3000) throw new RangeError('Duration must be 0–3000ms.');
  const env = environment, motion = env.matchMedia?.('(prefers-reduced-motion: reduce)');
  let active = null, disposed = false;
  const current = f => { try { return key(getSelection()) === f.key; } catch { return false; } };
  function settle(f,status,reason) {
    if (active !== f) return;
    active = null;
    if (f.frame != null) env.cancelAnimationFrame(f.frame);
    f.effect?.cancel();
    f.resolve({status,reason,view:f.view,selection:f.selection,version:TRANSITION_VERSION});
  }
  function cancel(reason = 'cancelled') { if (active) settle(active,'cancelled',reason); }
  function finish(f) {
    if (!current(f)) return settle(f,'cancelled','selection-changed');
    env.scrollTo({top:f.end,left:f.left,behavior:'instant'});
    settle(f,'completed',motion?.matches ? 'reduced-motion' : 'arrived');
  }
  function flyTo(view,{source} = {}) {
    if (disposed) throw new Error('Adapter detached.');
    if (!['city','multiverse'].includes(view)) throw new TypeError('Unknown future view.');
    const selection = copy(getSelection()), selectionKey = key(selection);
    cancel('superseded');
    const target = view === 'city' ? city : multiverse;
    if (target.isConnected === false) return Promise.resolve({status:'cancelled',reason:'view-detached',view,selection,version:TRANSITION_VERSION});
    const rect = target.getBoundingClientRect();
    const max = Math.max(0,(env.document.scrollingElement?.scrollHeight ?? env.document.documentElement.scrollHeight)-env.innerHeight);
    const start = env.scrollY, left = env.scrollX, end = Math.max(0,Math.min(max,start+rect.top-16));
    return new Promise(resolve => {
      const f = {view,selection,key:selectionKey,start,end,left,resolve,frame:null,effect:null,began:null};
      active = f;
      if (!current(f)) return settle(f,'cancelled','selection-changed');
      if (motion?.matches || duration === 0) return finish(f);
      // Screen-space reveal: no invented plot-to-geographic-camera mapping.
      const origin = source?.getBoundingClientRect?.();
      if (target.animate) {
        const x = origin ? Math.max(0,Math.min(rect.width,origin.left+origin.width/2-rect.left)) : rect.width/2;
        try { f.effect = target.animate([
          {transform:`scale(${view === 'city' ? .94 : 1.04})`,transformOrigin:`${x}px 0px`,opacity:.65},
          {transform:'scale(1)',transformOrigin:`${x}px 0px`,opacity:1},
        ],{duration,easing:'cubic-bezier(.22,.61,.36,1)'}); } catch { /* Scroll remains usable without visual effects. */ }
      }
      const tick = now => {
        if (active !== f) return;
        if (!current(f)) return settle(f,'cancelled','selection-changed');
        if (target.isConnected === false) return settle(f,'cancelled','view-detached');
        f.began ??= now;
        const p = Math.max(0,Math.min(1,(now-f.began)/duration));
        if (p === 1) return finish(f);
        env.scrollTo({top:start+(end-start)*p*p*(3-2*p),left,behavior:'instant'});
        f.frame = env.requestAnimationFrame(tick);
      };
      f.frame = env.requestAnimationFrame(tick);
    });
  }
  const manual = () => cancel('manual-control');
  const keys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End',' ','Escape','Tab']);
  const keydown = event => { if (keys.has(event.key)) manual(); };
  const changedMotion = () => { if (motion.matches && active) finish(active); };
  for (const type of ['wheel','pointerdown','touchstart','resize']) env.addEventListener(type,manual,{passive:true,capture:true});
  env.addEventListener('keydown',keydown,true);
  motion?.addEventListener?.('change',changedMotion);
  return {flyTo,cancel,
    detach() {
      if (disposed) return;
      cancel('detached'); disposed = true;
      for (const type of ['wheel','pointerdown','touchstart','resize']) env.removeEventListener(type,manual,true);
      env.removeEventListener('keydown',keydown,true);
      motion?.removeEventListener?.('change',changedMotion);
    },
    get running() { return active !== null; },
  };
}
