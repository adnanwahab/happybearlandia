/** Presentation only: retain feature-owned visibility, DOM, handlers and evidence. */
export const DOCK_KEY = 'hbl.world.tool-docks.v1';
export function readDockPreferences(storage) {
  try {
    const raw = JSON.parse(storage.getItem(DOCK_KEY));
    return Object.fromEntries(Object.entries(raw || {}).filter(([id, value]) =>
      PANEL_DEFINITIONS.some(row => row.id === id) && value &&
      typeof value.collapsed === 'boolean' && typeof value.floating === 'boolean' &&
      Number.isFinite(value.width) && value.width >= 260 && value.width <= 560));
  } catch { return {}; }
}
export const PANEL_DEFINITIONS = [
  {id:'controls', selector:'#top', label:'Timeline and controls'},
  {id:'build', selector:'.bw-world-tools', label:'Build'},
  {id:'why', selector:'#inspect', label:'WHY / inspector'},
  {id:'metrics', selector:'#experimentPanel', label:'Metrics'},
  {id:'cycle', selector:'#cyclePanel', label:'Comparison metrics'},
  {id:'history', selector:'.temporal-city', label:'Historical timeline'},
];
export function mountToolPanelDock(doc = document) {
  let storage; try { storage = doc.defaultView.localStorage; } catch {}
  const preferences = readDockPreferences(storage), entries = new Map();
  const save = () => { try { storage?.setItem(DOCK_KEY, JSON.stringify(preferences)); } catch {} };
  const apply = entry => {
    const {panel, state, bar} = entry;
    panel.classList.add('tool-dock-panel');
    panel.classList.toggle('tool-dock-collapsed', state.collapsed);
    panel.classList.toggle('tool-dock-floating', state.floating && !state.collapsed);
    panel.style.setProperty('--tool-dock-width', `${state.width}px`);
    bar.querySelector('[data-dock-collapse]').setAttribute('aria-expanded', String(!state.collapsed));
    bar.querySelector('[data-dock-collapse]').textContent = `${state.collapsed ? 'Expand' : 'Collapse'} ${entry.label}`;
    bar.querySelector('[data-dock-float]').textContent = state.floating ? 'Dock' : 'Undock';
    bar.querySelector('input').value = state.width;
    bar.querySelector('label').hidden = state.collapsed;
    bar.querySelector('[data-dock-float]').hidden = state.collapsed;
  };
  function scan() {
    for (const definition of PANEL_DEFINITIONS) {
      const panel = doc.querySelector(definition.selector); if (!panel) continue;
      let entry = entries.get(panel);
      if (!entry) {
        const state = preferences[definition.id] ||= {collapsed:false, floating:false, width:360};
        const bar = doc.createElement('div'); bar.className = 'tool-dock-bar';
        bar.innerHTML = '<button type="button" data-dock-collapse></button><button type="button" data-dock-float>Undock</button><label>Width <input type="range" min="260" max="560" step="20"></label>';
        bar.querySelector('input').setAttribute('aria-label', `${definition.label} panel width`);
        entry = {...definition, panel, state, bar}; entries.set(panel, entry);
        bar.addEventListener('click', event => {
          if (event.target.matches('[data-dock-collapse]')) {
            state.collapsed = !state.collapsed;
            // One expanded tool occupies the shared lane. Never alter owner visibility.
            if (!state.collapsed) for (const other of entries.values()) if (other !== entry) { other.state.collapsed = true; apply(other); }
          } else if (event.target.matches('[data-dock-float]')) state.floating = !state.floating;
          else return;
          apply(entry); save();
        });
        bar.querySelector('input').addEventListener('input', event => { state.width = Number(event.target.value); apply(entry); save(); });
        panel.addEventListener('keydown', event => {
          if (event.key !== 'Escape' || event.defaultPrevented || state.collapsed) return;
          // Feature dismissal remains authoritative; only consume for unmanaged tools.
          if (panel.hasAttribute('data-world-panel')) return;
          event.preventDefault(); event.stopPropagation(); state.collapsed = true; apply(entry); save();
          bar.querySelector('[data-dock-collapse]').focus({preventScroll:true});
        });
        apply(entry);
      }
      // Legacy renderers replace innerHTML. Reattach the same controls/listeners.
      if (entry.bar.parentElement !== panel) {
        const summary = panel.querySelector(':scope > summary');
        if (summary) summary.after(entry.bar); else panel.prepend(entry.bar);
      }
    }
  }
  scan();
  const observer = new doc.defaultView.MutationObserver(scan);
  observer.observe(doc.body, {childList:true, subtree:true});
  return {dispose() { observer.disconnect(); for (const {panel,bar} of entries.values()) {bar.remove(); panel.classList.remove('tool-dock-panel','tool-dock-floating','tool-dock-collapsed');} }};
}
if (typeof document !== 'undefined' && document.body.classList.contains('world-explorer')) mountToolPanelDock();
