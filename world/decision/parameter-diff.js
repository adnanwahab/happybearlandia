import { resolveInheritedScenarios } from './contracts.js';

// Stable structural comparison: object insertion order is not a model change.
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export function scenarioParameterDiff(input, model, selectedId) {
  const scenarios = resolveInheritedScenarios(input.scenarios);
  const baseline = scenarios.find(s => s.kind === 'baseline');
  const selected = scenarios.find(s => s.id === selectedId);
  if (!baseline || !selected) throw new Error('Select a scenario and a current-policy baseline.');
  const rows = model.parameters.map(p => {
    const cell = s => ({ value: s.parameters?.[p.id] ?? p.default,
      uncertainty: s.uncertainty?.[p.id]?.type === 'fixed' ? null : s.uncertainty?.[p.id] || null });
    const before = cell(baseline), after = cell(selected);
    return { id: p.id, label: p.label, unit: p.unit, default: p.default, before, after,
      changed: stable(before) !== stable(after) };
  });
  // Include every remaining executable setting so projects/forks/stresses cannot
  // masquerade as an otherwise identical parameter-only comparison.
  const ignored = new Set(['id','name','kind','parameters','uncertainty','inheritsFrom','extendsScenarioId','overrides']);
  const settings = [...new Set([...Object.keys(baseline), ...Object.keys(selected)])].filter(k => !ignored.has(k)).map(id => {
    const before = baseline[id] ?? null, after = selected[id] ?? null;
    return { id, before, after, changed: stable(before) !== stable(after) };
  });
  const seedOverrides = [baseline, selected].filter(s => s.timelineFork?.mode === 'selected-future').map(s => `${s.name}: stored seed ${s.timelineFork.sourceSeed}`);
  return { seedOverrides, baseline: baseline.name, selected: selected.name, seed: input.seed ?? 42,
    runs: input.runs ?? 100, years: input.years ?? 10, rows, settings };
}

export function renderParameterDiff(container, input, model, selectedId) {
  const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
  container.replaceChildren();
  try {
    const diff = scenarioParameterDiff(input, model, selectedId);
    container.append(node('p', `Shared matched seed: ${diff.seed} · ${diff.runs} runs per scenario · ${diff.years} years · ${model.id} ${model.version}`),
      node('p', 'Configured inputs before sampling and stress effects. All model defaults are visible. Distributions, stress presets, and scheduled changes may alter run values; inspect a stored future for sampled values. Synthetic model assumptions.'));
    if (diff.seedOverrides.length) container.append(node('p', `Seed override — ${diff.seedOverrides.join('; ')}. These forks use their stored seed rather than the shared sequence.`));
    const table = document.createElement('table'); table.className = 'parameter-diff-table';
    table.append(node('caption', `${diff.baseline} compared with ${diff.selected}`));
    const head = document.createElement('thead'), header = document.createElement('tr');
    for (const title of ['Setting / unit / model default', diff.baseline, diff.selected, 'Comparison']) { const th = node('th', title); th.scope = 'col'; header.append(th); }
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    const value = cell => `${cell.value} · ${cell.uncertainty ? stable(cell.uncertainty) : 'fixed'}`;
    for (const row of [...diff.rows.map(r => ({...r, label: `${r.label} (${r.unit}) · default ${r.default}`, before: value(r.before), after: value(r.after)})),
      ...diff.settings.map(r => ({...r, label: r.id, before: stable(r.before), after: stable(r.after)}))]) {
      const tr = document.createElement('tr'); tr.dataset.diffSetting = row.id; tr.dataset.changed = String(row.changed);
      const label = node('th', row.label); label.scope = 'row'; tr.append(label, node('td', row.before), node('td', row.after), node('td', row.changed ? 'Changed' : 'Shared'));
      body.append(tr);
    }
    table.append(body); container.append(table);
  } catch (error) { container.append(node('p', error.message)); }
}
