// Deliberately independent of causal/context contracts: never pass context here.
export const LOCAL_JOURNEY_KEY = 'hbl.local-journeys.v1';
export const JOURNEY_ACTIONS = Object.freeze(['second-connected-experience','causal-link-click','completed-bakery-journey','future-entry','future-reopen','saved-world-continuation']);
const LIMIT = 999999;
const empty = () => Object.fromEntries(JOURNEY_ACTIONS.map(key => [key, 0]));
export function createLocalJourneyCounters(storage) {
  const seen = new Set();
  const read = () => {
    try {
      const raw = storage?.getItem(LOCAL_JOURNEY_KEY);
      if (!raw || raw.length > 512) return null;
      const value = JSON.parse(raw);
      if (value?.version !== 1 || value.enabled !== true || Object.keys(value).sort().join() !== 'counts,enabled,version') return null;
      if (!value.counts || Object.keys(value.counts).sort().join() !== [...JOURNEY_ACTIONS].sort().join()) return null;
      if (!JOURNEY_ACTIONS.every(key => Number.isInteger(value.counts[key]) && value.counts[key] >= 0 && value.counts[key] <= LIMIT)) return null;
      return value;
    } catch { return null; }
  };
  const write = value => { try { if (!storage) return false; storage.setItem(LOCAL_JOURNEY_KEY, JSON.stringify(value)); return true; } catch { return false; } };
  return Object.freeze({
    isEnabled: () => !!read(),
    setEnabled(enabled) {
      seen.clear();
      if (enabled === true) return write(read() || {version:1, enabled:true, counts:empty()});
      try { storage?.removeItem(LOCAL_JOURNEY_KEY); return true; } catch { return false; }
    },
    reset() { seen.clear(); try { storage?.removeItem(LOCAL_JOURNEY_KEY); return true; } catch { return false; } },
    record(action) {
      if (arguments.length !== 1 || !JOURNEY_ACTIONS.includes(action)) return false;
      const state = read();
      if (!state || (action !== 'causal-link-click' && seen.has(action))) return false;
      state.counts[action] = Math.min(LIMIT, state.counts[action] + 1);
      if (!write(state)) return false;
      if (action !== 'causal-link-click') seen.add(action);
      return true;
    }
  });
}
export function mountLocalJourneyControls(container) {
  let storage;
  try { storage = window.localStorage; } catch { /* privacy mode: remain off */ }
  const counters = createLocalJourneyCounters(storage);
  const doc = container.ownerDocument;
  const panel = doc.createElement('fieldset');
  const legend = doc.createElement('legend'); legend.textContent = 'Local journey counters';
  const label = doc.createElement('label');
  const checkbox = doc.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = counters.isEnabled();
  label.append(checkbox, doc.createTextNode(' Count six aggregate journey actions on this browser only (default off).'));
  const note = doc.createElement('p'); note.textContent = 'No identifiers or world content. Nothing is sent anywhere. Reset deletes counts and turns counting off.';
  const reset = doc.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset local counters';
  checkbox.addEventListener('change', () => { counters.setEnabled(checkbox.checked); checkbox.checked = counters.isEnabled(); });
  reset.addEventListener('click', () => { counters.reset(); checkbox.checked = counters.isEnabled(); });
  panel.append(legend,label,note,reset); container.append(panel);
  return counters;
}
