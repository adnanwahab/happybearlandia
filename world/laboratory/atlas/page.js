import {
  ATLAS_DEFAULTS, ATLAS_MODEL_VERSION, ATLAS_SWEEPS, ATLAS_THRESHOLDS,
  atlasSampleURL, classifyAtlasHousing, createAtlasSweep, readAtlasSampleURL,
} from './model.js';

const byId = id => document.getElementById(id);
const form = byId('sweep-form');
const status = byId('sweep-status');
const cancel = byId('cancel');
const progress = byId('sweep-progress');
const grid = byId('grid');
const cellDetails = byId('cell-details');
const outcomeNames = { adequate: 'Adequate', tight: 'Tight', severe: 'Severe shortage', mixed: 'Mixed across seeds' };
const counts = new Intl.NumberFormat('en-US');
const percentage = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 3 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const speed = value => `${value.toFixed(2)}×`;
const cellLabel = cell => `${speed(cell.constructionSpeed)} capacity · ${percentage.format(cell.populationGrowth)} annual growth`;
const sizeLabels = { quick: 'Quick', detailed: 'Detailed', extended: 'Extended' };
const metricLabels = {
  population: 'People', households: 'Households', housingUnits: 'Housing units', availableUnits: 'Available units',
  unhoused: 'Unhoused households', meanRent: 'Mean modeled rent / month', employed: 'Employed people',
  completedProjects: 'Completed projects',
};
let worker;

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

for (const [key, { resolution, seedCount }] of Object.entries(ATLAS_SWEEPS)) {
  byId('preset').append(new Option(
    `${sizeLabels[key]} · ${counts.format(resolution ** 2 * seedCount)} runs`, key,
  ));
}
for (const field of ['seed', 'horizonMonths', 'households']) form.elements[field].value = ATLAS_DEFAULTS[field];
byId('rules').textContent =
  `${ATLAS_MODEL_VERSION}. Severe means at least ${percentage.format(ATLAS_THRESHOLDS.severeUnhousedShare)} of households are unhoused. ` +
  `Tight means some households are unhoused or fewer than ${percentage.format(ATLAS_THRESHOLDS.tightVacancyShare)} of units are available. ` +
  'Adequate covers the remaining cases. Mixed means no classification has a majority.';

function startWorker(type, recipe, onResult, onError) {
  const job = new Worker(new URL('./atlas.worker.js', import.meta.url), { type: 'module' });
  worker = job;
  job.onmessage = ({ data }) => {
    if (worker !== job) return;
    if (data.type === 'error') {
      stopWorker();
      onError(data.message);
    } else {
      onResult(data);
    }
  };
  job.onerror = () => {
    if (worker !== job) return;
    stopWorker();
    onError('The City simulation worker could not start.');
  };
  job.postMessage({ type, recipe });
}

function stopWorker() {
  worker?.terminate();
  worker = null;
  cancel.disabled = true;
}

function prepareGrid(sweep) {
  const head = element('thead');
  const heading = element('tr');
  heading.append(element('td'));
  for (const value of sweep.speeds) {
    const th = element('th', speed(value));
    th.scope = 'col';
    heading.append(th);
  }
  head.append(heading);
  const body = element('tbody');
  const buttons = sweep.growthRates.map((growth, row) => {
    const tr = element('tr');
    const th = element('th', percentage.format(growth));
    th.scope = 'row';
    tr.append(th);
    body.append(tr);
    return sweep.speeds.map((value, column) => {
      const td = element('td');
      const button = element('button', '…');
      button.type = 'button';
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', cellLabel({ constructionSpeed: value, populationGrowth: growth }));
      button.id = `cell-${row}-${column}`;
      td.append(button);
      tr.append(td);
      return button;
    });
  });
  grid.tHead?.remove();
  grid.tBodies[0]?.remove();
  grid.append(head, body);
  return buttons;
}

function selectCell(cell, sweep, button) {
  grid.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-pressed', 'true');
  byId('cell-title').textContent = cellLabel(cell);
  const labels = Object.entries(cell.counts).map(([key, value]) => `${value} ${outcomeNames[key].toLowerCase()}`);
  byId('cell-counts').textContent = `${labels.join(' · ')}. Mean unhoused share ${percentage.format(cell.meanUnhousedShare)}.`;
  byId('samples').replaceChildren(...cell.samples.map(sample => {
    const row = element('li');
    const link = element('a', `Open seed ${sample.seed}`);
    link.href = atlasSampleURL({
      ...sweep.recipe, seed: sample.seed, constructionSpeed: cell.constructionSpeed, populationGrowth: cell.populationGrowth,
    });
    row.append(link, ` · ${sample.unhoused} of ${sample.households} households unhoused · ${outcomeNames[sample.classification]}`);
    return row;
  }));
  cellDetails.hidden = false;
}

function reportContrast(rows) {
  let largest;
  for (const row of rows) {
    for (const cell of row) {
      for (const neighbor of [rows[cell.row + 1]?.[cell.column], row[cell.column + 1]]) {
        if (!neighbor) continue;
        const change = Math.abs(cell.meanUnhousedShare - neighbor.meanUnhousedShare);
        if (!largest || change > largest.change) largest = { cell, neighbor, change };
      }
    }
  }
  if (!largest?.change) {
    byId('contrast').textContent = 'Adjacent cells had the same mean unhoused share.';
    return;
  }
  const points = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(largest.change * 100);
  byId('contrast').textContent =
    `Largest adjacent change in mean unhoused share · ${points} percentage points between ${cellLabel(largest.cell)} and ${cellLabel(largest.neighbor)}.`;
}

function runSweep(input) {
  stopWorker();
  cellDetails.hidden = true;
  byId('contrast').textContent = '';
  const sweep = createAtlasSweep(input);
  const buttons = prepareGrid(sweep);
  const rows = sweep.growthRates.map(() => []);
  const total = counts.format(sweep.sampleCount);
  let completed = 0;
  const update = label => { status.textContent = `${label} ${counts.format(completed)} of ${total} modeled scenarios.`; };
  progress.max = sweep.sampleCount;
  progress.value = 0;
  progress.hidden = false;
  byId('atlas-results').hidden = false;
  cancel.disabled = false;
  cancel.onclick = () => {
    stopWorker();
    update('Stopped after');
  };
  update('Completed');
  startWorker('sweep', input, data => {
    if (data.type === 'complete') {
      stopWorker();
      reportContrast(rows);
      return;
    }
    const cell = data.cell;
    const button = buttons[cell.row][cell.column];
    rows[cell.row][cell.column] = cell;
    button.className = cell.classification;
    button.textContent = outcomeNames[cell.classification][0];
    button.setAttribute('aria-label', `${cellLabel(cell)} · ${outcomeNames[cell.classification]}`);
    button.onclick = () => selectCell(cell, sweep, button);
    button.disabled = false;
    completed += cell.samples.length;
    progress.value = completed;
    update('Completed');
  }, error => { status.textContent = error; });
}

function showSample({ recipe, month }) {
  byId('sweep-view').hidden = true;
  byId('sample-view').hidden = false;
  const sampleStatus = byId('sample-status');
  sampleStatus.textContent = 'Recomputing the selected City scenario from its versioned recipe…';
  startWorker('sample', recipe, ({ result }) => {
    stopWorker();
    sampleStatus.textContent = 'Recomputed from the selected recipe.';
    byId('sample-detail').hidden = false;
    byId('sample-context').textContent =
      `Seed ${recipe.seed} · ${counts.format(recipe.households)} starting households · ${cellLabel(recipe)} · ${result.modelVersion}`;
    const slider = byId('month');
    slider.max = recipe.horizonMonths;
    slider.value = month;
    function render() {
      const state = result.series[Number(slider.value)];
      byId('selected-month').value = `${state.month} of ${recipe.horizonMonths} · ${outcomeNames[classifyAtlasHousing(state)]}`;
      byId('sample-metrics').replaceChildren(...Object.entries(metricLabels).map(([key, label]) => {
        const metric = element('div');
        metric.append(element('dt', label), element('dd', key === 'meanRent' ? money.format(state[key]) : counts.format(state[key])));
        return metric;
      }));
      byId('districts').replaceChildren(...state.districts.map(district => {
        const tr = element('tr');
        const th = element('th', district.name);
        th.scope = 'row';
        tr.append(th, ...['households', 'housingUnits', 'availableUnits', 'unhoused', 'meanRent'].map(key =>
          element('td', district[key] === null ? 'Unavailable' : key === 'meanRent' ? money.format(district[key]) : counts.format(district[key]))));
        return tr;
      }));
    }
    slider.addEventListener('input', () => {
      render();
      history.replaceState(null, '', atlasSampleURL(recipe, Number(slider.value)));
    });
    render();
  }, error => { sampleStatus.textContent = error; });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const { preset, seed, horizonMonths, households } = Object.fromEntries(new FormData(form));
    runSweep({ preset, seed: Number(seed), horizonMonths: Number(horizonMonths), households: Number(households) });
  } catch (error) {
    stopWorker();
    status.textContent = error.message;
  }
});

try {
  const sample = readAtlasSampleURL(location.search);
  if (sample) showSample(sample);
} catch (error) {
  status.textContent = error.message;
}
