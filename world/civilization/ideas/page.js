import { IDEA_RULES, isExperimentId, simulateIdeaSpread } from './model.js';

const select = document.querySelector('#save');
const sourceForm = document.querySelector('#source-form');
const sourceStatus = document.querySelector('#source-status');
const experiment = document.querySelector('#experiment');
const ideaForm = document.querySelector('#idea-form');
const starter = ideaForm.elements.starterId;
const results = document.querySelector('#results');
const timeline = document.querySelector('#timeline');
const outcome = document.querySelector('#outcome');
const query = new URLSearchParams(location.search);
const worldLink = id => '/world?' + new URLSearchParams({ experiment: id });
let worker;
let source;

const day = minute => {
  const time = minute % 1440;
  return `Day ${Math.floor(minute / 1440) + 1} · ${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
};
const percent = probability => `${100 * probability}%`;

document.querySelector('#rules').textContent =
  `${IDEA_RULES.version} · ${percent(IDEA_RULES.adoptionProbability)} adoption chance per eligible contact · ` +
  `${percent(IDEA_RULES.remixProbability)} remix chance for a successful transmission of the original idea · ` +
  `Ideas fade after ${IDEA_RULES.retentionMinutes / 60} model hours.`;

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function showResult(report) {
  const names = new Map(source.people.map(person => [person.id, person.name]));
  document.querySelector('#result-heading').textContent = report.recipe.title;
  outcome.textContent = `${report.reached} residents held the idea at some point. ${report.active} still held it at the checkpoint.`;
  timeline.replaceChildren(...report.events.map(row => {
    const name = names.get(row.personId);
    const from = names.get(row.fromId);
    const message = {
      introduced: () => `${name} introduced the idea.`,
      declined: () => `${name} heard the idea from ${from} and did not adopt it.`,
      adopted: () => `${name} ${row.remixed ? 'remixed' : 'adopted'} the ${row.variant === 'remix' && !row.remixed ? 'remixed ' : ''}idea from ${from}.`,
      faded: () => `The idea faded for ${name}.`,
    }[row.kind]();
    const item = document.createElement('li');
    item.append(element('time', day(row.minute)), element('span', message));
    if (row.evidence) {
      const { experimentId, collection, index, placeId, text } = row.evidence;
      const details = document.createElement('details');
      const link = element('a', 'Open the saved World checkpoint');
      link.href = worldLink(experimentId);
      const label = collection === 'socialTimeline' ? 'Recorded talk command' : 'Recorded hotspot conversation';
      details.append(
        element('summary', 'Contact evidence'),
        element('p', `${label} #${index + 1}${placeId ? ` · Place ${placeId}` : ''}`),
        element('p', `${row.fromId} and ${row.personId}`),
      );
      if (typeof text === 'string' && text) details.append(element('p', text));
      details.append(element('p', `Seeded adoption draw ${row.adoptionDraw.toFixed(4)} · Threshold ${IDEA_RULES.adoptionProbability}`), link);
      item.append(details);
    }
    return item;
  }));
  results.hidden = false;
}

function run({ share = true } = {}) {
  results.hidden = true;
  try {
    const { title, starterId, seed } = Object.fromEntries(new FormData(ideaForm));
    const report = simulateIdeaSpread(source, { title, starterId, seed: Number(seed) });
    showResult(report);
    if (share) {
      const recipe = new URLSearchParams({ experiment: source.experimentId, title: report.recipe.title, starterId, seed, rules: IDEA_RULES.version });
      history.replaceState(null, '', location.pathname + '?' + recipe);
    }
  } catch (error) {
    sourceStatus.textContent = error.message;
  }
}

function showSource(value, replay) {
  source = value;
  if (!source.contacts.length) {
    sourceStatus.textContent = 'This checkpoint retains no eligible conversations. Let residents talk in Living World, then save again.';
    const link = element('a', 'Open the saved World checkpoint');
    link.href = worldLink(source.experimentId);
    sourceStatus.append(' ', link);
    return;
  }
  sourceStatus.textContent = `${source.contacts.length} retained conversations among ${source.people.length} residents.` +
    (source.truncated ? ' The experiment uses the most recent contacts within its input limit.' : '');
  const first = source.contacts[0].minute;
  document.querySelector('#provenance').textContent =
    `${source.label} · ${source.populationVersion} · Population seed ${source.populationSeed} · ${day(first)} to ${day(source.throughMinute)}`;
  const sourceLink = document.querySelector('#source-link');
  sourceLink.href = worldLink(source.experimentId);
  starter.replaceChildren(...source.people.map(({ id, name }) => new Option(`${name} · ${id}`, id)));
  experiment.hidden = false;
  if (replay && query.has('title') && query.has('seed') && query.has('starterId')) {
    ideaForm.elements.title.value = query.get('title');
    ideaForm.elements.seed.value = query.get('seed');
    starter.value = query.get('starterId');
    if (query.get('rules') !== IDEA_RULES.version) {
      sourceStatus.textContent = 'This experiment link uses an unsupported rule version. Run the current rules to make a new link.';
    } else if (ideaForm.reportValidity()) {
      run({ share: false });
    }
  }
}

function load(id, { replay = false } = {}) {
  if (!isExperimentId(id)) {
    sourceStatus.textContent = 'Choose a saved Living World first.';
    return;
  }
  worker?.terminate();
  experiment.hidden = true;
  results.hidden = true;
  sourceStatus.textContent = 'Reading recorded conversations…';
  const job = new Worker(new URL('./source.worker.js', import.meta.url), { type: 'module' });
  worker = job;
  function finish() {
    job.terminate();
    worker = null;
  }
  job.onmessage = ({ data }) => {
    finish();
    if (data.error) sourceStatus.textContent = data.error;
    else showSource(data.source, replay);
  };
  job.onerror = () => {
    finish();
    sourceStatus.textContent = 'The checkpoint reader could not start. Try again.';
  };
  job.postMessage(id);
}

async function listSaves() {
  const initialId = query.get('experiment');
  if (isExperimentId(initialId)) {
    select.append(new Option(initialId, initialId, true, true));
    load(initialId, { replay: true });
  }
  try {
    const response = await fetch('/api/world-experiments');
    if (!response.ok) throw new Error();
    const { experiments } = await response.json();
    const saved = experiments.filter(row => row.mode === 'living' && isExperimentId(row.id));
    for (const row of saved) {
      if (row.id === initialId) select.options[1].textContent = row.label;
      else select.append(new Option(row.label, row.id));
    }
    if (!isExperimentId(initialId)) {
      sourceStatus.textContent = saved.length ? 'Select a checkpoint to inspect.' :
        'There are no saved Living Worlds yet. Record some conversations and save in Living World.';
    }
  } catch {
    if (!isExperimentId(initialId)) sourceStatus.textContent = 'Saved simulations could not be listed. Reload to try again.';
  }
}

sourceForm.addEventListener('submit', event => {
  event.preventDefault();
  load(select.value);
});
ideaForm.addEventListener('submit', event => {
  event.preventDefault();
  run();
});
void listSaves();
