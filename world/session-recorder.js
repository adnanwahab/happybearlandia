import { createSessionRecorder, hasSessionConsent, readSessions } from './session-log.js';

/** Optional browser-local diagnostic capture. No network transport. */
export function mountSessionRecorder(win = window, getState = () => win.hblSessionLogState?.() ?? {}) {
  let storage;
  try { storage = win.localStorage; } catch { return { dispose() {} }; }
  readSessions(storage);
  const recorder = createSessionRecorder({ storage });
  let enabled = hasSessionConsent(storage);
  let frame = null, previous = null, sampleAt = 0, frames = 0, total = 0, maximum = 0;
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const click = event => {
    if (!enabled) return;
    const element = event.target?.closest?.('button,a,input,select,textarea,canvas');
    const tag = element?.tagName?.toLowerCase();
    recorder.record({ type: 'click', kind: tag === 'a' ? 'link' : ['input', 'select', 'textarea'].includes(tag) ? 'input' : ['button', 'canvas'].includes(tag) ? tag : 'other', x: event.clientX / win.innerWidth, y: event.clientY / win.innerHeight });
  };
  win.document.addEventListener('click', click, options);
  win.addEventListener('error', event => recorder.record({ type: 'error', kind: event.target === win ? 'javascript' : 'resource' }), { ...options, capture: true });
  win.addEventListener('unhandledrejection', () => recorder.record({ type: 'error', kind: 'rejection' }), options);
  function tick(at) {
    if (enabled && win.document.visibilityState !== 'hidden') {
      if (previous !== null) { const delta = at - previous; frames++; total += delta; maximum = Math.max(maximum, delta); }
      if (at - sampleAt >= 1000) {
        let state = {};
        try { state = getState() ?? {}; } catch { /* Runtime may still be loading. */ }
        recorder.record({ ...state, type: 'sample', fps: total ? frames * 1000 / total : null, maxFrameMs: maximum });
        sampleAt = at; frames = 0; total = 0; maximum = 0;
      }
      previous = at;
    } else { previous = null; frames = 0; total = 0; maximum = 0; }
    frame = enabled ? win.requestAnimationFrame(tick) : null;
  }
  const flush = () => recorder.flush();
  win.document.addEventListener('visibilitychange', () => { if (win.document.hidden) flush(); }, options);
  win.addEventListener('pagehide', flush, options);
  // A privacy change in another tab stops this tab before its next event/write.
  win.addEventListener('storage', () => {
    const before = enabled; enabled = hasSessionConsent(storage);
    if (!enabled) { win.cancelAnimationFrame(frame); frame = null; previous = null; }
    else if (!before) frame = win.requestAnimationFrame(tick);
  }, options);
  if (enabled) frame = win.requestAnimationFrame(tick);
  return { flush, dispose() { recorder.flush(); controller.abort(); win.cancelAnimationFrame(frame); } };
}

if (typeof window !== 'undefined') window.hblSessionRecorder = mountSessionRecorder();
