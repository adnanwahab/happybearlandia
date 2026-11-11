import { defaultResident, familyView, fetchCheckpoint, replayURL, residentHistory } from './history.js';

const query = new URLSearchParams(location.search);
const form = document.querySelector('form');
const input = form.elements.experiment;
const personInput = form.elements.person;
const status = document.querySelector('#status');
const family = document.querySelector('#family');
const resident = document.querySelector('#resident');
const tree = document.querySelector('#tree');
const historyStatus = document.querySelector('#history-status');
const timeline = document.querySelector('#timeline');
let pending;
let activeCheckpoint;

function append(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderBranch(title, generations, container, checkpoint) {
  const branch = append(container, 'section', '');
  append(branch, 'h3', title);
  if (!generations.length) append(branch, 'p', 'No links are recorded at this checkpoint.');

  generations.forEach((links, generation) => {
    append(branch, 'h4', 'Generation ' + (generation + 1));
    const list = append(branch, 'ul', '');
    for (const { person, via, evidence } of links) {
      const item = append(list, 'li', '');
      const button = append(item, 'button', person.name);
      button.type = 'button';
      button.addEventListener('click', () => void showResident(checkpoint, person.id, true));
      append(item, 'p', generation === 0 ? person.id : 'Through ' + via.name + ' · ' + person.id);
      append(item, 'p', evidence
        ? `Recorded ${evidence.method} · minute ${evidence.minute} · record ${evidence.id}`
        : 'Parent link from the synthetic population checkpoint.');
    }
  });
}

function renderHistory({ rows, notice }) {
  for (const [index, { id, label, minute, tick, person }] of rows.entries()) {
    const item = append(timeline, 'li', '');
    const link = append(item, 'a', label + ' ↗');
    link.href = replayURL(id);
    append(item, 'p', `Minute ${minute} · tick ${tick} · checkpoint ${id}`);
    if (!person) {
      append(item, 'p', 'Resident absent at this checkpoint.');
      continue;
    }
    const home = [person.homeLabel, person.homeId].filter(Boolean).join(' · ') || 'Home unavailable';
    const work = person.employerLabel || person.employerId;
    append(item, 'p', [person.age === null ? 'Age unavailable' : `Age ${person.age}`,
      home, work ? person.employment + ' · ' + work : person.employment].join(' · '));
    const earlier = rows[index + 1]?.person;
    if (earlier?.homeId && person.homeId && earlier.homeId !== person.homeId) {
      append(item, 'p', 'Home anchor changed since the preceding save.');
    }
    if (earlier && (earlier.employment !== person.employment || earlier.employerId !== person.employerId)) {
      append(item, 'p', 'Work status or employer changed since the preceding save.');
    }
  }
  historyStatus.textContent = notice || '';
}

async function showResident(checkpoint, personId, focusHeading = false) {
  let view;
  try {
    view = familyView(checkpoint.model, personId);
  } catch (error) {
    status.textContent = error.message;
    if (personId !== defaultResident(checkpoint)) await showResident(checkpoint, defaultResident(checkpoint));
    return;
  }
  const { focus, ancestors, descendants, truncated } = view;
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  resident.textContent = focus.name;
  resident.tabIndex = -1;
  document.querySelector('#identity').textContent = `${focus.id} · checkpoint ${checkpoint.id} · minute ${checkpoint.model.minute}`;
  document.querySelector('#checkpoint').href = replayURL(checkpoint.id);
  tree.replaceChildren();
  renderBranch('Ancestors', ancestors, tree, checkpoint);
  renderBranch('Descendants', descendants, tree, checkpoint);
  document.querySelector('#coverage').textContent = truncated
    ? 'Showing up to three generations in each direction and at most 100 relatives.'
    : 'Parent links come from the saved simulation. Birth and adoption dates appear where a lineage record exists.';
  query.set('experiment', checkpoint.id);
  query.set('person', personId);
  personInput.value = personId;
  history.replaceState(null, '', '?' + query);
  family.hidden = false;
  if (focusHeading) resident.focus();
  timeline.replaceChildren();
  historyStatus.textContent = 'Reading saved checkpoints…';
  try {
    const result = await residentHistory(checkpoint, personId, { signal: controller.signal });
    if (!controller.signal.aborted) renderHistory(result);
  } catch (error) {
    if (!controller.signal.aborted) historyStatus.textContent = error.message;
  }
}

async function openCheckpoint(id, person) {
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  family.hidden = true;
  status.textContent = 'Opening the saved Living World…';
  try {
    const checkpoint = activeCheckpoint?.id === id ? activeCheckpoint :
      await fetchCheckpoint(id, { signal: controller.signal });
    if (controller.signal.aborted) return;
    activeCheckpoint = checkpoint;
    status.textContent = '';
    await showResident(checkpoint, person ?? defaultResident(checkpoint));
  } catch (error) {
    if (!controller.signal.aborted) status.textContent = error.message;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void openCheckpoint(input.value.trim(), personInput.value.trim() || null);
});
if (query.has('experiment')) {
  input.value = query.get('experiment');
  personInput.value = query.get('person') ?? '';
  void openCheckpoint(input.value, personInput.value || null);
}
