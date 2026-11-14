import { isNumeric, metricDirection } from './analysis.js';

// Presentation only: terminal metrics of unique same-seed, same-version cases.
// Exact equality defines a tie; no significance or causal effect is inferred.
export function policyTradeoffs({ experiment, model, runs = [] } = {}, scenarioId) {
  const baseline = experiment?.scenarios?.find(s => s.kind === 'baseline');
  const selected = experiment?.scenarios?.find(s => s.id === scenarioId);
  const result = { baseline, selected, rows: [], unavailable: [], excluded: 0 };
  if (!baseline || !selected || baseline.id === selected.id || baseline.timelineFork || selected.timelineFork || !experiment?.id ||
      !model?.version || experiment.modelId !== model.id || experiment.modelVersion !== model.version) return result;
  const valid = runs.filter(r => ['completed', 'successful', 'succeeded'].includes(r.status) && !r.error &&
    r.experimentId === experiment.id && r.modelVersion === model.version && Number.isFinite(r.seed));
  const unique = id => {
    const groups = new Map();
    for (const r of valid.filter(r => r.scenarioId === id)) groups.set(r.seed, [...(groups.get(r.seed) || []), r]);
    return new Map([...groups].filter(([, items]) => items.length === 1).map(([seed, items]) => [seed, items[0]]));
  };
  const bases = unique(baseline.id), plans = unique(selected.id);
  const pairs = [...plans.values()].flatMap(plan => bases.has(plan.seed) && !plan.timelineFork && !bases.get(plan.seed).timelineFork && plan.engineVersion === bases.get(plan.seed).engineVersion ? [{ plan, base: bases.get(plan.seed) }] : []);
  result.excluded = runs.filter(r => r.scenarioId === selected.id).length - pairs.length;
  for (const metric of model.metrics || []) {
    const direction = metricDirection(metric);
    if (!direction || !metric.unit) { result.unavailable.push(metric.id); continue; }
    const cases = pairs.flatMap(({ plan, base }) => {
      const before = base.metrics?.[metric.id], after = plan.metrics?.[metric.id];
      if (!isNumeric(before) || !isNumeric(after)) return [];
      const delta = after - before;
      if (!isNumeric(delta)) return [];
      return [{ plan, base, before, after, delta, side: delta === 0 ? 'unchanged' : delta * direction > 0 ? 'good' : 'bad' }];
    });
    if (!cases.length) { result.unavailable.push(metric.id); continue; }
    result.rows.push({ metric, cases, missing: pairs.length - cases.length,
      counts: Object.fromEntries(['good', 'bad', 'unchanged'].map(side => [side, cases.filter(c => c.side === side).length])) });
  }
  return result;
}

export function renderPolicyTradeoffs(container, data, scenarioId) {
  const n = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node; };
  container.replaceChildren();
  const result = policyTradeoffs(data, scenarioId);
  container.append(n('h3', 'Trade-off theater'), n('p', 'Synthetic model results · terminal metrics · exact ties · descriptive comparison, not a forecast. Good and bad follow the model’s declared metric preferences; no overall winner is inferred.'));
  container.append(n('p', result.selected && result.baseline ? `${result.selected.name} versus ${result.baseline.name} · stored results; input edits require a new run.` : 'Choose an alternative and run it against current policy.'));
  const grid = n('div', ''); grid.className = 'tradeoff-grid';
  for (const [side, title] of [['good', 'Good'], ['bad', 'Bad'], ['unchanged', 'Unchanged']]) {
    const card = n('article', ''); card.dataset.tradeoff = side;
    card.append(n('h4', title));
    let count = 0;
    for (const row of result.rows) {
      const cases = row.cases.filter(c => c.side === side);
      if (!cases.length) continue;
      count++;
      const section = n('section', ''), { metric, counts } = row;
      section.append(n('h5', `${metric.label || metric.id} · ${metric.id} (${metric.unit})`),
        n('p', `${cases.length}/${row.cases.length} comparable cases · good ${counts.good}, bad ${counts.bad}, ties ${counts.unchanged} · missing ${row.missing}${counts.good && counts.bad ? ' · disagreement across seeds' : ''}`));
      // One recorded example per metric and side keeps the DOM bounded on low-end devices.
      const c = cases[0];
      section.append(n('p', `Example seed ${c.plan.seed}: ${c.before} → ${c.after} ${metric.unit}; delta ${c.delta} ${metric.unit}. Model ${data.model.id} ${data.model.version}. Branch ${c.base.scenarioId} → ${c.plan.scenarioId}.`));
      for (const [label, run] of [['Baseline source', c.base], ['Alternative source', c.plan]]) {
        const a = n('a', `${label}: ${run.id}`);
        a.href = `/api/decision-experiments/${encodeURIComponent(data.experiment.id)}/runs/${encodeURIComponent(run.id)}`;
        a.target = '_blank'; a.rel = 'noopener'; section.append(a, document.createTextNode(' '));
      }
      card.append(section);
    }
    if (!count) card.append(n('p', result.rows.length ? 'No comparable cases in this category.' : 'No supported paired results yet. Missing data is not a tie.'));
    grid.append(card);
  }
  container.append(grid, n('p', `Excluded alternative cases: ${result.excluded}. Unranked / unavailable metrics: ${result.unavailable.join(', ') || 'none'}. Examples are the first stored case in each category, not representative effect estimates.`));
}
