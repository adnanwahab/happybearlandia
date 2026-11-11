const number = value => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : 'Unavailable';
export function mountFirstRunGuide({ container, onQuickDemo, onStop, onReplay, onInspect, onCompare, onStorm, onTour, onExperiment, panelManager, announce } = {}) {
  if (!container?.ownerDocument) throw new Error('First-run guide requires a DOM container');
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.id = 'firstRunGuide';
  root.className = 'first-run-guide';
  root.setAttribute('aria-labelledby', 'firstRunGuideTitle');
  const make = (tag, text, parent = root) => { const node = doc.createElement(tag); node.textContent = text; parent.append(node); return node; };
  make('p', 'START HERE');
  const title = make('h2', 'Make the city change'); title.id = 'firstRunGuideTitle';
  make('p', 'Follow a resident, compare a matched week, then inspect the evidence.');
  const status = make('p', 'Waiting for the city…'); status.dataset.testid = 'quick-demo-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const actions = make('div', ''); actions.className = 'first-run-actions';
  let state = {}, disposed = false;
  const listeners = [];
  const button = (label, testid, callback) => {
    const node = make('button', label, actions); node.type = 'button'; node.disabled = !callback; if (testid) node.dataset.testid = testid;
    const handler = () => { if (disposed || node.disabled || !callback) return; try { Promise.resolve(callback(state)).catch(error => update({ status: 'error', error: error?.message || String(error) })); } catch (error) { update({ status: 'error', error: error.message }); } };
    node.addEventListener('click', handler); listeners.push(() => node.removeEventListener('click', handler)); return node;
  };
  const quick = button('Play quick demo', 'quick-demo', onQuickDemo);
  const stop = button('Stop', 'quick-demo-stop', onStop);
  const replay = button('Replay comparison', 'quick-demo-replay', onReplay);
  const inspect = button('Inspect resident', 'quick-demo-inspect', onInspect);
  button('Compare a week', null, onCompare); button('Run a storm', null, onStorm);
  button('Full civic tour', null, onTour); button('Explore 10 years', null, onExperiment);
  const details = make('div', ''); details.className = 'first-run-feedback';
  const heading = make('h3', 'What changed?', details), body = make('p', 'Choose an action to inspect its evidence.', details);
  const source = make('p', '', details); source.className = 'first-run-source';
  const close = button('Dismiss', null, () => hide()); close.setAttribute('aria-label', 'Dismiss Start here');
  container.append(root); panelManager?.register('guide', root);
  function update(next = {}) {
    if (disposed) return;
    state = { ...state, ...next };
    const busy = ['waiting', 'observing', 'computing', 'revealing'].includes(state.status);
    quick.disabled = state.ready !== true || busy || !onQuickDemo;
    stop.disabled = !busy || !onStop;
    replay.disabled = state.ready !== true || busy || !onReplay;
    replay.textContent = state.status === 'error' ? 'Retry comparison' : 'Replay comparison';
    inspect.disabled = !onInspect || !(state.observation || state.feedback?.resident);
    const progress = state.progress;
    const text = state.status === 'error' ? `Comparison failed: ${state.error?.message || state.error || 'Unknown error'}. Retry when ready.`
      : state.status === 'stopped' ? 'Stopped. Replay starts a fresh matched comparison.'
      : state.status === 'completed' ? 'Comparison complete. Inspect a resident or replay.'
      : busy ? `${state.status === 'computing' ? 'Comparing matched futures' : state.status}…${progress?.stage ? ` ${progress.stage}` : ''}${typeof progress?.fraction === 'number' && Number.isFinite(progress.fraction) ? ` ${Math.round(Math.max(0, Math.min(1, progress.fraction)) * 100)}%` : ''}`
      : state.ready === true ? 'City ready. Play the quick demo.' : 'Waiting for the city…';
    if (status.textContent !== text) { status.textContent = text; announce?.(text); }
    const f = state.feedback || state.observation;
    if (!f) return;
    heading.textContent = f.label || f.title || 'What changed?';
    if (f.kind === 'matched') body.textContent = f.available
      ? `${f.controlLabel || 'No plan'}: ${number(f.noPlan)}. ${f.planLabel || 'With plan'}: ${number(f.withPlan)}. Difference: ${number(f.delta)} ${f.unit}. Improved: ${f.improved ?? 'Unavailable'} residents; worse: ${f.worse ?? 'Unavailable'} residents. ${f.text}${f.unsupported?.length ? ` Not simulated: ${f.unsupported.join(', ')}.` : ''}`
      : `Matched values unavailable. ${f.text}`;
    else if (f.activity) body.textContent = `${f.name}: ${f.activity}. Mood: ${number(f.mood)} / 100. ${f.text}`;
    else if ('displacedResidents' in f) body.textContent = `Flooded parcels: ${f.floodedParcels ?? 'Unavailable'}. Displaced residents: ${f.displacedResidents ?? 'Unavailable'}. ${f.text}`;
    else body.textContent = f.text || '';
    source.textContent = [f.source, f.seed != null ? `Seed: ${f.seed}` : 'Seed unavailable', f.minute != null ? `Playback minute: ${f.minute}` : null, f.days != null ? `Horizon: ${f.days} days` : null, f.year != null ? `Policy implementation year: ${f.year}` : null, f.provenance?.modelVersion ? `Model: ${f.provenance.modelVersion}` : null].filter(Boolean).join(' · ');
  }
  function show() { if (disposed) return; root.hidden = false; if (panelManager) panelManager.open('guide'); else root.style.display = ''; }
  function hide() { if (panelManager) panelManager.close('guide'); else root.hidden = true; }
  update();
  return { update, show, hide, dispose() { if (disposed) return; hide(); disposed = true; listeners.forEach(remove => remove()); root.remove(); } };
}
