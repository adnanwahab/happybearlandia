import {createCanvasStage} from '../scene/canvas-stage.js';
import {createSpatialMapping} from '../scene/mapping.js';
import {assertMonth, METRIC_UNITS} from '../contracts.js';

/** Snapshot-facing adapter for the shared Canvas presenter. No simulation clock. */
export function createCanvas2DStage(container, {onSelect} = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Canvas2D City comparison');
  const status = doc.createElement('p'), view = doc.createElement('div');
  status.setAttribute('role', 'status');
  status.textContent = 'Canvas2D · monthly City · snapshots unavailable';
  view.style.cssText = 'height:clamp(280px,32vw,400px);min-height:280px';
  root.append(status, view);
  container.append(root);
  let canvas;
  try { canvas = createCanvasStage(view, {onSelect}); }
  catch (error) { root.remove(); throw error; }
  const mapping = createSpatialMapping();
  let disposed = false;
  return {
    update(frame, diff) {
      if (disposed) return;
      if (!frame) {
        canvas.update(null, null);
        status.textContent = 'Canvas2D · monthly City · snapshots unavailable';
        return;
      }
      assertMonth(frame.month);
      for (const arm of ['baseline', 'plan']) {
        const snapshot = frame[arm];
        if (snapshot && (snapshot.month !== frame.month || snapshot.state?.month !== frame.month)) {
          throw new TypeError('Snapshot month mismatch');
        }
      }
      // An absent arm is not an empty city and must not produce removal ghosts.
      const projection = frame.baseline?.state && frame.plan?.state
        ? mapping.frame(frame.baseline.state, frame.plan.state) : null;
      canvas.update(projection, projection ? diff : null);
      const summaries = ['baseline', 'plan'].map(arm => {
        const snapshot = frame[arm];
        if (!snapshot?.state) return `${arm}: snapshot unavailable`;
        const metrics = Object.entries(METRIC_UNITS).map(([key, unit]) => {
          const value = snapshot.metrics?.[key];
          return `${key}: ${Number.isFinite(value) ? value : 'unavailable'} ${unit}`;
        });
        return `${arm}: ${metrics.join('; ')}`;
      });
      status.textContent = `Canvas2D · monthly City · Month ${frame.month} · ${projection?.label || 'Map unavailable: paired snapshots required'} · ${summaries.join(' | ')}`;
    },
    setMode: value => canvas.setMode(value),
    setGhosts: value => canvas.setGhosts(value),
    focus: entity => canvas.focus(entity),
    getStats: () => ({...canvas.getStats(), layoutVersion: mapping.version}),
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.dispose();
      root.remove();
    },
  };
}
