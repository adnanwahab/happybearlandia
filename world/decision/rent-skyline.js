// Presentation only: each member is a completed Decision run, never a household.
export const RENT_EDGES = Object.freeze([0, 500, 1000, 1500, 2000, 2500, 3000, 4000, Infinity]);
export function rentSkyline(runs = []) {
  const bins = RENT_EDGES.slice(0, -1).map((min, i) => ({min, max: RENT_EDGES[i + 1], members: []}));
  const ids = new Set(); let missing = 0;
  for (const run of runs) {
    if (ids.has(run.id)) throw new Error('Duplicate run identity');
    ids.add(run.id);
    const value = run.metrics?.median_rent;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) { missing++; continue; }
    bins.find(bin => value >= bin.min && value < bin.max).members.push(run);
  }
  return {bins, denominator: runs.length, missing, supported: runs.length - missing};
}
export function mountRentSkyline(host, onSelectRun) {
  const doc = host.ownerDocument;
  host.className = 'dv-panel rent-skyline'; host.dataset.testid = 'rent-skyline';
  host.innerHTML = `<h3>Walk through the rent skyline</h3><p>Computed synthetic futures · final-horizon median rent, base-year USD/month. Height counts completed simulation samples, never homes or people. Household income/rent cohorts: unavailable.</p><p>These extruded chart bars are abstract geometry, separate from the geographic map. No observed household distribution or decorative buildings are supplied.</p><p role="status" data-skyline-status></p><label>Scenario cohort <select aria-label="Skyline scenario"></select></label><div class="dv-controls"><button data-step="-1">Step left</button><button data-step="1">Step right</button><label>Walk inside <input aria-label="Walk inside skyline" type="range" min="0" max="180" value="0"></label></div><div class="rent-viewport"><div class="rent-bars"></div></div><p data-bin-status role="status"></p><div data-members></div>`;
  let data, selected = 0, offset = 0, destroyed = false;
  const select = host.querySelector('select'), bars = host.querySelector('.rent-bars'), status = host.querySelector('[data-skyline-status]');
  const range = host.querySelector('input');
  const label = bin => `${bin.min}–${bin.max === Infinity ? '∞' : bin.max} USD/month`;
  function position() { bars.style.transform = `translateZ(${range.value}px) translateX(${-offset * 60}px) rotateY(-15deg)`; }
  function choose(index) {
    selected = index;
    const bin = data.bins[index];
    host.querySelector('[data-bin-status]').textContent = `${label(bin)} · ${bin.members.length} simulation samples. Lower bound inclusive, upper bound exclusive.`;
    const members = host.querySelector('[data-members]'); members.replaceChildren();
    for (const run of bin.members) {
      const button = doc.createElement('button'); button.textContent = `${run.id} · seed ${run.seed} · ${run.metrics.median_rent.toFixed(2)} USD/month`;
      button.dataset.skylineRun = run.id; members.append(button);
    }
    for (const button of bars.children) button.setAttribute('aria-pressed', String(Number(button.dataset.bin) === index));
  }
  function render() {
    if (destroyed) return;
    data = rentSkyline((dataSource.runs || []).filter(run => run.scenarioId === select.value));
    status.textContent = `${data.supported} supported + ${data.missing} missing = ${data.denominator} completed samples. Experiment ${dataSource.experiment?.id || 'unavailable'} · model ${dataSource.experiment?.modelVersion || 'unavailable'} · rules ${dataSource.experiment?.engineVersion || 'unavailable'}. Fixed rent bins v1 across scenarios and experiments. Failed/incompatible runs excluded upstream. Heights use 12 CSS px per sample; scroll for tall bars.`;
    bars.replaceChildren();
    for (const [index, bin] of data.bins.entries()) {
      const button = doc.createElement('button'); button.dataset.bin = String(index);
      button.textContent = `${label(bin)}: ${bin.members.length}`;
      button.style.height = `${Math.max(2, bin.members.length * 12)}px`;
      button.setAttribute('aria-label', `${label(bin)}: ${bin.members.length} samples`); bars.append(button);
    }
    choose(selected); position();
  }
  let dataSource = {runs: []};
  const change = () => { selected = 0; render(); };
  const click = event => {
    const bin = event.target.closest('[data-bin]'); if (bin) choose(Number(bin.dataset.bin));
    const step = event.target.closest('[data-step]'); if (step) { offset = Math.max(0, Math.min(7, offset + Number(step.dataset.step))); position(); }
    const member = event.target.closest('[data-skyline-run]');
    if (member) onSelectRun?.(data.bins[selected].members.find(run => run.id === member.dataset.skylineRun));
  };
  select.addEventListener('change', change); host.addEventListener('click', click); range.addEventListener('input', position);
  render();
  return {
    update(next) {
      if (destroyed) return;
      dataSource = next;
      const prior = select.value; select.replaceChildren();
      for (const scenario of next.experiment?.scenarios || []) { const option = doc.createElement('option'); option.value = scenario.id; option.textContent = scenario.name || scenario.id; select.append(option); }
      if ([...select.options].some(option => option.value === prior)) select.value = prior;
      render();
    },
    destroy() { destroyed = true; select.removeEventListener('change', change); host.removeEventListener('click', click); range.removeEventListener('input', position); dataSource = {runs: []}; data = null; host.replaceChildren(); },
  };
}
