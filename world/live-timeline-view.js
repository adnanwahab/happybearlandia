// Live runner contract: { baseline: { timeline: [{ year, score, metrics }] },
// current: { timeline: [...] }, metricRegistry?: [{ id, label, unit, direction }] }.
// Raw simulator results and ensembles ({ worlds: [{ result: { timeline } }] })
// are also accepted; ensembles are averaged by year without inventing missing data.
const number = value => typeof value === 'number' && Number.isFinite(value);
const label = value => String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function normalizeLiveTimeline(source) {
  const direct = Array.isArray(source) ? source : source?.timeline ?? source?.result?.timeline;
  const ensemble = source?.worlds ?? source?.outcomes?.worlds ?? source?.simulations ?? source?.runs;
  const timelines = Array.isArray(direct) ? [direct] : (Array.isArray(ensemble) ? ensemble : []).map(row => row?.timeline ?? row?.result?.timeline ?? row?.simulation?.timeline).filter(Array.isArray);
  const years = new Map();
  for (const timeline of timelines) for (const row of timeline) {
    if (!row || !number(row.year)) continue;
    if (!years.has(row.year)) years.set(row.year, new Map());
    const values = { ...(row.values || {}), ...(row.metrics || {}) };
    if (number(row.score)) values.score = row.score;
    for (const [key, raw] of Object.entries(values)) {
      const value = typeof raw === 'object' && raw ? raw.mean ?? raw.value : raw;
      if (!number(value)) continue;
      const bucket = years.get(row.year);
      const prior = bucket.get(key) || [0, 0];
      bucket.set(key, [prior[0] + value, prior[1] + 1]);
    }
  }
  return [...years].sort(([a], [b]) => a - b).map(([year, values]) => ({ year, metrics: Object.fromEntries([...values].map(([key, [sum, count]]) => [key, sum / count])) }));
}

export function mountLiveTimelineView(container) {
  if (!container?.ownerDocument) throw new TypeError('A DOM container is required.');
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'live-timeline';
  root.setAttribute('aria-label', 'Live simulation comparison');
  root.innerHTML = `<style>
.live-timeline{--lt-current:#087f8c;--lt-base:#8056ad;color:#182c3c;background:#fff;border:1px solid #dce5e8;border-radius:18px;padding:clamp(14px,3vw,26px);font:14px/1.5 system-ui,sans-serif;box-sizing:border-box;min-width:0}
.live-timeline *{box-sizing:border-box}.live-timeline .lt-head,.live-timeline .lt-transport,.live-timeline .lt-legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.live-timeline .lt-head{justify-content:space-between}.live-timeline h3{margin:0;font-size:20px}.live-timeline select,.live-timeline button{font:inherit;background:#f5f8fa;color:#182c3c;border:1px solid #a9bcc5;border-radius:8px;padding:8px;min-height:40px}.live-timeline button:focus-visible,.live-timeline select:focus-visible,.live-timeline input:focus-visible{outline:3px solid #087f8c;outline-offset:3px}.live-timeline .lt-chart{width:100%;height:auto;display:block;margin:14px 0}.live-timeline .lt-legend{font-size:13px}.live-timeline .lt-key{width:24px;border-top:3px solid var(--lt-current);display:inline-block;margin-right:6px;vertical-align:middle}.live-timeline .lt-base{border-color:var(--lt-base);border-top-style:dashed}.live-timeline .lt-values{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:16px 0}.live-timeline .lt-value{background:#f3f7f8;border-radius:10px;padding:12px}.live-timeline .lt-value strong{display:block;font-size:22px}.live-timeline .lt-transport input{flex:1;min-width:100px;accent-color:var(--lt-current)}.live-timeline .lt-note{font-size:12px;color:#526575;margin:12px 0 0}.live-timeline .lt-status{margin:12px 0;color:#526575}.live-timeline [hidden]{display:none!important}
</style><div class="lt-head"><h3>Explore the timeline</h3><label>Metric <select aria-label="Timeline metric"></select></label></div><p class="lt-status" role="status" aria-live="polite"></p><div class="lt-body" hidden><div class="lt-legend"><span><i class="lt-key"></i>Current settings</span><span><i class="lt-key lt-base"></i>Baseline</span></div><svg class="lt-chart" viewBox="0 0 720 290" role="img" aria-label="Simulation time series"></svg><div class="lt-transport"><button type="button" aria-label="Play timeline">Play</button><label>Year <output></output></label><input type="range" min="0" step="1" aria-label="Simulation year"></div><div class="lt-values"><div class="lt-value">Current<strong data-value="current">—</strong></div><div class="lt-value">Baseline<strong data-value="baseline">—</strong></div><div class="lt-value">Difference<strong data-value="difference">—</strong></div></div><p class="lt-note lt-direction"></p></div><p class="lt-note">Lines show ensemble means when multiple runs are supplied. Baseline uses the original experiment settings. Illustrative model output, not a real-world forecast. Missing values are shown as —; lines break where data is unavailable.</p>`;
  container.append(root);
  const find = selector => root.querySelector(selector);
  const select = find('select'), slider = find('input'), play = find('button'), svg = find('svg'), status = find('.lt-status'), body = find('.lt-body');
  let baseline = [], current = [], years = [], registry = [], metric = 'score', index = 0, timer = null, destroyed = false, pending = false;
  const stop = () => { if (timer !== null) clearInterval(timer); timer = null; play.textContent = 'Play'; play.setAttribute('aria-label', 'Play timeline'); };
  const format = value => {
    if (!number(value)) return '—';
    const meta = registry.find(row => row.id === metric);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, ...(meta?.unit === 'fraction' || meta?.unit === 'probability' ? { style: 'percent' } : {}) }).format(value);
  };
  const node = (name, attrs, text) => {
    const element = doc.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = text;
    svg.append(element); return element;
  };
  function render() {
    if (destroyed || !years.length) return;
    const year = years[index];
    find('output').textContent = String(year); slider.value = String(index); slider.setAttribute('aria-valuetext', `Year ${year}`);
    const a = current.find(row => row.year === year)?.metrics[metric], b = baseline.find(row => row.year === year)?.metrics[metric];
    for (const [key, value] of Object.entries({ current: a, baseline: b, difference: number(a) && number(b) ? a - b : undefined })) find(`[data-value="${key}"]`).textContent = `${key === 'difference' && value > 0 ? '+' : ''}${format(value)}`;
    const meta = registry.find(row => row.id === metric);
    find('.lt-direction').textContent = meta?.direction === 'lower-is-better' ? 'Lower values are preferred in this model.' : meta?.direction === 'higher-is-better' ? 'Higher values are preferred in this model.' : 'Interpret differences in the context of the selected metric.';
    svg.replaceChildren();
    node('title', {}, `${meta?.label || label(metric)}: current settings and baseline by year`);
    node('desc', {}, `Selected year ${year}. Current ${format(a)}; baseline ${format(b)}. Values are available below the chart.`);
    const values = [...current, ...baseline].map(row => row.metrics[metric]).filter(number);
    let low = Math.min(...values), high = Math.max(...values);
    if (!values.length) { node('text', { x: 360, y: 140, 'text-anchor': 'middle', fill: '#526575' }, 'No values available for this metric'); return; }
    const padding = (high - low) * .12 || Math.max(Math.abs(high) * .05, 1); low -= padding; high += padding;
    const x = value => 68 + (value - years[0]) / (years.at(-1) - years[0] || 1) * 628;
    const y = value => 244 - (value - low) / (high - low) * 220;
    for (let step = 0; step <= 4; step++) {
      const value = low + (high - low) * step / 4, py = y(value);
      node('line', { x1: 68, x2: 696, y1: py, y2: py, stroke: '#e2e9ec' });
      node('text', { x: 58, y: py + 4, 'text-anchor': 'end', fill: '#526575', 'font-size': 11 }, format(value));
    }
    const ticks = [...new Set([years[0], years[Math.floor((years.length - 1) / 2)], years.at(-1)])];
    for (const tick of ticks) node('text', { x: x(tick), y: 268, 'text-anchor': 'middle', fill: '#526575', 'font-size': 12 }, `Year ${tick}`);
    for (const [rows, color, dashed] of [[baseline, '#8056ad', true], [current, '#087f8c', false]]) {
      let path = '', open = false;
      for (const yr of years) { const value = rows.find(row => row.year === yr)?.metrics[metric]; if (!number(value)) { open = false; continue; } path += `${open ? 'L' : 'M'}${x(yr)},${y(value)} `; open = true; }
      node('path', { d: path, fill: 'none', stroke: color, 'stroke-width': 3, ...(dashed ? { 'stroke-dasharray': '7 5' } : {}) });
      for (const row of rows) if (number(row.metrics[metric]) && (row.year === year || rows.length === 1)) node('circle', { cx: x(row.year), cy: y(row.metrics[metric]), r: 5, fill: color, stroke: 'white', 'stroke-width': 2 });
    }
    node('line', { x1: x(year), x2: x(year), y1: 20, y2: 244, stroke: '#526575', 'stroke-dasharray': '3 5', opacity: .6 });
  }
  const onMetric = () => { metric = select.value; render(); };
  const onScrub = () => { stop(); index = Number(slider.value); render(); };
  const onPlay = () => { if (timer !== null) return stop(); if (index >= years.length - 1) index = 0; render(); play.textContent = 'Pause'; play.setAttribute('aria-label', 'Pause timeline'); timer = setInterval(() => { index++; render(); if (index >= years.length - 1) stop(); }, 850); };
  select.addEventListener('change', onMetric); slider.addEventListener('input', onScrub); play.addEventListener('click', onPlay);
  status.textContent = 'Run a simulation to compare timelines.';
  return {
    update(result) {
      if (destroyed) return;
      stop(); baseline = normalizeLiveTimeline(result?.baseline); current = normalizeLiveTimeline(result?.current);
      registry = result?.metricRegistry ?? result?.experiment?.outcomes?.metricRegistry ?? result?.current?.metricRegistry ?? [];
      if (!Array.isArray(registry)) registry = [];
      years = [...new Set([...baseline, ...current].map(row => row.year))].sort((a, b) => a - b);
      const keys = [...new Set([...current, ...baseline].flatMap(row => Object.keys(row.metrics)))];
      if (!keys.includes(metric)) metric = keys[0] || 'score';
      select.replaceChildren(...keys.map(key => { const option = doc.createElement('option'); option.value = key; option.textContent = registry.find(row => row.id === key)?.label || label(key); return option; })); select.value = metric;
      index = Math.max(0, years.length - 1); slider.max = String(index);
      body.hidden = !years.length || !keys.length; select.disabled = body.hidden; slider.disabled = pending || years.length < 2; play.disabled = pending || years.length < 2;
      status.textContent = body.hidden ? 'No timeline data is available. Run the time-stepped civic model to explore yearly results.' : !baseline.length || !current.length ? 'One comparison timeline is unavailable. Available results are shown.' : '';
      render();
    },
    setPending(value) { if (destroyed) return; pending = Boolean(value); root.setAttribute('aria-busy', String(pending)); stop(); slider.disabled = pending || years.length < 2; play.disabled = pending || years.length < 2; status.textContent = pending ? 'Updating simulation…' : body.hidden ? 'Run a simulation to compare timelines.' : !baseline.length || !current.length ? 'One comparison timeline is unavailable.' : ''; },
    showError(message) { if (destroyed) return; stop(); pending = false; root.setAttribute('aria-busy', 'false'); status.textContent = String(message || 'The simulation could not be completed.'); slider.disabled = years.length < 2; play.disabled = years.length < 2; },
    destroy() { if (destroyed) return; destroyed = true; stop(); select.removeEventListener('change', onMetric); slider.removeEventListener('input', onScrub); play.removeEventListener('click', onPlay); root.remove(); },
  };
}
