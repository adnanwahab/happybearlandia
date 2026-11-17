import { METRICS, quantile } from './paired.js';
import { FUTURES_VERSION, simYears } from './futures.js';
import { realitySeed } from './multiverse.js';

// Cache identity scopes model, source snapshot, seed family, horizon and population.
export function matchingTideBatch(storage, { snapshotId, baseSeed, years, people }) {
  try {
    const key = storage.getItem(`hbl:lab-latest:${snapshotId}:${baseSeed}`);
    if (!key?.startsWith(`hbl:lab:${snapshotId}:${baseSeed}:${years}:${people}:`)) return null;
    const batch = JSON.parse(storage.getItem(key));
    return batch?.version === FUTURES_VERSION && batch.cfg?.years === years ? batch : null;
  } catch { return null; }
}

export function tideSummary(batch, { baseSeed, sampleSize = 100, metric = 'avgMood' } = {}) {
  if (!Array.isArray(batch?.futures) || batch?.version !== FUTURES_VERSION || !METRICS[metric] || !Number.isInteger(sampleSize) || sampleSize < 1 || sampleSize > 1000 || !Number.isInteger(batch.cfg?.years) || batch.cfg.years < 1 || batch.cfg.years > 10 || !Number.isInteger(batch.cfg.step) || batch.cfg.step < 1) return null;
  const selected = Array.from({ length: sampleSize }, (_, index) => {
    const matches = (batch.futures || []).filter(f => f?.index === index);
    const f = matches.length === 1 ? matches[0] : null;
    return f && f.seed === realitySeed(baseSeed, index) && (f.status === undefined || f.status === 'completed') ? f : null;
  });
  const rows = simYears(batch.cfg.years, batch.cfg.step).map(year => {
    // A paired metric must exist in both arms at the recorded year. Never coerce null to zero.
    const pairs = selected.flatMap(f => {
      if (!Array.isArray(f?.simYears) || !f.simYears.includes(year)) return [];
      const row = f.years?.[year], b = row?.baseline?.[metric], p = row?.plans?.[0]?.[metric];
      return typeof b === 'number' && Number.isFinite(b) && typeof p === 'number' && Number.isFinite(p) ? [[b, p]] : [];
    });
    const summarize = arm => pairs.length ? [.1, .5, .9].map(q => quantile(pairs.map(p => p[arm]), q)) : null;
    return { year, count: pairs.length, baseline: summarize(0), plan: summarize(1) };
  });
  return { metric, ...METRICS[metric], sampleSize, rows };
}

export function mountTides(container, batch, baseSeed) {
  container.innerHTML = `<h2>Uncertainty Tide Lines</h2><p>Synthetic modeled outcomes · P10 / P50 / P90 across matched seeded futures, not forecast probabilities or confidence intervals. Each checkpoint represents one simulated week in a modeled year; no monthly observations are recorded. No decorative data layers or new social mechanisms.</p>`;
  if (!batch) { container.append(Object.assign(document.createElement('p'), { textContent: 'Matching yearly ensemble unavailable. Run the Possible Worlds Lab for this snapshot, seed, horizon and population in this browser.' })); return () => {}; }
  const controls = document.createElement('div');
  controls.innerHTML = `<label>Metric <select aria-label="Tide metric">${Object.entries(METRICS).map(([id,m]) => `<option value="${id}">${m.label}</option>`).join('')}</select></label> <label>Sample slots <select aria-label="Tide sample size"><option>10</option><option>25</option><option>50</option><option selected>100</option></select></label> <button type="button">Play recorded years</button> <label>Checkpoint <input aria-label="Tide checkpoint" type="range" min="0" value="0" step="1"></label>`;
  const output = document.createElement('div');
  container.append(controls, output);
  const [metric, size] = controls.querySelectorAll('select'), slider = controls.querySelector('input'), button = controls.querySelector('button');
  let timer = null, report;
  const stop = () => { clearInterval(timer); timer = null; button.textContent = 'Play recorded years'; };
  const paint = () => {
    if (!report) { output.textContent = 'Unsupported or invalid recorded ensemble.'; return; }
    const row = report.rows[Number(slider.value)], all = report.rows.flatMap(r => [...(r.baseline || []), ...(r.plan || [])]);
    const lo = Math.min(...all), hi = Math.max(...all), y = v => 160 - 130 * (v-lo) / (hi-lo || 1);
    // Separate vertical intervals: never draw a line through an unrecorded month or missing year.
    output.innerHTML = `<p>Modeled year +${row.year}: ${row.count} valid matched pairs / ${report.sampleSize} selected seed slots; ${report.sampleSize-row.count} failed, missing, duplicate or unmatched. ${report.label} (${report.unit}).</p><svg role="img" aria-label="P10 P50 P90 intervals at recorded years; baseline blue, plan orange" viewBox="0 0 640 200" style="width:100%;max-width:800px"><text x="4" y="15">${all.length ? `${lo.toFixed(2)}–${hi.toFixed(2)}` : 'No finite values'} ${report.unit} · shared y-axis</text>${report.rows.map((r,i) => {
      const x = 65 + i * 520 / Math.max(1,report.rows.length-1);
      return `<text x="${x}" y="190" text-anchor="middle">+${r.year}</text>` + (i > Number(slider.value) ? '' : ['baseline','plan'].map((arm,a) => {
        const values = r[arm], xx = x + (a ? 5 : -5), color = a ? '#b34d00' : '#2166ac';
        return values ? `<line x1="${xx}" x2="${xx}" y1="${y(values[0])}" y2="${y(values[2])}" stroke="${color}" stroke-width="5"/><circle cx="${xx}" cy="${y(values[1])}" r="4" fill="${color}"/>` : '';
      }).join(''));
    }).join('')}</svg><p>Blue: without plan. Orange: plan 0. Vertical bands: P10–P90; dots: P50. Horizontal units: modeled years since start. Shared scale across both arms and all recorded years for this selection. Unrecorded months and missing pairs are never interpolated.</p><table><caption>Selected checkpoint — ${report.unit}</caption><thead><tr><th>Arm</th><th>P10</th><th>P50</th><th>P90</th></tr></thead><tbody>${['baseline','plan'].map(arm => `<tr><th>${arm}</th>${(row[arm] || [null,null,null]).map(v => `<td>${v === null ? 'unavailable' : v.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  };
  const reset = () => { stop(); report = tideSummary(batch, {baseSeed, sampleSize:Number(size.value), metric:metric.value}); slider.max = String((report?.rows.length || 1)-1); slider.value = '0'; paint(); };
  metric.onchange = size.onchange = reset;
  slider.oninput = () => { stop(); paint(); };
  button.onclick = () => { if (timer) { stop(); return; } if (!report) return; slider.value = '0'; paint(); button.textContent = 'Pause'; timer = setInterval(() => { if (Number(slider.value) >= report.rows.length-1) { stop(); return; } slider.value = String(Number(slider.value)+1); paint(); }, 800); };
  const visibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', visibility);
  reset();
  return () => { stop(); document.removeEventListener('visibilitychange', visibility); metric.onchange = size.onchange = slider.oninput = button.onclick = null; container.replaceChildren(); };
}
