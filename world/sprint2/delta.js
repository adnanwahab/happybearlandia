import { compareMonths, domains, replayMonths } from './delta-model.js';

const byId = id => document.getElementById(id);
const experiment = byId('experiment');
const scenario = byId('scenario');
const runIndex = byId('run-index');
const before = byId('before');
const after = byId('after');
const domain = byId('domain');
const labels = { buildings: 'Buildings', businesses: 'Businesses', households: 'Households' };
const pageSize = 25;
let manifest, months, comparison, page;

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function setOptions(select, entries) {
  select.replaceChildren(...entries.map(([value, label]) => new Option(label, value)));
}

async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function setControls(busy) {
  byId('refresh').disabled = busy;
  experiment.disabled = busy || !experiment.options.length;
  for (const control of [scenario, runIndex, byId('load-run')]) {
    control.disabled = busy || !manifest;
  }
}

async function load(message, operation) {
  byId('status').textContent = message;
  byId('error').hidden = true;
  byId('comparison').hidden = true;
  setControls(true);
  try {
    await operation();
  } catch (error) {
    byId('status').textContent = '';
    byId('error').textContent = `Could not load replay data. ${error.message}`;
    byId('error').hidden = false;
  } finally {
    setControls(false);
  }
}

async function selectExperiment() {
  manifest = null;
  setOptions(scenario, []);
  if (!experiment.value) {
    byId('status').textContent = 'No completed city experiments found. Run an experiment in City Lab, then refresh.';
    return;
  }

  const record = await api(`/api/city-experiments/${encodeURIComponent(experiment.value)}`);
  if (record.status !== 'complete') throw new Error('This experiment has no completed replay available.');
  manifest = record.manifest;
  setOptions(scenario, manifest.scenarios.map(row => [row.id, row.id]));
  runIndex.value = 0;
  runIndex.max = manifest.runs - 1;
  byId('status').textContent = `${manifest.title} · Choose a scenario and run index (0–${runIndex.max}).`;
}

function refresh() {
  return load('Loading saved experiments…', async () => {
    const selected = experiment.value || new URLSearchParams(location.search).get('experiment');
    manifest = null;
    setOptions(experiment, []);
    setOptions(scenario, []);
    const { experiments } = await api('/api/city-experiments');
    const ids = experiments.filter(row => row.status === 'complete').map(row => row.experiment_id);
    if (/^city_[\w-]{1,100}$/.test(selected ?? '') && !ids.includes(selected)) ids.unshift(selected);
    setOptions(experiment, ids.map(id => [id, id]));
    if (ids.includes(selected)) experiment.value = selected;
    await selectExperiment();
  });
}

function valueLabel(record, key) {
  if (!record) return 'Entity absent';
  if (!Object.hasOwn(record, key)) return 'Field absent';
  return JSON.stringify(record[key]);
}

function renderRecord({ id, kind, fields, before: previous, after: current }) {
  const details = document.createElement('details');
  const title = kind[0].toUpperCase() + kind.slice(1);
  details.append(element('summary', `${title} · ${id}`));

  const table = document.createElement('table');
  const header = table.createTHead().insertRow();
  for (const title of ['Field', `Before · Month ${before.value}`, `After · Month ${after.value}`]) {
    const cell = element('th', title);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = table.createTBody();
  for (const key of kind === 'changed' ? fields : ['id', ...fields]) {
    const row = body.insertRow();
    const field = element('th', key);
    field.scope = 'row';
    row.append(field, element('td', valueLabel(previous, key)), element('td', valueLabel(current, key)));
  }
  details.append(table);
  return details;
}

function unavailable(label, months) {
  return `${label} unavailable in ${months.map(month => `month ${month}`).join(' and ')}.`;
}

function renderRows() {
  const result = comparison[domain.value];
  const label = labels[domain.value];
  const root = byId('results');
  root.replaceChildren(element('h2', label));
  byId('pagination').hidden = true;
  if (result.unavailableMonths) {
    root.append(element('p', unavailable(label, result.unavailableMonths)));
    return;
  }
  if (!result.rows.length) {
    root.append(element('p', 'No changes between the selected months.'));
    return;
  }
  const start = page * pageSize;
  const end = Math.min(start + pageSize, result.rows.length);
  root.append(...result.rows.slice(start, end).map(renderRecord));
  byId('pagination').hidden = result.rows.length <= pageSize;
  byId('range').textContent = `${start + 1}–${end} of ${result.rows.length} records`;
  byId('previous').disabled = page === 0;
  byId('next').disabled = end === result.rows.length;
}

function renderComparison() {
  comparison = compareMonths(months, Number(before.value), Number(after.value));
  byId('summary').replaceChildren(...domains.map(key => {
    const { counts, unavailableMonths } = comparison[key];
    return element('p', unavailableMonths
      ? unavailable(labels[key], unavailableMonths)
      : `${labels[key]} · ${counts.added} added · ${counts.removed} removed · ${counts.changed} changed`);
  }));
  page = 0;
  renderRows();
}

byId('run-form').addEventListener('submit', event => {
  event.preventDefault();
  const id = experiment.value;
  const scenarioId = scenario.value;
  const index = Number(runIndex.value);
  void load('Replaying the saved run…', async () => {
    const replay = await api(`/api/experiments/${encodeURIComponent(id)}/replay`, { scenarioId, runIndex: index });
    months = replayMonths(replay);
    if (months.size < 2) {
      byId('status').textContent = 'This replay has fewer than two available months. Choose another run.';
      return;
    }
    const entries = [...months.keys()].map(month => [month, `Month ${month}`]);
    setOptions(before, entries);
    setOptions(after, entries);
    after.selectedIndex = entries.length - 1;
    byId('source').textContent = `${manifest.title} · ${id} · ${scenarioId}, run ${index} · Seed ${replay.steps[0].state.seed} · Replayed from saved inputs`;
    byId('status').textContent = `${months.size} replay months available.`;
    renderComparison();
    byId('comparison').hidden = false;
  });
});

experiment.addEventListener('change', () => void load('Loading experiment…', selectExperiment));
for (const control of [scenario, runIndex]) {
  control.addEventListener('input', () => {
    byId('comparison').hidden = true;
    byId('error').hidden = true;
    byId('status').textContent = 'Load the selected run to compare its months.';
  });
}
before.addEventListener('change', renderComparison);
after.addEventListener('change', renderComparison);
domain.addEventListener('change', () => { page = 0; renderRows(); });
byId('previous').addEventListener('click', () => { page--; renderRows(); });
byId('next').addEventListener('click', () => { page++; renderRows(); });
byId('refresh').addEventListener('click', refresh);
void refresh();
