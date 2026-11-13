import { computeSensitivities } from './sensitivity-analysis.js';

const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format = value => value === null ? 'unavailable' : Number(value).toLocaleString(undefined, {maximumSignificantDigits: 5});
export const assumptionAnchor = id => `research-assumption-${encodeURIComponent(id)}`;

export function buildUncertaintyExplorer(batch, experiment) {
  const simulations = batch?.simulations || [];
  const definitions = new Map((experiment?.outcomes?.metricRegistry || []).map(row => [row.id, row]));
  const ids = new Set(['score', ...definitions.keys(), ...simulations.flatMap(row => Object.keys(row.metrics || {}))]);
  const outcomes = [...ids].map(id => {
    const samples = simulations.map(row => ({runId: row.id ?? row.worldId ?? null, seed: row.world?.seed ?? null,
      value: number(id === 'score' ? row.score : row.metrics?.[id])}));
    const values = samples.map(row => row.value).filter(v => v !== null).sort((a,b) => a-b);
    const quantile = p => {
      if (!values.length) return null;
      const index = (values.length - 1) * p, lower = Math.floor(index);
      return values[lower] + (values[Math.ceil(index)] - values[lower]) * (index-lower);
    };
    const min = values[0] ?? null, max = values.at(-1) ?? null;
    const bins = values.length ? Array.from({length: min === max ? 1 : 10}, (_, i) => ({
      min: min + (max-min)*i/10, max: min === max ? max : min + (max-min)*(i+1)/10, count: 0,
    })) : [];
    for (const value of values) bins[min === max ? 0 : Math.min(9, Math.floor((value-min)/(max-min)*10))].count++;
    return {id, label: definitions.get(id)?.label || id, unit: definitions.get(id)?.unit || (id === 'score' ? 'score' : 'unspecified'),
      samples, count: values.length, missing: samples.length-values.length, min, max, p10: quantile(.1), median: quantile(.5), p90: quantile(.9), bins,
      sensitivities: computeSensitivities(batch, experiment, {metric:id}).map(row => {
        const inputs = simulations.filter((_,i) => samples[i].value !== null).map(s => number(s.world?.conditions?.[row.id])).filter(v => v !== null);
        return {...row, available: row.sampleSize >= 3 && min !== max && new Set(inputs).size > 1};
      })};
  });
  return {schemaVersion:'hbl-uncertainty-explorer.v1', method:'empirical-seed-distribution-and-pearson-screening', outcomes,
    limitations:'Synthetic modeled outcomes across sampled seeds. Percentiles describe this batch, not a confidence interval or a calibrated forecast. Pearson association can miss nonlinear effects; correlated inputs prevent causal attribution. Unmodeled mechanisms are excluded.'};
}

export function renderResearchLibrary(container, variables = []) {
  container.innerHTML = variables.map(variable => {
    const confidence = variable.provenance?.confidence ?? variable.confidence;
    const evidence = variable.evidence || [];
    return `<article id="${escape(assumptionAnchor(variable.id))}" tabindex="-1"><h3>${escape(variable.label || variable.id)}</h3>
      <p>${escape(variable.provenance?.type || 'unknown')} · Confidence: ${typeof confidence === 'number' && Number.isFinite(confidence) ? `${Math.round(Math.max(0,Math.min(1,confidence))*100)}%` : 'unknown'} · ${escape(variable.reason || 'Modeling assumption')}</p>
      ${evidence.length ? evidence.map(row => {
        const safe = typeof row.url === 'string' && /^https?:\/\//i.test(row.url);
        return `<p>${safe ? `<a href="${escape(row.url)}" target="_blank" rel="noopener noreferrer">${escape(row.sourceName || row.id)}</a>` : escape(row.sourceName || row.id)} · ${escape(row.type)} · ${escape(row.geography)} · ${escape(row.observedAt || 'date unspecified')}<br>${escape(row.notes || '')}${safe ? '' : ' · No external source linked.'}</p>`;
      }).join('') : '<p>No source recorded. Unsourced model assumption.</p>'}</article>`;
  }).join('');
}

export function renderUncertaintyExplorer(container, report) {
  container.innerHTML = `<label>Outcome <select aria-label="Uncertainty outcome">${report.outcomes.map(row => `<option value="${escape(row.id)}">${escape(row.label)}</option>`).join('')}</select></label><div data-outcome></div><p>${escape(report.limitations)}</p>`;
  const select = container.querySelector('select');
  const render = () => {
    const row = report.outcomes.find(row => row.id === select.value);
    const top = row.sensitivities.find(s => s.available);
    container.querySelector('[data-outcome]').innerHTML = `<h3>${escape(row.label)} (${escape(row.unit)})</h3><p>${row.count} observed model outputs · ${row.missing} missing · ${new Set(row.samples.filter(s=>s.seed !== null).map(s=>s.seed)).size} recorded seeds</p>
      <p>P10 ${format(row.p10)} · Median ${format(row.median)} · P90 ${format(row.p90)} · Range ${format(row.min)}–${format(row.max)}</p>
      ${row.count ? `<table class="analysis-table"><caption>Distribution across seeds</caption><thead><tr><th>Outcome interval</th><th>Runs</th><th>Frequency</th></tr></thead><tbody>${row.bins.map(bin => `<tr><td>${format(bin.min)}–${format(bin.max)}</td><td>${bin.count}</td><td><meter min="0" max="${row.count}" value="${bin.count}">${bin.count}</meter></td></tr>`).join('')}</tbody></table>` : '<p>No finite outcomes available.</p>'}
      <p><strong>Uncertainty answer:</strong> ${row.count > 1 ? `The sampled outcome spans ${format(row.min)} to ${format(row.max)}. ${top ? `${escape(top.label)} has the largest absolute linear association (r = ${top.correlation}).` : 'This batch cannot identify a parameter association.'}` : 'More finite seeded runs are needed to assess the spread.'}</p>
      <details><summary>Recorded seed outcomes</summary><table class="analysis-table"><thead><tr><th>Run</th><th>Seed</th><th>Value</th></tr></thead><tbody>${row.samples.map(s => `<tr><td>${escape(s.runId)}</td><td>${escape(s.seed ?? 'unrecorded')}</td><td>${format(s.value)}</td></tr>`).join('')}</tbody></table></details>
      <h3>Parameter sensitivity ranking</h3><p>Pearson r: positive means a higher outcome value; negative means a lower value. Fewer than 3 pairs or constant values cannot establish sensitivity.</p>
      <table class="analysis-table"><thead><tr><th>Assumption</th><th>r</th><th>Paired samples</th></tr></thead><tbody>${row.sensitivities.map(s => `<tr><td><a href="#${escape(assumptionAnchor(s.id))}">${escape(s.label)}</a></td><td>${s.available ? s.correlation : 'unavailable'}</td><td>${s.sampleSize}</td></tr>`).join('')}</tbody></table>`;
  };
  select.addEventListener('change', render); render();
}
