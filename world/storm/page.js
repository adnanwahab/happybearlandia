import { mountHazardField } from './hazard-field.js';
import { consequences, impactMetrics } from './compare.js';
import { simulateWaterGPU } from './gpu.js';
import { mountStormScene } from './scene.js';
import {
  buildings, compileStorm, CROSSING_CELL, CROSSING_DRAINS, EDITS, normalizeStorm, readStorm, roads, SIZE, stormCost,
} from './scenario.js';

const find = id => document.getElementById(id);
const form = find('inputs');
const submit = form.querySelector('button');
const armPicker = find('arm');
const tickPicker = find('tick');
const play = find('play');
const branches = find('branches');
const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
const entities = new Map([...roads, ...buildings].map(row => [row.id, row.name]));
const branchKey = 'hbl.storm.branches.v1';
let storedBranches = [];
let edits = [];
let selected = CROSSING_CELL;
let comparison;
let timer;
let ensembleWorker;

function cellLabel(index) {
  return `row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}`;
}

const scene = mountStormScene(find('scene'), { onCell(index) {
  selected = index;
  renderScene();
} });

const hazard = mountHazardField(find('hazard-field'), index => { selected = index; renderScene(); });

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function selectedRecipe() {
  const fields = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, Number(value)]));
  return normalizeStorm({ ...fields, edits });
}

function fill(recipe) {
  for (const name of ['seed', 'rainRate', 'steps']) form.elements[name].value = recipe[name];
  edits = recipe.edits;
  paintEdits();
}

function paintEdits() {
  find('cost').textContent = `Proposed investment · ${money.format(stormCost({ edits }))} modeled USD`;
  find('plan-edits').replaceChildren(...edits.map(edit => {
    const row = element('li', `${EDITS[edit.type].label} · ${cellLabel(edit.cell)}`);
    const remove = element('button', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${EDITS[edit.type].label.toLowerCase()} at ${cellLabel(edit.cell)}`);
    remove.onclick = () => changeEdits(edits.filter(item => item !== edit));
    row.append(remove);
    return row;
  }));
}

function enableResultActions(enabled) {
  for (const id of ['ensemble', 'save', 'download']) find(id).disabled = !enabled;
}

function markDraft() {
  cancelEnsemble();
  find('ensemble-results').replaceChildren();
  find('ensemble-status').textContent = '';
  find('edit-status').textContent = 'Run matched storms to apply these changes.';
  enableResultActions(false);
  find('response-link').hidden = true;
}

function changeEdits(next) {
  if (submit.disabled) return;
  try {
    edits = normalizeStorm({ ...selectedRecipe(), edits: next }).edits;
    paintEdits();
    markDraft();
  } catch (error) {
    find('edit-status').textContent = error.message;
  }
}

for (const [type, { label }] of Object.entries(EDITS)) {
  const button = element('button', label);
  button.type = 'button';
  button.onclick = () => changeEdits([...edits.filter(edit => edit.cell !== selected), { type, cell: selected }]);
  find('edits').append(button);
}
find('preset').onclick = () => changeEdits([
  ...edits.filter(edit => !CROSSING_DRAINS.some(drain => drain.cell === edit.cell)), ...CROSSING_DRAINS,
]);

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
    replayLink();
  }
  play.textContent = 'Play runoff';
}

function replayLink() {
  const url = new URL(location.href);
  url.searchParams.set('storm', JSON.stringify(comparison.recipe));
  url.searchParams.set('step', tickPicker.value);
  url.searchParams.set('arm', armPicker.value);
  find('share').href = url.href;
  find('response-link').href = './response.html?' + new URLSearchParams({ storm: JSON.stringify(comparison.recipe) });
  if (!timer) history.replaceState(history.state, '', url);
}

function renderScene() {
  const arm = comparison?.[armPicker.value];
  if (!arm) return;
  const tick = Number(tickPicker.value);
  const depth = arm.water.frames[tick];
  const { terrain } = arm.input;
  scene.render({ size: SIZE, terrain, depth, buildings, roads, selected });
  hazard.render({ size: SIZE, depth, drains: arm.input.drains, selected,
    provenance: `${comparison.recipe.version} · ${arm.water.modelVersion} · ${arm.water.backend} solver · seed ${comparison.recipe.seed} · ${armPicker.value} · step ${tick} · rain ${comparison.recipe.rainRate} m per step · synthetic terrain and drain inputs; closed edges, illustrative runoff rules` });
  const entity = buildings.find(row => row.cells.includes(selected)) ?? roads.find(row => row.cells.includes(selected));
  find('selection').textContent = `Selected ${cellLabel(selected)}${entity ? ' · ' + entity.name : ''} · Depth ${number.format(depth[selected])} m`;
  find('step-label').value = `Step ${tick} of ${comparison.recipe.steps}`;
  const balance = arm.water.accounting[tick];
  find('water').textContent =
    `Water balance in cell·metres · Rain ${number.format(balance.rainAdded)} · Drained ${number.format(balance.drained)} · Stored ${number.format(balance.stored)}`;
  const changes = arm.impact.events.filter(event => event.tick === tick);
  find('events').replaceChildren(...(changes.length ? changes.map(event => element('li',
    `${entities.get(event.entityId) ?? event.entityId} · ${event.kind.replaceAll(/[-_]/g, ' ')} · ${event.status.replaceAll(/[-_]/g, ' ')}`))
    : [element('li', 'No exposure or access changes at this step.')]));
  replayLink();
}

function show(recipe, inputs, runs, step, selectedArm) {
  comparison = {
    recipe,
    baseline: { input: inputs.baseline, water: runs[0], impact: consequences(runs[0]) },
    adjusted: { input: inputs.adjusted, water: runs[1], impact: consequences(runs[1]) },
  };
  find('impacts').replaceChildren(...Object.entries(impactMetrics).map(([key, label]) => {
    const row = element('tr');
    const heading = element('th', label);
    heading.scope = 'row';
    row.append(heading, ...['baseline', 'adjusted'].map(arm => element('td', String(comparison[arm].impact.totals[key]))));
    return row;
  }));
  find('rules').textContent = `${runs[0].modelVersion} · ${comparison.adjusted.impact.version} · ${money.format(stormCost(recipe))} modeled investment`;
  tickPicker.max = recipe.steps;
  tickPicker.value = Number.isInteger(step) && step >= 0 && step <= recipe.steps ? step : recipe.steps;
  tickPicker.disabled = play.disabled = false;
  armPicker.value = selectedArm === 'baseline' ? 'baseline' : 'adjusted';
  find('results').hidden = false;
  find('edit-status').textContent = '';
  renderScene();
}

function workerResult(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('The storm worker could not run.'));
    };
    worker.postMessage(data);
  });
}

async function run(recipe, step, arm) {
  if (submit.disabled) return;
  stop();
  cancelEnsemble();
  find('ensemble-results').replaceChildren();
  find('ensemble-status').textContent = '';
  submit.disabled = true;
  for (const input of form.querySelectorAll('input')) input.disabled = true;
  branches.disabled = true;
  enableResultActions(false);
  let completed = false;
  find('run-status').textContent = 'Computing matched water simulations…';
  const inputs = { baseline: compileStorm({ ...recipe, edits: [] }), adjusted: compileStorm(recipe) };
  try {
    let runs;
    try {
      runs = [await simulateWaterGPU(inputs.baseline), await simulateWaterGPU(inputs.adjusted)];
    } catch {
      runs = await workerResult({ type: 'storm', ...inputs });
    }
    show(recipe, inputs, runs, step, arm);
    completed = true;
    find('run-status').textContent = `Matched storms ready · ${runs[0].backend} water solver`;
  } catch (error) {
    find('run-status').textContent = error.message;
  } finally {
    submit.disabled = false;
    for (const input of form.querySelectorAll('input')) input.disabled = false;
    branches.disabled = false;
    enableResultActions(completed);
    find('response-link').hidden = !completed;
  }
}

function cancelEnsemble() {
  if (ensembleWorker) {
    ensembleWorker.terminate();
    ensembleWorker = null;
  }
  find('ensemble').disabled = false;
  find('cancel-ensemble').hidden = true;
}

find('ensemble').onclick = () => {
  cancelEnsemble();
  find('ensemble-results').replaceChildren();
  find('ensemble-status').textContent = 'Computing 100 matched storm scenarios in the CPU reference…';
  try {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    ensembleWorker = worker;
    find('ensemble').disabled = true;
    find('cancel-ensemble').hidden = false;
    worker.onmessage = ({ data }) => {
      if (worker !== ensembleWorker) return;
      if (data.completed) {
        find('ensemble-status').textContent = `Completed ${data.completed} of 100 matched storms.`;
        return;
      }
      cancelEnsemble();
      if (data.error) {
        find('ensemble-status').textContent = data.error;
        return;
      }
      find('ensemble-status').textContent = '100 matched storms complete. Each pair shares one seeded intensity between 55% and 145% of the selected rain rate, capped at 0.06 m per step.';
      const list = element('ul');
      for (const [key, row] of Object.entries(data.result)) {
        list.append(element('li', `${impactMetrics[key]} · Mean ${number.format(row.baseline)} baseline / ${number.format(row.adjusted)} edited · ${row.improved} lower, ${row.unchanged} unchanged, ${row.worsened} higher`));
      }
      find('ensemble-results').append(list);
    };
    worker.onerror = () => {
      if (worker !== ensembleWorker) return;
      cancelEnsemble();
      find('ensemble-status').textContent = 'The storm ensemble worker could not run.';
    };
    worker.postMessage({ type: 'ensemble', recipe: comparison.recipe });
  } catch {
    cancelEnsemble();
    find('ensemble-status').textContent = 'The storm ensemble worker could not start.';
  }
};
find('cancel-ensemble').onclick = () => {
  cancelEnsemble();
  find('ensemble-status').textContent = 'Storm ensemble cancelled.';
};

function fillBranches() {
  branches.replaceChildren(new Option('Choose a branch', ''), ...storedBranches.map((branch, index) =>
    new Option(`Branch ${index + 1} · ${branch.edits.length} edits · ${branch.steps} steps`, index)));
}

try {
  const stored = JSON.parse(localStorage.getItem(branchKey) ?? '[]');
  if (Array.isArray(stored)) storedBranches = stored.slice(-10).map(normalizeStorm);
} catch { /* An unavailable or stale branch list leaves an empty picker. */ }
fillBranches();

find('save').onclick = () => {
  const recipe = comparison.recipe;
  try {
    const next = [...storedBranches.slice(-9), recipe];
    localStorage.setItem(branchKey, JSON.stringify(next));
    storedBranches = next;
    fillBranches();
    find('save-status').textContent = 'This storm branch is saved in this browser.';
  } catch {
    find('save-status').textContent = 'Browser storage is unavailable. The shareable recipe still works.';
  }
};
branches.onchange = () => {
  if (branches.value === '') return;
  const recipe = storedBranches[Number(branches.value)];
  fill(recipe);
  run(recipe);
};

find('download').onclick = () => {
  const { recipe, baseline, adjusted } = comparison;
  const record = { recipe, proposedInvestment: stormCost(recipe) };
  for (const [key, arm] of Object.entries({ baseline, adjusted })) {
    record[key] = {
      waterModelVersion: arm.water.modelVersion, backend: arm.water.backend,
      waterBalance: arm.water.accounting, impacts: arm.impact,
    };
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const link = element('a');
  link.href = url;
  link.download = 'storm-event-record.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

form.addEventListener('input', markDraft);
form.onsubmit = event => {
  event.preventDefault();
  try { run(selectedRecipe()); } catch (error) { find('run-status').textContent = error.message; }
};
armPicker.onchange = renderScene;
tickPicker.oninput = () => { stop(); renderScene(); };
play.onclick = () => {
  if (timer) { stop(); return; }
  if (tickPicker.value === tickPicker.max) tickPicker.value = 0;
  renderScene();
  play.textContent = 'Pause runoff';
  timer = setInterval(() => {
    tickPicker.value = Number(tickPicker.value) + 1;
    renderScene();
    if (tickPicker.value === tickPicker.max) stop();
  }, 130);
};
fill(normalizeStorm());
try {
  const query = new URLSearchParams(location.search);
  const recipe = readStorm(query.get('storm'));
  fill(recipe);
  run(recipe, query.has('step') ? Number(query.get('step')) : undefined, query.get('arm'));
} catch (error) {
  find('run-status').textContent = error.message;
}
