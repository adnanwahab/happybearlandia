/** Actual paired-run playback: no screenshot, prediction or interpolated actor state.
 * Each frame is a recorded checkpoint from the detached comparison worker. */
const finite = Number.isFinite;
const METRIC_NAMES = {
  meanCommuteMinutes: ['Planned travel', 'minutes/trip'],
  meanExperiencedTravelMinutes: ['Experienced travel', 'minutes/trip'],
  trips: ['Planned trips', 'trips'],
  completedTrips: ['Completed trips', 'trips'],
  deniedBoardings: ['Denied boardings', 'boardings'],
  employmentRate: ['Employed workers', 'fraction'],
  meanHousingBurden: ['Mean housing burden', 'fraction'],
  modeledUtility: ['Modeled utility', 'model units'],
  meanRent: ['Mean rent', 'synthetic USD/month'],
  meanRentBurden: ['Household rent burden', 'fraction'],
  housingUnits: ['Built housing units', 'units'],
  availableUnits: ['Available units', 'units'],
  entitledCapacity: ['Permitted capacity (not built units)', 'capacity units'],
  completedProjects: ['Completed projects', 'projects'],
  meanSavings: ['Mean household savings', 'synthetic USD'],
  jobs: ['Job positions', 'jobs'],
  balance: ['Treasury balance', 'synthetic USD']
};
const FIELDS = {
  population: ['activity', 'mode', 'commuteMinutes', 'employmentStatus', 'homeDistrictId', 'workDistrictId', 'x', 'z'],
  city: ['districtId', 'unitId', 'monthlyIncome', 'monthlyRent', 'savings', 'unhoused']
};
const FIELD_LABELS = {
  activity: 'Activity', mode: 'Travel mode', commuteMinutes: 'Commute (minutes)',
  employmentStatus: 'Employment', homeDistrictId: 'Home district', workDistrictId: 'Work district',
  x: 'Local x', z: 'Local z', districtId: 'District', unitId: 'Housing unit',
  monthlyIncome: 'Income (synthetic USD/month)', monthlyRent: 'Rent (synthetic USD/month)',
  savings: 'Savings (synthetic USD)', unhoused: 'Without assigned unit'
};
const number = value => finite(value)
  ? new Intl.NumberFormat(undefined, {maximumFractionDigits: 2}).format(value)
  : value == null ? 'Unavailable' : String(value);
const timeOf = (frame, unit) => (unit === 'month' ? 'Month ' : 'Minute ') + number(frame.time);

/** Reject unpaired and mismatched clocks. Missing points remain missing. */
export function pairedLawFrames(result) {
  if (result?.status !== 'completed' || result?.supported === false ||
      result?.comparable === false || result?.analysis?.comparison?.comparable === false ||
      !result?.manifest?.pairedInitialState) return [];
  const engine = result.engine;
  if (engine !== 'population' && engine !== 'city') return [];
  const unit = engine === 'city' ? 'month' : 'minute';
  const left = result.baseline?.timeline, right = result.selected?.timeline;
  if (!Array.isArray(left) || !Array.isArray(right)) return [];
  const treatmentByTime = new Map(right.filter(row => finite(row?.[unit])).map(row => [row[unit], row]));
  const seen = new Set(), frames = [];
  for (const before of left) {
    if (!finite(before?.[unit]) || seen.has(before[unit])) continue;
    const after = treatmentByTime.get(before[unit]);
    if (!after) continue;
    seen.add(before[unit]);
    frames.push({
      engine, unit, time: before[unit],
      baseline: before.metrics || {}, treatment: after.metrics || {},
      baselineActors: Array.isArray(before.actors) ? before.actors : [],
      treatmentActors: Array.isArray(after.actors) ? after.actors : []
    });
  }
  return frames.sort((a, b) => a.time - b.time);
}

export function pairedLawActorChanges(frame) {
  if (!frame || !Array.isArray(frame.baselineActors) || !Array.isArray(frame.treatmentActors)) return [];
  const withLaw = new Map(frame.treatmentActors.filter(row => typeof row.id === 'string').map(row => [row.id, row]));
  return frame.baselineActors.filter(row => typeof row.id === 'string' && withLaw.has(row.id)).map(before => {
    const after = withLaw.get(before.id);
    const fields = (FIELDS[frame.engine] || []).filter(key =>
      before[key] !== undefined && after[key] !== undefined && !Object.is(before[key], after[key]));
    return {id: before.id, label: before.label || before.id, before, after, fields};
  });
}

function metricChoices(frames, result) {
  const labels = new Map((result.scorecard || []).filter(row => row?.id).map(row => [row.id, row]));
  const allKeys = new Set(frames.flatMap(frame => [
    ...Object.keys(frame.baseline), ...Object.keys(frame.treatment)
  ]));
  const preferred = Object.keys(METRIC_NAMES);
  return [...allKeys].filter(key => frames.some(frame =>
    finite(frame.baseline[key]) && finite(frame.treatment[key]))).sort((a, b) => {
    const ai = preferred.indexOf(a), bi = preferred.indexOf(b);
    return (ai < 0 ? 10000 : ai) - (bi < 0 ? 10000 : bi) || a.localeCompare(b);
  }).map(key => ({
    key,
    label: labels.get(key)?.label || METRIC_NAMES[key]?.[0] || key.replace(/([A-Z])/g, ' $1'),
    unit: labels.get(key)?.unit || METRIC_NAMES[key]?.[1] || 'model units'
  }));
}

function preferredMetric(choices, frames) {
  return choices.find(choice => frames.some(frame =>
    finite(frame.baseline[choice.key]) && finite(frame.treatment[choice.key]) &&
    Math.abs(frame.treatment[choice.key] - frame.baseline[choice.key]) > 1e-8))?.key
    || choices[0]?.key || '';
}

function add(parent, tag, text, className) {
  const el = parent.ownerDocument.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  parent.append(el);
  return el;
}

function svgElement(doc, tag, attrs = {}, text) {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderChart(container, frames, metric, currentIndex) {
  container.replaceChildren();
  if (!metric || frames.length < 2 ||
      frames.some(frame => !finite(frame.baseline[metric]) || !finite(frame.treatment[metric]))) {
    add(container, 'p', 'No complete recorded paired series for this metric. Missing observations are not filled in.');
    return;
  }
  const doc = container.ownerDocument, all = frames.flatMap(frame =>
    [frame.baseline[metric], frame.treatment[metric]]);
  const min = Math.min(...all), max = Math.max(...all), spread = max - min || 1;
  const first = frames[0].time, duration = frames.at(-1).time - first || 1;
  const x = time => 26 + 468 * (time - first) / duration;
  const y = value => 136 - 105 * (value - min) / spread;
  const svg = svgElement(doc, 'svg', {viewBox: '0 0 520 165', role: 'img',
    'aria-label': 'Recorded baseline and edited policy outcome lines on the same time and value axes'});
  svg.append(svgElement(doc, 'line', {x1: 26, y1: 136, x2: 495, y2: 136, class: 'law-behavior-axis'}));
  for (const [field, style] of [['baseline', 'base'], ['treatment', 'edited']]) {
    const points = frames.map(frame => x(frame.time).toFixed(2) + ',' + y(frame[field][metric]).toFixed(2)).join(' ');
    svg.append(svgElement(doc, 'polyline', {points, class: 'law-behavior-line law-behavior-' + style}));
    for (const frame of frames) svg.append(svgElement(doc, 'circle', {
      cx: x(frame.time), cy: y(frame[field][metric]), r: 1.6,
      class: 'law-behavior-dot law-behavior-' + style
    }));
  }
  const t = frames[currentIndex].time;
  svg.append(svgElement(doc, 'line', {x1: x(t), x2: x(t), y1: 19, y2: 136, class: 'law-behavior-cursor'}));
  svg.append(svgElement(doc, 'text', {x: 27, y: 19, class: 'law-behavior-chart-text'}, number(max)));
  svg.append(svgElement(doc, 'text', {x: 27, y: 155, class: 'law-behavior-chart-text'}, number(min)));
  container.append(svg);
}

function localBounds(frames) {
  const actors = frames.flatMap(frame => [...frame.baselineActors, ...frame.treatmentActors])
    .filter(row => finite(row.x) && finite(row.z));
  if (!actors.length) return null;
  const xs = actors.map(row => row.x), zs = actors.map(row => row.z);
  return {minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)};
}

function renderPeopleMap(container, actors, paired, bounds, lane) {
  container.replaceChildren();
  if (!bounds) return;
  const svg = svgElement(container.ownerDocument, 'svg', {viewBox: '0 0 245 134', role: 'img',
    'aria-label': (lane === 'base' ? 'Without law' : 'With edited law') +
      ': actual modeled local positions of up to twelve tracked synthetic actors'});
  const width = Math.max(1, bounds.maxX - bounds.minX),
    depth = Math.max(1, bounds.maxZ - bounds.minZ);
  svg.append(svgElement(container.ownerDocument, 'rect', {x: 8, y: 8, width: 229, height: 118,
    rx: 9, class: 'law-behavior-map-background'}));
  for (const row of actors) {
    if (!finite(row.x) || !finite(row.z)) continue;
    const change = paired.get(row.id);
    const dot = svgElement(container.ownerDocument, 'circle', {
      cx: 19 + 205 * (row.x - bounds.minX) / width,
      cy: 19 + 96 * (row.z - bounds.minZ) / depth,
      r: change?.fields.length ? 5 : 3,
      class: 'law-behavior-person ' + (change?.fields.length ? 'law-behavior-person-changed ' : '') + 'law-behavior-' + lane
    });
    dot.append(svgElement(container.ownerDocument, 'title', {}, (row.label || row.id) + ': ' +
      (row.activity || 'activity unavailable') + ', ' + (row.mode || 'mode unavailable')));
    svg.append(dot);
  }
  container.append(svg);
}

function renderActorDetails(container, frame) {
  container.replaceChildren();
  const pairs = pairedLawActorChanges(frame);
  if (!pairs.length) {
    add(container, 'p', 'No matched model actor records at this checkpoint; behavior is unavailable.');
    return;
  }
  const changed = pairs.filter(row => row.fields.length);
  const summary = changed.length + ' of ' + pairs.length + ' tracked synthetic ' +
    (frame.engine === 'city' ? 'households' : 'residents') + ' differ at this recorded checkpoint.';
  add(container, 'p', summary, 'law-behavior-actor-summary');
  if (!changed.length) {
    add(container, 'p', 'Unchanged in this bounded sample does not establish zero population-wide effect.');
    return;
  }
  for (const row of changed.slice(0, 6)) {
    const article = add(container, 'article', undefined, 'law-behavior-actor');
    add(article, 'strong', row.label);
    for (const field of row.fields.filter(key => key !== 'x' && key !== 'z').slice(0, 3)) {
      add(article, 'p', (FIELD_LABELS[field] || field) + ': ' +
        number(row.before[field]) + ' → ' + number(row.after[field]));
    }
    if (row.fields.includes('x') || row.fields.includes('z')) {
      add(article, 'p', 'Local modeled position: (' + number(row.before.x) + ', ' + number(row.before.z) +
        ') → (' + number(row.after.x) + ', ' + number(row.after.z) + ')');
    }
  }
  if (changed.length > 6) add(container, 'p', (changed.length - 6) + ' additional changed tracked actors not listed.');
}

/** Mount one playback viewer. Updates use only completed, paired worker results. */
export function mountLawBehaviorPlayback(container) {
  if (!container?.ownerDocument) throw new TypeError('Playback needs a DOM container.');
  const doc = container.ownerDocument, win = doc.defaultView || globalThis;
  const root = add(container, 'section', undefined, 'law-behavior-playback');
  root.dataset.testid = 'law-behavior-playback';
  root.hidden = true;
  add(root, 'h3', 'Watch the modeled behavior change');
  add(root, 'p', 'Recorded synthetic simulation checkpoints, not screenshots or a real-world forecast. ' +
    'Both worlds start from the same initial state and random seed. No intermediate states are invented.',
    'law-behavior-disclaimer');
  const provenance = add(root, 'p', '', 'law-behavior-provenance');
  const controls = add(root, 'div', undefined, 'law-behavior-controls');
  const metricLabel = add(controls, 'label', 'Outcome ');
  const metricSelect = add(metricLabel, 'select');
  metricSelect.setAttribute('aria-label', 'Recorded outcome');
  const timeLabel = add(controls, 'label', 'Recorded time ');
  const scrub = add(timeLabel, 'input');
  scrub.type = 'range'; scrub.min = '0'; scrub.step = '1'; scrub.value = '0';
  scrub.setAttribute('aria-label', 'Recorded simulation checkpoint');
  const replay = add(controls, 'button', '▶ Play recorded frames');
  replay.type = 'button';
  const clock = add(root, 'p', '', 'law-behavior-clock');
  const lanes = add(root, 'div', undefined, 'law-behavior-lanes');
  const left = add(lanes, 'section', undefined, 'law-behavior-lane law-behavior-lane-base');
  const right = add(lanes, 'section', undefined, 'law-behavior-lane law-behavior-lane-edited');
  add(left, 'h4', 'World A · current rules');
  add(right, 'h4', 'World B · edited law');
  const beforeValue = add(left, 'p', '', 'law-behavior-number');
  const afterValue = add(right, 'p', '', 'law-behavior-number');
  const beforeMap = add(left, 'div', undefined, 'law-behavior-map');
  const afterMap = add(right, 'div', undefined, 'law-behavior-map');
  const deltaText = add(root, 'p', '', 'law-behavior-delta');
  const referenceText = add(root, 'p', '', 'law-behavior-reference');
  const chart = add(root, 'div', undefined, 'law-behavior-chart');
  const legend = add(root, 'p', '● Current rules    ● Edited law · plotted lines connect recorded samples, not simulated intermediate states.',
    'law-behavior-legend');
  const actorHeading = add(root, 'h4', 'What individual simulated actors actually did');
  const actors = add(root, 'div', undefined, 'law-behavior-actors');
  add(root, 'p', 'Actor details cover at most 12 stable synthetic IDs, not the entire model population. ' +
    'Time samples and local positions are model states, not a street map or verified people. ' +
    'An unchanged or missing observation is never replaced with an assumed benefit.',
    'law-behavior-disclaimer');
  let frames = [], choices = [], index = 0, timer = null, result = null, reference = null, bounds = null;
  function stop() {
    if (timer !== null) win.clearInterval(timer);
    timer = null; replay.textContent = '▶ Play recorded frames';
  }
  function render() {
    if (!frames.length) return;
    const frame = frames[index], metric = metricSelect.value;
    const choice = choices.find(row => row.key === metric);
    scrub.max = String(frames.length - 1);
    scrub.value = String(index);
    clock.textContent = timeOf(frame, frame.unit) + ' · checkpoint ' + (index + 1) + '/' + frames.length;
    beforeValue.textContent = number(frame.baseline[metric]) + (choice ? ' ' + choice.unit : '');
    afterValue.textContent = number(frame.treatment[metric]) + (choice ? ' ' + choice.unit : '');
    const a = frame.baseline[metric], b = frame.treatment[metric];
    deltaText.textContent = finite(a) && finite(b)
      ? 'Recorded paired difference: ' + number(b - a) + ' ' + (choice?.unit || 'model units') +
        ' (edited − current rules).'
      : 'Paired difference unavailable: a required observation is missing.';
    const matchingReference = reference?.manifest?.seed === result?.manifest?.seed &&
      reference?.manifest?.modelVersion === result?.manifest?.modelVersion &&
      reference?.manifest?.population === result?.manifest?.population &&
      reference?.engine === result?.engine;
    const referenceAtTime = matchingReference ? reference.selected?.timeline?.find(
      row => row[frame.unit] === frame.time) : null;
    referenceText.textContent = referenceAtTime && finite(referenceAtTime.metrics?.[metric])
      ? 'Original 100% reviewed setting at this same checkpoint: ' +
        number(referenceAtTime.metrics[metric]) + ' ' + (choice?.unit || 'model units') +
        '. The original paired run is retained for comparison.'
      : '';
    const pair = new Map(pairedLawActorChanges(frame).map(row => [row.id, row]));
    renderPeopleMap(beforeMap, frame.baselineActors, pair, bounds, 'base');
    renderPeopleMap(afterMap, frame.treatmentActors, pair, bounds, 'edited');
    renderChart(chart, frames, metric, index);
    renderActorDetails(actors, frame);
    actorHeading.textContent = frame.engine === 'city'
      ? 'Household state differences · recorded city model'
      : 'Resident activity, travel and position · recorded population model';
  }
  function play() {
    if (timer !== null) { stop(); return; }
    if (frames.length < 2) return;
    if (index === frames.length - 1) index = 0;
    render(); replay.textContent = 'Ⅱ Pause playback';
    const delay = Math.max(90, Math.min(700, Math.round(6500 / (frames.length - 1))));
    timer = win.setInterval(() => {
      if (index >= frames.length - 1) { stop(); return; }
      index++; render();
      if (index === frames.length - 1) stop();
    }, delay);
  }
  const onScrub = () => { stop(); index = Number(scrub.value); render(); };
  const onMetric = () => { stop(); render(); };
  const onPlay = () => play();
  scrub.addEventListener('input', onScrub);
  metricSelect.addEventListener('change', onMetric);
  replay.addEventListener('click', onPlay);
  return {
    update(value, {referenceResult = null, autoplay = true} = {}) {
      stop(); frames = pairedLawFrames(value); result = value; reference = referenceResult;
      root.hidden = !frames.length;
      if (!frames.length) return;
      bounds = localBounds(frames);
      choices = metricChoices(frames, value);
      metricSelect.replaceChildren();
      for (const choice of choices) {
        const option = add(metricSelect, 'option', choice.label + ' · ' + choice.unit);
        option.value = choice.key;
      }
      metricSelect.value = preferredMetric(choices, frames);
      const manifest = value.manifest || {};
      provenance.textContent = 'Paired seed ' + number(manifest.seed) + ' · ' +
        number(manifest.population) + ' synthetic actors · ' + frames.length +
        ' recorded checkpoints · implementation strength ' +
        Math.round((manifest.implementationStrength ?? 1) * 100) + '% · ' +
        (manifest.modelVersion || 'model version unavailable') + '.';
      index = 0; render();
      if (autoplay && frames.length > 1 && !win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) play();
      else { index = frames.length - 1; render(); }
    },
    clear() {
      stop(); frames = []; result = null; reference = null; bounds = null;
      root.hidden = true;
      chart.replaceChildren(); actors.replaceChildren();
    },
    destroy() {
      stop(); scrub.removeEventListener('input', onScrub);
      metricSelect.removeEventListener('change', onMetric);
      replay.removeEventListener('click', onPlay); root.remove();
    }
  };
}
