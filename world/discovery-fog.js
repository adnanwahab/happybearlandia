/** Cosmetic page-session state; IDs belong to this loaded World only. */
export function createDiscoveryState(ids = []) {
  const supported = new Set(ids.map(String)), inspected = new Set();
  let enabled = false;
  return {
    enable(value) { enabled = value === true; },
    inspect(id) { id = String(id); if (!supported.has(id)) return false; inspected.add(id); return true; },
    masked(id) { return enabled && supported.has(String(id)) && !inspected.has(String(id)); },
    reset() { inspected.clear(); },
  };
}

export function buildingEvidence(buildings = [], source) {
  // Do not infer observed geometry, capacity, occupancy or resident behavior.
  return buildings.filter(b => b?.id != null).map(b => ({
    id: String(b.id), name: String(b.name ?? b.id),
    text: `${b.kind ?? 'Kind unavailable'} · ${Number.isFinite(b.area) ? `${Math.round(b.area)} m²` : 'Area unavailable'} · World source: ${source ?? 'unavailable'}. Building properties may be synthetic; consult the viewer’s source details for geometry provenance.`,
  }));
}

export function mountDiscoveryFog({container, buildings, source, onInspect}) {
  const doc = container.ownerDocument, win = doc.defaultView;
  const rows = buildingEvidence(buildings, source), state = createDiscoveryState(rows.map(r => r.id));
  const root = doc.createElement('details'); root.id = 'discoveryFog';
  const make = (tag, text, parent = root) => { const el = doc.createElement(tag); el.textContent = text; parent.append(el); return el; };
  make('summary', 'Building evidence · optional discovery fog');
  make('p', 'Local visual exploration only. All evidence remains available in the flat list. Reload starts fresh.');
  const label = make('label', ''), toggle = make('input', '', label); toggle.type = 'checkbox';
  label.append(doc.createTextNode(' Enable discovery fog'));
  const reset = make('button', 'Reset inspected places'); reset.type = 'button';
  const status = make('p', rows.length ? 'Choose a building to inspect its existing evidence.' : 'No supported building evidence is loaded.'); status.setAttribute('role', 'status');
  toggle.disabled = reset.disabled = rows.length === 0;
  const cards = make('div', ''); cards.className = 'discovery-cards';
  const flat = make('details', ''); make('summary', 'Flat list · all building evidence', flat);
  const list = make('ul', '', flat), entries = new Map(), cleanups = [];
  let disposed = false, frame = null, epoch = 0;
  const metrics = {updates: 0, lastUpdateMs: null, lastFrameGapMs: null, pendingFrame: false};
  const listen = (el, name, fn) => { el.addEventListener(name, fn); cleanups.push(() => el.removeEventListener(name, fn)); };
  function paint() {
    if (disposed) return;
    const start = win.performance.now();
    for (const [id, {card, note}] of entries) {
      const masked = state.masked(id); card.dataset.masked = String(masked);
      note.textContent = masked ? 'Not inspected in this session' : 'Evidence available';
    }
    metrics.updates++; metrics.lastUpdateMs = win.performance.now() - start;
    // Two repaint samples per interaction, never a persistent animation loop.
    if (frame !== null) win.cancelAnimationFrame(frame);
    metrics.pendingFrame = true;
    frame = win.requestAnimationFrame(first => { frame = win.requestAnimationFrame(second => {
      metrics.lastFrameGapMs = second - first; metrics.pendingFrame = false; frame = null;
    }); });
  }
  async function inspect(id) {
    if (disposed) return;
    const request = ++epoch;
    try {
      if (!onInspect || await onInspect(id) === false) throw Error('Building inspection is unavailable.');
      if (disposed || request !== epoch) return;
      state.inspect(id); paint(); status.textContent = 'Opened existing building evidence. No model discovery was created.';
    } catch {
      if (!disposed && request === epoch) status.textContent = 'Could not inspect this building. Evidence remains available in the flat list; try again.';
    }
  }
  for (const row of rows) {
    const card = make('article', '', cards); make('h3', row.name, card);
    const text = make('p', row.text, card); text.className = 'discovery-content';
    const note = make('p', '', card), button = make('button', `Inspect ${row.name}`, card); button.type = 'button';
    listen(button, 'click', () => inspect(row.id)); entries.set(row.id, {card, note});
    const item = make('li', '', list); make('p', `${row.name}: ${row.text}`, item);
    const open = make('button', `Open evidence for ${row.name}`, item); open.type = 'button'; listen(open, 'click', () => inspect(row.id));
  }
  listen(toggle, 'change', () => { state.enable(toggle.checked); paint(); });
  listen(reset, 'click', () => { epoch++; state.reset(); paint(); status.textContent = 'Local inspection marks reset. Model data is unchanged.'; });
  container.append(root); paint();
  return {
    observe(id) { if (!disposed && state.inspect(id)) paint(); },
    getMetrics: () => ({...metrics}),
    dispose() { disposed = true; epoch++; cleanups.forEach(fn => fn()); if(frame !== null) win.cancelAnimationFrame(frame); frame = null; metrics.pendingFrame = false; root.remove(); },
  };
}
