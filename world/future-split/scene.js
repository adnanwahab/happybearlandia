const SVG = 'http://www.w3.org/2000/svg';
const WIDTH = 620;
const HEIGHT = 350;
const DISTRICT_CENTERS = [[310, 100], [145, 238], [475, 238]];
const LABELS = { unchanged: 'Unchanged', added: 'New', modified: 'Changed', removed: 'Removed' };
const MODES = [['side', 'Side by side'], ['wipe', 'Wipe'], ['switch', 'A/B switch']];
const ARMS = { baseline: 'Future A', intervention: 'Future B' };
let nextSceneId = 0;

function node(document, tag, attributes = {}, parent) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  parent?.append(element);
  return element;
}

function text(document, parent, x, y, value, className) {
  const element = node(document, 'text', { x, y, class: className }, parent);
  element.textContent = value;
  return element;
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.codePointAt(0), 16777619);
  return result >>> 0;
}

function layout(frame) {
  const districts = new Map(frame.districts.map((district, index) => [district.id, {
    ...district,
    center: DISTRICT_CENTERS[index],
  }]));
  const records = [...frame.baseline.entities, ...frame.intervention.entities];
  const routeGroups = new Map();
  for (const entity of records) {
    if (entity.kind !== 'route') continue;
    const endpoints = [entity.fromDistrictId, entity.toDistrictId].sort().join('/');
    if (!routeGroups.has(endpoints)) routeGroups.set(endpoints, new Set());
    routeGroups.get(endpoints).add(entity.id);
  }
  const routeLanes = new Map();
  for (const ids of routeGroups.values()) {
    [...ids].sort().forEach((id, index) => routeLanes.set(id, index - (ids.size - 1) / 2));
  }
  return { districts, routeLanes };
}

function districtPosition(entity, scene) {
  const district = scene.districts.get(entity.districtId);
  if (!district?.center) return null;
  const [x, y] = district.center;
  const id = entity.modelId ?? entity.id;
  const slot = hash(id);
  if (entity.kind === 'household') {
    const index = Number(id.match(/-(\d+)$/)?.[1]);
    const local = Number.isInteger(index) ? Math.floor(index / DISTRICT_CENTERS.length) : slot;
    return [x - 63 + (local % 7) * 21, y + 24 + (Math.floor(local / 7) % 2) * 14];
  }
  if (entity.kind === 'building' && id === 'building-' + district.id) return [x - 38, y + 6];
  if (entity.kind === 'building') return [x - 6 + (slot % 3) * 24, y + 6];
  return [x - 42 + (slot % 5) * 21, y - 24];
}

function routePosition(entity, { districts, routeLanes }) {
  const endpoints = [entity.fromDistrictId, entity.toDistrictId].sort();
  const a = districts.get(endpoints[0])?.center;
  const b = districts.get(endpoints[1])?.center;
  if (!a || !b) return null;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const lane = routeLanes.get(entity.id) ?? 0;
  const normalX = -dy / length * lane * 12;
  const normalY = dx / length * lane * 12;
  return {
    x1: a[0] + normalX, y1: a[1] + normalY,
    x2: b[0] + normalX, y2: b[1] + normalY,
    x: (a[0] + b[0]) / 2 + normalX,
    y: (a[1] + b[1]) / 2 + normalY,
  };
}

function paintDistrict(document, target, district) {
  const [x, y] = district.center;
  const group = node(document, 'g', { transform: `translate(${x} ${y})` }, target);
  node(document, 'path', { class: 'split-district-depth', d: 'M-98 -22 L77 -22 L98 38 L98 45 L-77 45 L-98 -15 Z' }, group);
  node(document, 'path', { class: 'split-district-top', d: 'M-98 -22 L77 -22 L98 38 L-77 38 Z' }, group);
  node(document, 'path', { class: 'split-district-grid', d: 'M-90 0H84 M-83 19H91 M-56 -22L-35 38 M-12 -22L9 38 M32 -22L53 38' }, group);
  text(document, group, 0, -38, district.name, 'split-district-label');
}

function paintRecord(document, target, entry, selectedId, arm) {
  const { entity, status, ghost, x, y, route } = entry;
  const selected = selectedId === entity.id;
  const group = node(document, 'g', {
    class: `split-entity split-${entity.kind}${ghost ? ' split-ghost' : ''}`,
    'data-entity': entity.id,
    'data-status': status,
    'data-x': x,
    'data-selected': selected,
    role: 'button',
    tabindex: 0,
    'aria-label': `${entity.label}, ${LABELS[status]}${ghost ? ' marker' : ''}, ${ARMS[arm]}`,
    'aria-pressed': selected,
  }, target);
  node(document, 'title', {}, group).textContent = `${entity.label} · ${LABELS[status]}`;
  if (route) {
    node(document, 'line', { x1: route.x1, y1: route.y1, x2: route.x2, y2: route.y2, class: 'split-route-hit' }, group);
    node(document, 'line', { x1: route.x1, y1: route.y1, x2: route.x2, y2: route.y2, class: 'split-route-line' }, group);
    node(document, 'circle', { cx: x, cy: y, r: 4, class: 'split-route-point' }, group);
    return;
  }
  const symbol = node(document, 'g', { transform: `translate(${x} ${y})` }, group);
  node(document, 'circle', { r: 11, class: 'split-symbol-hit' }, symbol);
  if (entity.kind === 'household') {
    node(document, 'circle', { r: 5, class: 'split-symbol-face' }, symbol);
  } else if (entity.kind === 'project') {
    node(document, 'path', { d: 'M0 -10 L10 0 L0 10 L-10 0 Z', class: 'split-symbol-face' }, symbol);
    node(document, 'path', { d: 'M-3 0H3 M0 -3V3', class: 'split-symbol-detail' }, symbol);
  } else {
    node(document, 'path', { d: 'M-10 -10 L0 -17 L13 -13 L4 -7 L4 12 L-10 8 Z', class: 'split-symbol-face' }, symbol);
    node(document, 'path', { d: 'M4 -7 L13 -13 L13 6 L4 12 Z', class: 'split-symbol-side' }, symbol);
    node(document, 'path', { d: 'M-6 -4 L0 -2 M-6 1 L0 3', class: 'split-symbol-detail' }, symbol);
  }
}

function paintMap(document, target, frame, scene, arm, selectedId) {
  const actual = frame[arm].entities;
  const changes = new Map(frame.changes.map(change => [change.id, change]));
  const ghosts = arm === 'intervention' ? frame.changes.filter(change => change.status === 'removed').map(change => change.before) : [];
  const entries = [...actual, ...ghosts].flatMap(entity => {
    const status = changes.get(entity.id)?.status ?? 'unchanged';
    const route = entity.kind === 'route' ? routePosition(entity, scene) : null;
    const position = route ? [route.x, route.y] : districtPosition(entity, scene);
    return position ? [{ entity, status, ghost: arm === 'intervention' && status === 'removed', x: position[0], y: position[1], route }] : [];
  });
  const districts = [...scene.districts.values()].filter(district => district.center);
  const routes = entries.filter(entry => entry.route);
  const local = entries.filter(entry => !entry.route);
  const priority = entry => Number(entry.status !== 'unchanged') + Number(entry.entity.id === selectedId);
  routes.sort((a, b) => priority(a) - priority(b)).forEach(entry => paintRecord(document, target, entry, selectedId, arm));
  districts.forEach(district => paintDistrict(document, target, district));
  local.sort((a, b) => priority(a) - priority(b)).forEach(entry => paintRecord(document, target, entry, selectedId, arm));
  const annotations = entries.filter(entry =>
    entry.entity.id === selectedId || (entry.status !== 'unchanged' && ['building', 'project'].includes(entry.entity.kind)),
  );
  for (const entry of annotations) {
    const { entity, status, x, y } = entry;
    const label = text(document, target, x, y - (entity.kind === 'building' ? 23 : 14), LABELS[status].toUpperCase(), 'split-map-note');
    label.setAttribute('data-status', status);
  }
}

function html(document, tag, className, value, parent) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value) element.textContent = value;
  parent.append(element);
  return element;
}

export function mountScene(container, { onSelect = () => {} } = {}) {
  const document = container.ownerDocument;
  const id = 'future-split-scene-' + ++nextSceneId;
  container.classList.add('split-scene');

  const toolbar = html(document, 'div', 'split-scene-toolbar', null, container);
  const modes = html(document, 'div', 'split-scene-modes', null, toolbar);
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Comparison view');
  const armControls = html(document, 'div', 'split-arm-controls', null, toolbar);
  armControls.setAttribute('role', 'group');
  armControls.setAttribute('aria-label', 'Visible future');
  const wipeControl = html(document, 'label', 'split-wipe-control', 'Reveal Future B', toolbar);
  const revealInput = html(document, 'input', null, null, wipeControl);
  revealInput.type = 'range';
  revealInput.min = 0;
  revealInput.max = 100;
  revealInput.value = 50;
  const revealOutput = html(document, 'output', null, '50%', wipeControl);
  revealOutput.setAttribute('aria-hidden', 'true');
  const surface = html(document, 'div', 'split-scene-maps', null, container);
  const footer = html(document, 'div', 'split-scene-footer', null, container);
  const status = html(document, 'p', 'split-map-status', null, footer);
  status.setAttribute('role', 'status');
  const legend = html(document, 'ul', 'split-legend', null, footer);
  legend.setAttribute('aria-label', 'Map change legend');
  for (const [state, label] of Object.entries(LABELS)) {
    const item = html(document, 'li', null, label, legend);
    item.dataset.status = state;
  }

  let mode = 'side';
  let arm = 'baseline';
  let reveal = 50;
  let frame = null;
  let selectedId = null;
  let wipeParts = null;
  const buttons = new Map();
  const armButtons = new Map();
  for (const [key, label] of MODES) {
    const button = html(document, 'button', null, label, modes);
    button.type = 'button';
    button.addEventListener('click', () => { mode = key; draw(); });
    buttons.set(key, button);
  }
  for (const [key, label] of Object.entries(ARMS)) {
    const button = html(document, 'button', null, label, armControls);
    button.type = 'button';
    button.addEventListener('click', () => { arm = key; draw(); });
    armButtons.set(key, button);
  }

  function updateWipe(value) {
    reveal = Math.max(0, Math.min(100, Math.round(value)));
    const edge = WIDTH * (1 - reveal / 100);
    revealInput.value = reveal;
    revealInput.setAttribute('aria-valuetext', `${reveal}% Future B`);
    revealOutput.value = `${reveal}%`;
    if (!wipeParts) return;
    const { baseline, intervention, leftClip, rightClip, handle } = wipeParts;
    leftClip.setAttribute('width', edge);
    rightClip.setAttribute('x', edge);
    rightClip.setAttribute('width', WIDTH - edge);
    handle.style.left = `${100 - reveal}%`;
    for (const [layer, visible] of [
      [baseline, x => reveal < 100 && x <= edge],
      [intervention, x => reveal > 0 && x >= edge],
    ]) {
      for (const entity of layer.querySelectorAll('[data-entity]')) {
        const shown = visible(Number(entity.dataset.x));
        entity.setAttribute('tabindex', shown ? '0' : '-1');
        entity.setAttribute('aria-hidden', String(!shown));
      }
    }
  }
  revealInput.addEventListener('input', () => updateWipe(Number(revealInput.value)));

  function mapPanel(label, className) {
    const panel = html(document, 'section', 'split-map-panel ' + className, null, surface);
    html(document, 'h3', 'split-map-heading', label, panel);
    const canvas = html(document, 'div', 'split-map-canvas', null, panel);
    const svg = node(document, 'svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'group', 'aria-label': label + ' schematic' }, canvas);
    return { canvas, svg };
  }

  function layer(svg, key, scene, clipId) {
    const group = node(document, 'g', { class: 'split-map-layer split-' + key, 'data-arm': key }, svg);
    if (clipId) group.setAttribute('clip-path', `url(#${clipId})`);
    paintMap(document, group, frame, scene, key, selectedId);
    return group;
  }

  function draw() {
    const focused = document.activeElement?.closest('[data-entity]');
    const focusedId = focused?.dataset.entity;
    const focusedArm = focused?.closest('[data-arm]')?.dataset.arm;
    surface.replaceChildren();
    surface.dataset.mode = mode;
    wipeParts = null;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(mode === key));
    for (const [key, button] of armButtons) button.setAttribute('aria-pressed', String(arm === key));
    armControls.hidden = mode !== 'switch';
    wipeControl.hidden = mode !== 'wipe';
    if (!frame) {
      status.textContent = 'Compare the two futures to load the schematic.';
      return;
    }

    const count = frame.changes.length;
    const metricsDiffer = Object.keys(frame.baseline.metrics).some(key =>
      frame.baseline.metrics[key] !== frame.intervention.metrics[key]);
    status.textContent = count ? `${count} changed ${count === 1 ? 'entity' : 'entities'} at this month`
      : metricsDiffer ? 'No entity differences at this month' : 'Identical at this month';
    const scene = layout(frame);
    if (mode === 'wipe') {
      const { canvas, svg } = mapPanel('Future A · Baseline / Future B · Intervention', 'split-map-wipe');
      const defs = node(document, 'defs', {}, svg);
      const leftId = id + '-left';
      const rightId = id + '-right';
      const leftClip = node(document, 'rect', { height: HEIGHT }, node(document, 'clipPath', { id: leftId }, defs));
      const rightClip = node(document, 'rect', { height: HEIGHT }, node(document, 'clipPath', { id: rightId }, defs));
      const baseline = layer(svg, 'baseline', scene, leftId);
      const intervention = layer(svg, 'intervention', scene, rightId);
      const handle = html(document, 'span', 'split-wipe-handle', '‹ ›', canvas);
      handle.setAttribute('aria-hidden', 'true');
      const drag = event => {
        const bounds = canvas.getBoundingClientRect();
        if (bounds.width) updateWipe(100 * (1 - (event.clientX - bounds.left) / bounds.width));
      };
      handle.addEventListener('pointerdown', event => {
        handle.setPointerCapture(event.pointerId);
        drag(event);
      });
      handle.addEventListener('pointermove', event => {
        if (handle.hasPointerCapture(event.pointerId)) drag(event);
      });
      wipeParts = { baseline, intervention, leftClip, rightClip, handle };
      updateWipe(reveal);
    } else {
      const visibleArms = mode === 'side' ? Object.keys(ARMS) : [arm];
      for (const key of visibleArms) {
        const label = ARMS[key] + (key === 'baseline' ? ' · Baseline' : ' · Intervention');
        const { svg } = mapPanel(label, 'split-panel-' + key);
        layer(svg, key, scene);
      }
    }
    if (focusedId) {
      const replacement = [...surface.querySelectorAll('[data-entity][tabindex="0"]')].find(entity =>
        entity.dataset.entity === focusedId && entity.closest('[data-arm]').dataset.arm === focusedArm);
      (replacement ?? buttons.get(mode)).focus({ preventScroll: true });
    }
  }

  function select(event) {
    const target = event.target.closest('[data-entity]');
    if (target) onSelect(target.dataset.entity);
  }
  surface.addEventListener('click', select);
  surface.addEventListener('keydown', event => {
    if (!event.target.closest('[data-entity]') || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    select(event);
  });
  draw();
  return {
    render(nextFrame, nextSelectedId) {
      frame = nextFrame;
      selectedId = nextSelectedId;
      draw();
    },
  };
}
