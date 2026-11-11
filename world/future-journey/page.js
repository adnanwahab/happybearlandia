import { listLivingSaves } from '../timeline-braids/comparison.js';
import { checkpointLineage, compareRainFork, inspectFuture, readFuture, saveRainFork } from './model.js';
import { journeySelection, journeyURL } from './navigation.js';

const find = id => document.getElementById(id);
const open = find('open');
const fork = find('fork');
const status = find('status');
const timeline = find('timeline');
let checkpoints = [];
let person;
let generation = 0;

const metric = value => Number.isFinite(value) ? Number(value.toFixed(2)).toLocaleString() : 'Unavailable';
const describe = value => `Activity ${value.activity ?? 'unavailable'} · Savings ${metric(value.savings)} · Commute ${metric(value.commute)} min`;

function showPair(record, selected) {
  const evidence = record.save.view.journeyFork;
  const section = find('comparison');
  section.hidden = evidence?.version !== 'population-rain-fork.v1' || !evidence.control || evidence.changed?.person !== selected.person;
  if (section.hidden) return;
  find('pair').textContent = `Tick ${evidence.targetTick} · Rain ${evidence.rainIntensity} · Control: ${describe(evidence.control)}. Edited: ${describe(evidence.changed)}.`;
  find('child').href = journeyURL('worldline', selected, location.search);
}

function paint() {
  const source = checkpoints[Number(timeline.value)];
  const selection = inspectFuture(source, person);
  person = selection.person;
  open.elements.person.value = person;
  find('record-title').textContent = source.record.save.label;
  find('clock').textContent = `Tick ${selection.tick} · Minute ${selection.minute} · Population ${selection.modelVersion}`;
  find('facts').textContent = `${selection.name} · ${selection.household} · ${describe(selection)}`;
  const context = new URLSearchParams(location.search);
  context.set('future', checkpoints.at(-1).record.id);
  for (const surface of ['world', 'house']) find(surface).href = journeyURL(surface, selection, context);
  history.replaceState(null, '', journeyURL('worldline', selection, context));
  find('fork-status').textContent = '';
  showPair(source.record, selection);
  find('result').hidden = false;
}

async function load(id, selectedId = id, selectedPerson = '') {
  const current = ++generation;
  find('result').hidden = true;
  status.textContent = 'Loading saved future…';
  try {
    const tip = await readFuture(id);
    const result = await checkpointLineage(tip);
    if (current !== generation) return;
    checkpoints = result.checkpoints;
    person = selectedPerson;
    const index = checkpoints.findIndex(row => row.record.id === selectedId);
    if (index < 0) throw new Error(result.notice || 'This checkpoint is unavailable in the saved lineage.');
    timeline.max = checkpoints.length - 1;
    timeline.disabled = checkpoints.length === 1;
    timeline.value = index;
    open.elements.experiment.value = id;
    paint();
    status.textContent = result.notice || `${checkpoints.length} recorded checkpoints. Choose a saved point to scrub the timeline.`;
  } catch (error) {
    if (current === generation) status.textContent = error.message;
  }
}

open.onsubmit = event => {
  event.preventDefault();
  void load(open.elements.experiment.value.trim(), undefined, open.elements.person.value.trim());
};
timeline.oninput = () => {
  try { paint(); } catch (error) { status.textContent = error.message; }
};
find('demo').onclick = async () => {
  const button = find('demo');
  button.disabled = true;
  status.textContent = 'Creating a synthetic household checkpoint…';
  try {
    const { createCustomHouseholdSave } = await import('../house/creator-model.js');
    const { save } = await createCustomHouseholdSave({
      name: 'Guided Riverside household', startingMoney: 14250, relationship: 'roommates',
      members: [{ name: 'Alex Rivera', ageYears: 35, voice: 'warm', skinColor: '#d1a77c',
        shirtColor: '#658da6', hairColor: '#534d36', traits: ['social', 'creative', 'romantic'], interests: ['hobbies'] }],
    });
    const response = await fetch('/api/world-experiments', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(save),
    });
    if (!response.ok) throw new Error('The guided checkpoint could not be saved.');
    await load((await response.json()).id);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

fork.onsubmit = async event => {
  event.preventDefault();
  const source = checkpoints[Number(timeline.value)];
  const selected = person;
  const rain = fork.elements.rain.valueAsNumber;
  const button = fork.querySelector('button');
  button.disabled = true;
  timeline.disabled = true;
  find('fork-status').textContent = 'Restoring both copies and running one fixed step…';
  try {
    const result = await compareRainFork(source, selected, rain);
    const { record } = await saveRainFork(source, selected, rain, result);
    await load(record.id, record.id, selected);
    find('fork-status').textContent = 'Saved the edited child. The original checkpoint is unchanged.';
  } catch (error) {
    find('fork-status').textContent = error.message;
  } finally {
    button.disabled = false;
    timeline.disabled = checkpoints.length < 2;
  }
};

open.querySelector('button').disabled = false;
find('demo').disabled = false;
try {
  const { experiment, person: selected, future } = journeySelection(new URLSearchParams(location.search));
  if (experiment) void load(future, experiment, selected);
  else status.textContent = 'Open a saved Living World experiment or create the guided demo.';
} catch (error) {
  status.textContent = error.message;
}
listLivingSaves().then(rows => {
  find('experiments').replaceChildren(...rows.map(row => new Option(row.label, row.id)));
}).catch(() => {});
