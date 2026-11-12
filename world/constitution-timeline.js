import { compactConstitutionResult, localConstitutionSummary } from './constitution-summary.js';

// Select recorded checkpoints only: never interpolate unobserved outcomes.
export function constitutionCheckpoint(result, index) {
  const point = result.series[index];
  if (!point) throw new Error('Unknown simulation checkpoint');
  const { metric, neutralBand } = result.futures;
  const better = result.meta.metrics[metric].better === 'lower' ? -1 : 1;
  const deltas = result.runs.map(run => {
    const outcomes = run.years[point.year];
    return outcomes.plan[metric] - outcomes.baseline[metric];
  });
  const futures = { metric, year: point.year, neutralBand, positive: 0, neutral: 0, negative: 0 };
  for (const delta of deltas) {
    if (Math.abs(delta) <= neutralBand) futures.neutral++;
    else if (delta * better > 0) futures.positive++;
    else futures.negative++;
  }
  return { meta: result.meta, final: point.metrics, futures };
}

export function mountConstitutionTimeline(root) {
  const find = id => root.querySelector(`#${id}`);
  let result = null, revision = 0;
  const slider = find('checkpoint');
  function render() {
    const checkpoint = constitutionCheckpoint(result, Number(slider.value));
    const { year, metric, positive, neutral, negative, neutralBand } = checkpoint.futures;
    const label = result.meta.metrics[metric].label;
    find('checkpoint-year').textContent = `Year ${year}`;
    slider.setAttribute('aria-valuetext', `Year ${year}`);
    find('split').textContent = `${label} at year ${year}: ${positive} better · ${neutral} neutral · ${negative} worse (neutral band ±${neutralBand}).`;
    find('metrics').replaceChildren(...Object.entries(checkpoint.final).map(([key, m]) => {
      const div = document.createElement('div'); div.className = 'metric';
      const title = document.createElement('strong'); title.textContent = result.meta.metrics[key].label;
      const p = document.createElement('p');
      p.textContent = `Baseline ${m.baseline.mean} · Plan ${m.plan.mean} · Δ ${m.delta.mean}. Paired p10–p90: ${m.delta.p10} to ${m.delta.p90}.`;
      div.append(title, p); return div;
    }));
    find('summary').textContent = localConstitutionSummary(compactConstitutionResult(checkpoint));
    revision++;
    return checkpoint;
  }
  slider.addEventListener('input', () => { if (result) render(); });
  return {
    reset() { result = null; revision++; root.hidden = true; },
    show(next) {
      result = next;
      slider.min = '0'; slider.max = String(next.series.length - 1); slider.step = '1';
      slider.value = slider.max; slider.disabled = next.series.length < 2;
      find('checkpoint-note').textContent = `${next.series.length} recorded checkpoint${next.series.length === 1 ? '' : 's'}. Metrics, future split and summary follow the selected year. Maps show schematic interventions, not a replay of that year.`;
      const checkpoint = render(); root.hidden = false;
      const currentRevision = revision;
      return { checkpoint, setSummary(summary) { if (revision === currentRevision && typeof summary === 'string') find('summary').textContent = summary; } };
    },
  };
}
