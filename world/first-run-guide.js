/**
 * Small, model-observant first-run guide for /world.
 * It never runs a second simulation, assigns causes, or writes simulation state.
 * The World owner supplies actions and reports actual results through events.
 */
export const QUICK_DEMO_URL =
  '/world?lat=29.7286&lng=-95.4746&people=120&demo=1&synthetic=0&autoplay=1&quick=1';

export function deltaLabel(before, after, {digits = 1, unit = ''} = {}) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return 'Unavailable';
  const delta = after - before;
  const value = Math.abs(delta) < Math.pow(10, -digits) / 2 ? 0 : delta;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const suffix = unit ? ' ' + unit : '';
  return sign + Math.abs(value).toFixed(digits) + suffix;
}

export function weekComparisonSummary(result = {}) {
  const before = result?.avg?.noPlan;
  const after = result?.avg?.withPlan;
  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    return {title: 'Comparison incomplete', description: 'Matched weekly well-being records are unavailable.', metrics: []};
  }
  const people = [
    Number.isFinite(result.improved) ? {label:'Residents better off', value:String(result.improved)} : null,
    Number.isFinite(result.worse) ? {label:'Residents worse off', value:String(result.worse)} : null,
  ].filter(Boolean);
  return {
    title: 'A week, two futures',
    description: 'Same starting town and seed: with the chosen plan versus without it. These are synthetic model results.',
    metrics: [
      {label:'Without plan', value:before.toFixed(1)},
      {label:'With plan', value:after.toFixed(1)},
      {label:'Well-being difference', value:deltaLabel(before, after)},
      ...people,
    ],
  };
}

function node(doc, name, className, text) {
  const el = doc.createElement(name);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

/**
 * @param {{doc?: Document, root?: HTMLElement, win?: Window, storage?: Storage}} options
 * @returns {{destroy:()=>void, setReady:(boolean)=>void, publish:(object)=>void}}
 */
export function mountWorldFirstRunGuide({doc = document, root = doc.body, win = doc.defaultView, storage} = {}) {
  if (!root || !doc || !win) throw new TypeError('A document, root and window are required');
  if (!storage) try { storage = win.localStorage; } catch { /* Storage may be disabled. */ }
  const panel = node(doc, 'aside', 'world-first-run-guide');
  panel.id = 'world-first-run-guide';
  panel.dataset.testid = 'world-first-run-guide';
  panel.setAttribute('aria-label', 'Start exploring the world');
  panel.innerHTML = `
    <div class="world-guide-top">
      <div><span class="world-guide-eyebrow">START HERE</span><h2>Make the city change.</h2></div>
      <button type="button" data-guide-toggle aria-expanded="true" aria-controls="world-guide-content">Minimize</button>
    </div>
    <div id="world-guide-content">
      <p class="world-guide-intro">Three experiments. Each one shows what the simulator actually recorded.</p>
      <a class="world-guide-demo" data-guide-quick href="${QUICK_DEMO_URL}">▶ Play a short narrated demo <span>↗</span></a>
      <div class="world-guide-options">
        <button type="button" data-guide-action="week" disabled><strong>1 · Compare one week</strong><span>Balanced plan vs no plan, matched starting town</span></button>
        <button type="button" data-guide-action="storm" disabled><strong>2 · Run a storm</strong><span>Watch flooded buildings and displaced residents</span></button>
        <button type="button" data-guide-action="tenYear" disabled><strong>3 · Explore ten years</strong><span>Compare longitudinal package outcomes</span></button>
      </div>
      <button type="button" data-guide-action="resident" class="world-guide-secondary" disabled>Inspect a resident →</button>
      <p class="world-guide-ready" data-guide-ready role="status">Loading city controls…</p>
    </div>
    <section class="world-guide-feedback" aria-label="What changed">
      <div class="world-guide-feedback-heading"><strong>What changed?</strong><span data-guide-kind>Ready</span></div>
      <p data-guide-message role="status" aria-live="polite">Run an experiment to see its actual results here.</p>
      <dl data-guide-metrics></dl>
      <small data-guide-live>Live mood and activity observations will appear when the world is ready.</small>
      <button type="button" data-guide-open-result hidden>Open full results</button>
    </section>
  `;
  root.append(panel);

  const $ = selector => panel.querySelector(selector);
  const buttons = [...panel.querySelectorAll('[data-guide-action]')];
  const metrics = $('[data-guide-metrics]');
  const message = $('[data-guide-message]');
  const kind = $('[data-guide-kind]');
  const live = $('[data-guide-live]');
  const resultButton = $('[data-guide-open-result]');
  const toggle = $('[data-guide-toggle]');
  const readyText = $('[data-guide-ready]');
  let ready = false, destroyed = false, last = null, playStart = null, playback = null, unsubscribe = [];
  let collapsed = false;
  try { collapsed = storage?.getItem('hbl:world:guide-minimized-v1') === '1'; } catch { /* Storage is optional. */ }

  function setCollapsed(value) {
    collapsed = Boolean(value);
    panel.classList.toggle('is-collapsed', collapsed);
    toggle.textContent = collapsed ? 'Try this →' : 'Minimize';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    $('#world-guide-content').hidden = collapsed;
    try { storage?.setItem('hbl:world:guide-minimized-v1', collapsed ? '1' : '0'); } catch {}
  }
  toggle.addEventListener('click', () => setCollapsed(!collapsed));
  setCollapsed(collapsed);

  function renderMetrics(items = []) {
    metrics.replaceChildren(...items.slice(0, 6).flatMap(item => [
      node(doc, 'dt', null, item.label),
      node(doc, 'dd', null, item.value ?? 'Unavailable'),
    ]));
  }

  function publish(detail) {
    if (destroyed || !detail || typeof detail !== 'object') return;
    if (detail.type === 'snapshot') {
      if (!Number.isFinite(detail.mood)) return;
      const snapshot = {
        mode: detail.mode || 'legacy', mood:detail.mood,
        minute:Number.isFinite(detail.minute)?detail.minute:null,
        clock:String(detail.clock || ''), activity:String(detail.activity || ''),
      };
      if (last?.mode !== snapshot.mode) playStart = null;
      last = snapshot;
      let text = `${snapshot.mode === 'living' ? 'Modeled utility' : 'Mood'} ${snapshot.mood.toFixed(0)} · ${snapshot.clock || 'simulation running'}`;
      if (playback && playStart?.mode === snapshot.mode) {
        text += ` · since ${playback.paused ? 'pause' : 'Play'}: ${deltaLabel(playStart.mood, snapshot.mood, {digits:0})} points`;
      }
      live.textContent = text + (snapshot.activity ? ` · ${snapshot.activity}` : '');
      return;
    }
    if (detail.type === 'playback') {
      playback = {paused:Boolean(detail.paused), speed:Number(detail.speed)||1};
      playStart = last ? {...last} : null;
      kind.textContent = 'Playback';
      message.textContent = playback.paused
        ? 'Paused. Your city state is not advancing.'
        : `Playing at ${playback.speed}×. Live mood and activity below are observations, not a controlled policy effect.`;
      renderMetrics([]);
      resultButton.hidden = true;
      return;
    }
    kind.textContent = String(detail.label || 'Simulation');
    message.textContent = String(detail.message || 'No result recorded yet.');
    renderMetrics(Array.isArray(detail.metrics) ? detail.metrics : []);
    resultButton.hidden = true;
    const resultId = detail.resultId;
    if (typeof resultId === 'string' && ['cyclePanel','experimentPanel'].includes(resultId)) {
      // Keep measured feedback visible without covering the full comparison panel.
      setCollapsed(true);
      resultButton.hidden = false;
      resultButton.onclick = () => {
        const target = doc.getElementById(resultId);
        if (!target) return;
        if (resultId === 'cyclePanel' && target.style.display === 'none') doc.getElementById('cycleShowBtn')?.click();
        target.scrollIntoView({block:'nearest',behavior:'instant'});
      };
    }
  }

  async function invoke(name) {
    if (destroyed || !ready) return;
    const action = win.hblGuidedActions?.[name];
    if (typeof action !== 'function') return;
    const button = $('[data-guide-action="' + name + '"]');
    button.disabled = true;
    publish({type:'working',label:'Running',message:'Starting the selected experiment…'});
    try {
      await action();
      if (name === 'resident') setCollapsed(true);
    } catch (error) {
      publish({type:'error',label:'Could not start',message:String(error?.message || error)});
    } finally {
      if (!destroyed) button.disabled = false;
    }
  }

  for (const button of buttons) button.addEventListener('click', () => invoke(button.dataset.guideAction));
  function setReady(value) {
    ready = Boolean(value);
    for (const button of buttons) button.disabled = !ready;
    readyText.textContent = ready ? 'Ready. Results below come from the current simulation.' : 'Loading city controls…';
  }
  const onReady = () => setReady(Boolean(win.hblGuidedActions));
  const onFeedback = event => publish(event.detail);
  win.addEventListener('hbl:world-ready', onReady);
  win.addEventListener('hbl:world-feedback', onFeedback);
  unsubscribe = [
    () => win.removeEventListener('hbl:world-ready', onReady),
    () => win.removeEventListener('hbl:world-feedback', onFeedback),
  ];
  onReady();
  return {
    setReady, publish,
    destroy() { destroyed = true; for (const remove of unsubscribe) remove(); panel.remove(); },
  };
}

if (typeof document !== 'undefined' && document.body) {
  const params = new URL(location.href).searchParams;
  const disallowed = params.get('embed') === '1' || params.get('business_mode') === '1' ||
    params.get('business_mode') === 'true' || params.has('experiment') || params.has('simulation') ||
    params.get('autoplay') === '1';
  if (!disallowed) mountWorldFirstRunGuide();
}
