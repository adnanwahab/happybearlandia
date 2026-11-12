import {createCanvasStage} from '../scene/canvas-stage.js';
import {createSpatialMapping} from '../scene/mapping.js';
import {METRIC_UNITS} from '../contracts.js';
import {assertFrameIntegrity} from '../integrity.js';

/** Snapshot-facing adapter; City remains the sole simulation authority. */
export function createCanvas2DStage(container, {onSelect} = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.setAttribute('aria-label', 'Canvas2D monthly City comparison');
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  const view = doc.createElement('div');
  view.style.cssText = 'height:clamp(280px,40vw,400px);min-width:0';
  const inventory = doc.createElement('div');
  root.append(status, view, inventory);
  container.append(root);
  const mapping = createSpatialMapping();
  let canvas = null, failure = null, disposed = false, frame = null, currentDiff = null, mode = 'split';
  try { canvas = createCanvasStage(view, {onSelect}); }
  catch (error) { failure = error.message; view.hidden = true; }
  function recover(error) {
    failure = error instanceof Error ? error.message : String(error);
    try { canvas?.dispose(); } finally { canvas = null; view.hidden = true; }
  }
  function draw(action) {
    try { action(); } catch (error) { recover(error); }
  }
  function describe() {
    inventory.replaceChildren();
    const missing = !frame?.baseline?.state || !frame?.plan?.state;
    status.textContent = `${canvas ? 'Canvas2D · low fidelity' : 'Graphics unavailable · accessible inventory'} · monthly City model · Month ${frame?.month ?? 'unavailable'} · Synthetic layout, not real geography.${missing ? ' Matched snapshots unavailable.' : ''}`;
    for (const arm of ['baseline', 'plan']) {
      if (mode === 'baseline' && arm !== mode || mode === 'plan' && arm !== mode) continue;
      const section = doc.createElement('section');
      const heading = doc.createElement('h3'); heading.textContent = arm === 'baseline' ? 'Without plan' : 'With plan'; section.append(heading);
      const snapshot = frame?.[arm];
      const metrics = doc.createElement('p');
      metrics.textContent = snapshot?.metrics && Object.keys(snapshot.metrics).length ? [...new Set([...Object.keys(METRIC_UNITS),...Object.keys(snapshot.metrics)])].map(key => { const value=snapshot.metrics[key]; return `${key}: ${Number.isFinite(value) ? value : 'unavailable'}${METRIC_UNITS[key] ? ' ' + METRIC_UNITS[key] : ''}`; }).join(' · ') : 'Metrics unavailable';
      section.append(metrics);
      for (const collection of ['buildings', 'projects']) {
        if (!Array.isArray(snapshot?.state?.[collection])) { const note = doc.createElement('p'); note.textContent = `${collection} unavailable`; section.append(note); continue; }
        for (const record of snapshot.state[collection]) {
          const button = doc.createElement('button'); button.type = 'button'; button.textContent = `${collection}: ${record.id}`;
          const change = currentDiff?.available === false ? null : currentDiff?.entities?.find(row => row.collection === collection && row.id === record.id);
          if (mode === 'difference' && !change) continue;
          if (change) { button.textContent += ` · ${change.kind}`; button.style.fontWeight = 'bold'; }
          button.onclick = () => { if (!disposed) onSelect?.({collection,id:record.id,arm}); }; section.append(button);
        }
      }
      const events = doc.createElement('p');
      events.textContent = Array.isArray(snapshot?.events) ? `Recorded events: ${JSON.stringify(snapshot.events)}` : 'Recorded events unavailable';
      section.append(events); inventory.append(section);
    }
  }
  describe();
  return {
    update(next, diff) {
      if (disposed) return;
      frame = next; currentDiff = diff;
      let projection = null;
      draw(() => {
        if (next) assertFrameIntegrity(next);
        if (next?.baseline?.state && next?.plan?.state) projection = mapping.frame(next.baseline.state, next.plan.state);
        canvas?.update(projection, diff);
      });
      describe();
    },
    setMode(next) { if (!['split','baseline','plan','difference'].includes(next)) throw new TypeError('Unknown scene mode'); if (disposed) return; mode = next; draw(() => canvas?.setMode(next)); describe(); },
    setGhosts(value) { if (!disposed) { draw(() => canvas?.setGhosts(value)); describe(); } },
    focus(entity) { if (disposed) return false; let found = false; draw(() => { found = canvas?.focus(entity) ?? false; }); describe(); return found; },
    getCamera() { return canvas?.getCamera() ?? null; },
    getStats() { return {...canvas?.getStats(),backend:disposed ? 'disposed' : canvas ? 'canvas2d' : 'inventory-fallback',error:failure,month:frame?.month ?? null,layoutVersion:mapping.version}; },
    dispose() { if (disposed) return; disposed = true; canvas?.dispose(); frame = null; root.remove(); },
  };
}
