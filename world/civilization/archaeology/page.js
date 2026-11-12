import { contextURL } from '../../universe/navigation.js';
import { collections, loadLayers } from './history.js';

const status = document.querySelector('#status');
const results = document.querySelector('#results');
const collection = document.querySelector('#collection');
const entity = document.querySelector('#entity');
const layers = document.querySelector('#layers');
const retry = document.querySelector('#retry');
const record = document.querySelector('#record');
let archive;

function render() {
  const row = archive.entities[collection.value].find(item => item.id === entity.value);
  const { universeId, worldId, scenarioId, runId } = archive.context;
  document.querySelector('#subject-title').textContent = row?.name ?? 'No entities recorded';
  const list = row ? [...row.layers].reverse() : [];
  layers.replaceChildren(...list.map(({ month, description, event }) => {
    const item = document.createElement('li');
    const heading = document.createElement('h3');
    heading.textContent = `Month ${month}`;
    const note = document.createElement('p');
    note.textContent = description ?? 'Absent from this checkpoint';
    const checkpoint = document.createElement('a');
    checkpoint.textContent = 'Open city checkpoint';
    const query = new URLSearchParams({ runId, month: String(month), entityId: row.id });
    checkpoint.href = '/world/causal.html?' + query;
    item.append(heading, note, checkpoint);
    if (event) {
      const clue = document.createElement('a');
      clue.textContent = 'Inspect recorded event';
      const target = new URLSearchParams({ targetId: event.id });
      clue.href = contextURL('/world/causality/inspect.html?' + target, {
        universeId, worldId, scenarioId, runId, tick: month,
      });
      item.append(clue);
    }
    return item;
  }));
}

function selectCollection() {
  entity.replaceChildren(...archive.entities[collection.value].map(row => new Option(row.name, row.id)));
  entity.disabled = !entity.options.length;
  render();
}

async function openArchive() {
  retry.hidden = true;
  record.hidden = true;
  status.textContent = 'Reading the recorded city layers…';
  try {
    archive = await loadLayers();
    if (archive.state === 'missing') {
      status.textContent = 'There is no saved city demo to explore yet.';
      record.hidden = false;
      return;
    }
    if (archive.state === 'incomplete') {
      status.textContent = 'The saved city demo is incomplete.';
      return;
    }
    collection.replaceChildren(...Object.entries(collections).map(([key, label]) => new Option(label, key)));
    selectCollection();
    results.hidden = false;
    status.textContent = `Recorded monthly City demo · Seed ${archive.context.seed} · ${archive.context.modelVersion}`;
  } catch (error) {
    status.textContent = error.message;
    retry.hidden = false;
  }
}

collection.addEventListener('change', selectCollection);
entity.addEventListener('change', render);
retry.addEventListener('click', openArchive);
openArchive();
