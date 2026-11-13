// Local recognition of inspection, never a measure of policy quality.
export const BADGE_KEY = 'hbl.decision.exploration-badges.v1';
const policies = { permitting_months: 'Permitting explorer', zoning_density: 'Density explorer', subsidy_amount: 'Construction funding explorer', voucher_funding: 'Voucher explorer' };
const labels = { ...policies, tradeoffs: 'Tradeoff inspector' };
const valid = id => Object.hasOwn(labels, id);

export function inspectionBadges(data) {
  const experiment = data?.experiment;
  if (experiment?.status !== 'completed' || experiment.metadata?.preview || data.model?.id !== experiment.modelId || data.model?.version !== experiment.modelVersion) return [];
  const baseline = experiment.scenarios?.find(s => s.kind === 'baseline');
  if (!baseline) return [];
  const usable = (data.runs || []).filter(r => !r.error && Number.isFinite(r.metrics?.public_expenditure) && Number.isFinite(r.metrics?.affordability));
  const controls = usable.filter(r => r.scenarioId === baseline.id);
  const alternatives = experiment.scenarios.filter(s => s.kind !== 'baseline' && usable.some(r => r.scenarioId === s.id && controls.some(b => b.seed === r.seed)));
  if (!alternatives.length) return [];
  return ['tradeoffs', ...Object.keys(policies).filter(id => alternatives.some(s => {
    const definition = data.model.parameters.find(p => p.id === id);
    const before = baseline.parameters?.[id] ?? definition?.default;
    const after = s.parameters?.[id] ?? definition?.default;
    return Number.isFinite(before) && Number.isFinite(after) && before !== after;
  }))];
}

export function createBadgeStore(storage) {
  let earned = new Set();
  let persistent = true;
  function read() {
    try { const saved = JSON.parse(storage.getItem(BADGE_KEY) || 'null'); if (saved?.version === 1 && Array.isArray(saved.badges)) saved.badges.filter(valid).forEach(id => earned.add(id)); }
    catch { persistent = false; }
  }
  read();
  return {
    award(ids) {
      read();
      const added = [...new Set(ids.filter(valid))].filter(id => !earned.has(id));
      added.forEach(id => earned.add(id));
      try { storage.setItem(BADGE_KEY, JSON.stringify({ version: 1, badges: [...earned].sort() })); persistent = true; } catch { persistent = false; }
      return added;
    },
    get badges() { return [...earned].sort(); },
    get persistent() { return persistent; },
    clear() { earned.clear(); try { storage.removeItem(BADGE_KEY); } catch { persistent = false; } },
  };
}

export function mountExplorationBadges(container, { storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) } } = {}) {
  const store = createBadgeStore(storage);
  const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
  const section = node('section', ''); section.id = 'exploration-badges';
  section.append(node('h2', 'Exploration badges'), node('p', 'Optional recognition of policies and tradeoffs you inspect. These are not scores, policy endorsements, or evidence of better outcomes. Stored only in this browser; never included in shared experiments.'));
  const list = node('ul', ''), note = node('p', ''), inspect = node('button', 'Inspect policy tradeoffs'), clear = node('button', 'Clear local badges'), evidence = node('div', '');
  inspect.type = clear.type = 'button';
  list.setAttribute('aria-label', 'Earned exploration badges'); note.setAttribute('role', 'status');
  section.append(list, note, inspect, clear, evidence); container.append(section);
  let data = null;
  function render() {
    list.replaceChildren(...store.badges.map(id => node('li', labels[id])));
    note.textContent = store.persistent ? 'Badges stay in this browser until cleared. No deadlines or streaks.' : 'Browser storage unavailable. Badges last for this visit only.';
    inspect.disabled = !inspectionBadges(data).length;
  }
  inspect.addEventListener('click', () => {
    const ids = inspectionBadges(data); if (!ids.length) return;
    evidence.replaceChildren(node('p', 'Modeled public expenditure (USD) and affordability (index): inspect the cost and affordability chart and scenario comparison above for distributions and matched-seed differences. These synthetic results are not forecasts.'));
    for (const s of data.experiment.scenarios) {
      const runs = data.runs.filter(r => r.scenarioId === s.id && Number.isFinite(r.metrics?.public_expenditure) && Number.isFinite(r.metrics?.affordability));
      if (!runs.length) continue;
      const mean = id => runs.reduce((sum, r) => sum + r.metrics[id] / runs.length, 0);
      evidence.append(node('p', `${s.name}: mean public expenditure ${mean('public_expenditure').toLocaleString()} USD; mean affordability ${mean('affordability').toFixed(2)}. ${runs.length} completed futures.`));
    }
    store.award(ids); render();
  });
  clear.addEventListener('click', () => { store.clear(); evidence.replaceChildren(); render(); });
  render();
  return { update(next) { data = next; evidence.replaceChildren(); render(); } };
}
