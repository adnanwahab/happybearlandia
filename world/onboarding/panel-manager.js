/** One foreground panel. Visibility requests stay with the owning feature. */
export function createPanelState(onChange = () => {}) {
  let active = null;
  const known = new Set();
  return {
    register(id) { if (!id || known.has(id)) throw new Error(`Duplicate or missing panel: ${id}`); known.add(id); },
    open(id) { if (!known.has(id)) throw new Error(`Unknown panel: ${id}`); if (active === id) return false; const previous = active; active = id; onChange({ active, previous }); return true; },
    close(id = active) { if (id !== active || active === null) return false; const previous = active; active = null; onChange({ active, previous }); return true; },
    unregister(id) { this.close(id); known.delete(id); },
    getState() { return { active }; },
  };
}

/** Focus ownership is delegated to onPanelChange({active, previous, element, previousElement, trigger}).
 * Legacy features may continue changing hidden/style.display; sync adopts those requests.
 */
export function createPanelManager({ document: doc = globalThis.document, panels = {}, onChange = () => {}, onPanelChange = onChange, observe = true } = {}) {
  if (!doc) throw new Error('Panel manager needs a document.');
  const entries = new Map();
  let destroyed = false, trigger = null;
  const triggers = new Map();
  const state = createPanelState(({ active, previous }) => {
    for (const [id, entry] of entries) {
      const suppressed = id !== active;
      entry.element.toggleAttribute('data-world-panel-suppressed', suppressed);
      entry.element.inert = suppressed;
      for (const button of doc.querySelectorAll(`[data-world-open="${id}"]`)) button.setAttribute('aria-expanded', String(!suppressed));
    }
    doc.body?.setAttribute('data-world-active-panel', active || 'none');
    onPanelChange({ active, previous, element: entries.get(active)?.element || null, previousElement: entries.get(previous)?.element || null, trigger });
    if (active) {
      const panel = entries.get(active)?.element;
      if (panel && trigger && !panel.contains(trigger)) { triggers.set(active, trigger); panel.tabIndex = -1; panel.focus?.({ preventScroll: true }); }
    } else { const source = triggers.get(previous); if (source?.isConnected && !source.closest?.('[inert],[hidden]')) source.focus?.({ preventScroll: true }); triggers.delete(previous); }
    trigger = null;
  });
  const requested = element => !element.hidden && element.style.display !== 'none' && (element.tagName !== 'DETAILS' || element.open);
  function register(id, element, { onClose, dismiss = onClose, label = id, addClose = true, visibility } = {}) {
    if (destroyed) throw new Error('Panel manager is destroyed.');
    if (!element) throw new Error(`Missing element for panel: ${id}`);
    state.register(id);
    const entry = { element, dismiss, requested: requested(element), visibility: visibility || (element.hasAttribute('hidden') ? 'hidden' : 'display') };
    entries.set(id, entry);
    element.setAttribute('data-world-panel', id);
    if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) element.setAttribute('aria-label', label);
    if (!element.hasAttribute('role') && element.tagName !== 'DETAILS') element.setAttribute('role', 'region');
    element.toggleAttribute('data-world-panel-suppressed', true);
    element.inert = true;
    // A delegated close button survives legacy innerHTML replacement.
    entry.addClose = addClose;
    ensureClose(entry);
    if (entry.requested) open(id);
    return () => { state.unregister(id); entries.delete(id); element.removeAttribute('data-world-panel'); element.removeAttribute('data-world-panel-suppressed'); element.inert = false; element.querySelector('[data-world-dismiss]')?.remove(); };
  }
  function ensureClose(entry) {
    if (!entry.addClose || entry.element.querySelector('[data-world-dismiss]')) return;
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'world-sheet-close'; button.setAttribute('data-world-dismiss', ''); button.setAttribute('aria-label', 'Close panel'); button.textContent = 'Close';
    entry.element.prepend(button);
  }
  function open(id, { trigger: source } = {}) {
    const entry = entries.get(id);
    if (!entry) throw new Error(`Unknown panel: ${id}`);
    trigger = source || doc.activeElement;
    entry.element.hidden = false;
    if (entry.element.style.display === 'none') entry.element.style.display = 'block';
    if (entry.element.tagName === 'DETAILS') entry.element.open = true;
    entry.requested = true;
    return state.open(id);
  }
  function close(id = state.getState().active) {
    const entry = entries.get(id);
    if (!entry || state.getState().active !== id) return false;
    // First suppress synchronously so a feature callback cannot expose a second panel.
    state.close(id);
    entry.requested = false;
    if (entry.element.tagName === 'DETAILS') entry.element.open = false;
    else if (entry.visibility === 'hidden') entry.element.hidden = true;
    else entry.element.style.display = 'none';
    entry.dismiss?.();
    return true;
  }
  function sync() {
    if (destroyed) return;
    for (const [id, entry] of entries) {
      ensureClose(entry);
      const next = requested(entry.element);
      if (next && !entry.requested) { entry.requested = true; open(id); }
      else if (!next && entry.requested) { entry.requested = false; state.close(id); }
    }
  }
  function click(event) {
    const button = event.target.closest?.('[data-world-open], [data-world-dismiss]');
    if (!button) return;
    const id = button.getAttribute('data-world-open');
    if (id) { if (state.getState().active === id) close(id); else open(id, { trigger: button }); }
    else if (button.closest('[data-world-panel]')?.getAttribute('data-world-panel') === state.getState().active) close();
  }
  function keydown(event) { if (event.key === 'Escape' && !event.defaultPrevented && state.getState().active) { event.preventDefault(); close(); } }
  doc.addEventListener('click', click);
  doc.addEventListener('keydown', keydown);
  const Observer = doc.defaultView?.MutationObserver;
  const observer = observe && Observer ? new Observer(sync) : null;
  observer?.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'open'] });
  for (const [id, value] of Object.entries(panels)) register(id, value.element || value, value.options || {});
  function dispose() { if (destroyed) return; destroyed = true; observer?.disconnect(); doc.removeEventListener('click', click); doc.removeEventListener('keydown', keydown); state.close(); for (const { element } of entries.values()) { element.removeAttribute('data-world-panel-suppressed'); element.removeAttribute('data-world-panel'); element.inert = false; element.querySelector('[data-world-dismiss]')?.remove(); } entries.clear(); doc.body?.removeAttribute('data-world-active-panel'); }
  return { register, open, close, closeAll: () => close(), sync, getState: state.getState, getActive: () => state.getState().active, getActiveElement: () => entries.get(state.getState().active)?.element || null, dispose, destroy: dispose }; 
}
