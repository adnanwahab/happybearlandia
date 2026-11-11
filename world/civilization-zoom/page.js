import {
  levels, listZoomCheckpoints, loadZoomIndex, pathAtLevel, personName, resolveZoom, zoomPathFromURL, zoomURL,
} from './model.js';
import { drawZoom } from './visual.js';

const find = id => document.getElementById(id);
const input = find('checkpoint');
const form = find('open');
const status = find('status');
const title = find('title');
const panel = find('zoom');
const content = find('content');
let current;
let controller;
const currency = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function element(tag, text, parent) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent?.append(node);
  return node;
}

function link(label, href, parent) {
  const node = element('a', label, parent);
  node.href = href;
  return node;
}

function select(label, path, parent) {
  const button = element('button', label, parent);
  button.type = 'button';
  button.onclick = () => navigate(path);
  return button;
}

function renderChoices(rows, path, empty) {
  if (!rows.length) {
    element('p', empty, content);
    return;
  }
  let limit = 24;
  const list = element('ul', undefined, content);
  list.className = 'choices';
  const more = element('button', 'Show more', content);
  more.type = 'button';
  function paint() {
    const already = list.childElementCount;
    for (const row of rows.slice(already, limit)) {
      const item = element('li', undefined, list);
      select(row.name, path(row), item);
      if (row.description) element('small', row.description, item);
    }
    more.hidden = limit >= rows.length;
  }
  more.onclick = () => {
    const already = list.childElementCount;
    limit += 24;
    paint();
    list.children[already]?.querySelector('button')?.focus();
  };
  paint();
}

function renderResident(resident) {
  const facts = element('dl', undefined, content);
  const descriptions = [
    ['Resident ID', resident.id], ['Age', resident.age], ['Activity', resident.activity],
    ['Employment', resident.employment], ['Current location', resident.currentLocation],
  ];
  for (const [label, value] of descriptions) {
    element('dt', label, facts);
    element('dd', value ?? 'Unavailable', facts);
  }
  const links = element('nav', undefined, content);
  links.setAttribute('aria-label', 'Resident handoffs');
  link('Open this resident in House Simulator', resident.house, links);
  link('Open saved family records', resident.family, links);
  link('Open this resident in Timeline Braids', resident.braids, links);

  element('h3', 'Recorded relationships', content);
  if (!resident.links.length) element('p', 'No relationship records were retained for this resident.', content);
  for (const relation of resident.links.slice(0, 24)) {
    const item = element('details', undefined, content);
    element('summary', [relation.name, relation.kind].filter(Boolean).join(' · '), item);
    if (Number.isFinite(relation.lastMinute)) element('p', `Last recorded contact at minute ${relation.lastMinute}`, item);
    for (const memory of relation.memories) element('p', `Minute ${memory.minute} · ${memory.text ?? memory.event}`, item);
    select('Zoom to ' + relation.name, relation.path, item);
  }
  if (resident.links.length > 24) element('p', 'Showing the 24 most recently retained relationships.', content);
  element('h3', 'Recorded decisions', content);
  if (!resident.decisions.length) element('p', 'No decision traces were retained for this resident.', content);
  for (const decision of resident.decisions) {
    const item = element('details', undefined, content);
    element('summary', `Minute ${decision.minute} · ${decision.type}`, item);
    if (decision.chosen != null) element('p', `Choice ${decision.chosen}`, item);
    if (decision.reason) element('p', decision.reason, item);
    element('small', decision.id, item);
  }
}

function show(path, animate = false) {
  let view;
  try {
    view = resolveZoom(current, path);
  } catch (error) {
    panel.hidden = true;
    status.textContent = error.message;
    status.append(' ');
    link('Open the checkpoint at World scale', zoomURL(current.checkpoint.id, { level: 'world' }), status);
    return false;
  }
  const { rank, district, anchor, household, resident } = view;
  path = view.path;
  const { checkpoint } = current;
  const labels = ['World', 'City', district?.name, anchor?.name, household?.name, resident?.name];
  title.textContent = labels[rank];
  find('description').textContent = '';
  content.replaceChildren();
  const breadcrumbs = find('breadcrumbs');
  breadcrumbs.replaceChildren();
  for (let depth = 0; depth < rank; depth++) select(labels[depth], pathAtLevel(path, levels[depth]), breadcrumbs);
  const here = element('span', labels[rank], breadcrumbs);
  here.setAttribute('aria-current', 'location');
  find('identity').textContent =
    `${checkpoint.label} · Checkpoint ${checkpoint.id} · Tick ${checkpoint.tick} · Minute ${checkpoint.model.minute} · Population ${checkpoint.model.modelVersion}`;
  const description = find('description');
  if (rank === 0) {
    const { lat, lng } = current.origin ?? {};
    description.textContent = Number.isFinite(lat) && Number.isFinite(lng)
      ? `Saved city origin ${lat.toFixed(4)}°, ${lng.toFixed(4)}°. The globe marks the selected origin.`
      : 'This checkpoint has no geographic origin. Its city and residents are synthetic.';
    select('Zoom to saved city', { level: 'city' }, content);
    link('Open the exact checkpoint in World', view.replay, content).className = 'open-world';
  } else if (rank === 1) {
    description.textContent = 'Choose a district using the home districts in the saved population.';
    renderChoices([...current.districts.values()].map(row => ({
      ...row, description: `${row.people} residents · ${row.households.size} households`,
    })), row => ({ level: 'district', district: row.id }), 'No saved districts are available.');
  } else if (rank === 2) {
    description.textContent = 'Choose a building anchor. Households without a recorded building remain available.';
    renderChoices([...district.anchors.values()].map(row => ({
      ...row, description: `${row.people} residents · ${row.households.size} households`,
    })), row => ({ ...path, level: 'location', location: row.id }), 'No home anchors or residents were recorded in this district.');
  } else if (rank === 3) {
    description.textContent = anchor.buildingId
      ? `Recorded building anchor ${anchor.buildingId}. The building drawing is schematic.`
      : 'Residents in this group have no saved building anchor.';
    renderChoices([...anchor.households.values()].map(row => ({
      ...row, description: `${row.residents.length} of ${row.totalMembers} household members at this anchor`,
    })), row => ({ ...path, level: 'household', household: row.id }), 'No households have residents at this anchor.');
  } else if (rank === 4) {
    description.textContent = `${household.id} · ${household.residents.length} of ${household.totalMembers} members at this anchor`;
    const finances = [
      ['Monthly rent', household.rent], ['Savings', household.savings],
    ].filter(([, value]) => Number.isFinite(value)).map(([label, value]) => `${label} ${currency.format(value)} modeled USD`);
    if (finances.length) element('p', finances.join(' · '), content);
    renderChoices(household.residents.map(index => ({
      name: personName(checkpoint.model, index), path: current.residentPaths[index],
    })), row => row.path, 'No residents were retained for this household at this anchor.');
  } else {
    description.textContent = 'This view shows saved ties and decisions that were retained for the selected resident.';
    renderResident(resident);
  }
  panel.hidden = false;
  status.textContent = '';
  drawZoom(find('picture'), current, view);
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    find('picture').animate([{ opacity: .68, transform: 'scale(1.04)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 180, easing: 'ease-out' });
  }
  return true;
}

function navigate(path) {
  if (show(path, true)) {
    history.pushState(null, '', zoomURL(current.checkpoint.id, path));
    title.focus();
  }
}

async function open(id, path, push = false) {
  controller?.abort();
  const active = new AbortController();
  controller = active;
  panel.hidden = true;
  status.textContent = 'Opening the saved Living World…';
  input.value = id;
  try {
    const index = current?.checkpoint.id === id ? current : await loadZoomIndex(id, { signal: active.signal });
    if (active.signal.aborted) return;
    current = index;
    if (show(path) && push) {
      history.pushState(null, '', zoomURL(id, path));
      title.focus();
    }
  } catch (error) {
    if (!active.signal.aborted) status.textContent = error.message;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void open(input.value.trim(), { level: 'world' }, true);
});

function restoreLocation() {
  const id = new URLSearchParams(location.search).get('experiment');
  if (id) void open(id, zoomPathFromURL(location.search));
  else {
    controller?.abort();
    panel.hidden = true;
    input.value = '';
    status.textContent = 'Choose a saved Living World checkpoint.';
  }
}
window.addEventListener('popstate', restoreLocation);
restoreLocation();
try {
  const saves = await listZoomCheckpoints();
  find('checkpoints').replaceChildren(...saves.map(save => new Option(save.label, save.id)));
  if (!saves.length) find('list-status').textContent = 'No saved Living Worlds were found. Save a checkpoint from World to start.';
} catch (error) {
  find('list-status').textContent = error.message;
}
