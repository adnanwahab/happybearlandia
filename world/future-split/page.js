import { DEFAULT_RECIPE, POLICY_OPTIONS, decodeRecipe, encodeRecipe, normalizeRecipe } from './model.js';
import { mountEvidence } from './evidence.js';
import { mountScene } from './scene.js';

const form = document.querySelector('.compare-form');
const { policy, seed, months } = form.elements;
const submit = form.querySelector('button');
const status = document.querySelector('.run-status');
const comparison = document.querySelector('#comparison');
const monthChip = document.querySelector('#current-month');
const play = document.querySelector('#timeline-play');
const provenanceList = document.querySelector('#run-provenance');

let run = null;
let frame = null;
let selectedId = null;
let busy = false;
let playback = null;

const scene = mountScene(document.querySelector('#scene'), { onSelect: selectEntity });
const evidence = mountEvidence({
  impact: document.querySelector('#impact'),
  timeline: document.querySelector('#timeline'),
  inspector: document.querySelector('#inspector'),
  onMonth(month) {
    stopPlayback();
    selectMonth(month);
  },
  onSelect: selectEntity,
});

function render() {
  monthChip.textContent = `Month ${frame.month}`;
  scene.render(frame, selectedId);
  evidence.render(run, frame, selectedId);
}

function selectEntity(id) {
  stopPlayback();
  selectedId = id;
  render();
}

function selectMonth(month) {
  const next = run.frames.find(row => row.month === month);
  if (!next) return;
  frame = next;
  const url = new URL(location.href);
  url.searchParams.set('run', encodeRecipe(run.recipe));
  url.searchParams.set('month', String(month));
  history.replaceState(null, '', url);
  render();
}

function stopPlayback() {
  if (playback !== null) clearInterval(playback);
  playback = null;
  play.textContent = 'Play timeline';
}

play.addEventListener('click', () => {
  if (playback !== null) {
    stopPlayback();
    return;
  }
  const end = run.frames.at(-1).month;
  if (frame.month === end) selectMonth(run.frames[0].month);
  play.textContent = 'Pause timeline';
  playback = setInterval(() => {
    selectMonth(frame.month + 1);
    if (frame.month === end) stopPlayback();
  }, 850);
});

function setStatus(message, isError = false) {
  status.textContent = message;
  status.toggleAttribute('data-error', isError);
}

function populateForm(recipe) {
  policy.value = recipe.policyId;
  seed.value = recipe.seed;
  months.value = recipe.months;
}

function renderProvenance() {
  const { provenance, recipe } = run;
  const rows = [
    ['Source', provenance.source],
    ['City model', recipe.modelVersion],
    ['Scenario', recipe.scenarioVersion],
    ['Recipe', recipe.version],
    ['Shared seed', recipe.seed],
    ['Checkpoint month', run.frames[0].month],
    ['Horizon', `${recipe.months} months`],
    ['Assumptions', Array.isArray(provenance.assumptions) ? provenance.assumptions.join(' ') : provenance.assumptions],
  ];
  provenanceList.replaceChildren(...rows.flatMap(([label, value]) => {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    return [term, description];
  }));
}

function runInWorker(recipe) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.run);
    }, { once: true });
    worker.addEventListener('error', () => {
      worker.terminate();
      reject(new Error('The City simulation could not start. Try comparing again.'));
    }, { once: true });
    worker.postMessage(recipe);
  });
}

async function compare(recipe, requestedMonth) {
  if (busy) return;
  busy = true;
  stopPlayback();
  submit.disabled = true;
  comparison.hidden = true;
  setStatus('Simulating two monthly City histories…');
  try {
    run = await runInWorker(recipe);
    selectedId = null;
    const first = run.frames[0].month;
    if (requestedMonth !== null && !run.frames.some(row => row.month === requestedMonth)) {
      throw new Error('The linked month is outside this comparison. Run the comparison again to start at the shared checkpoint.');
    }
    renderProvenance();
    comparison.hidden = false;
    selectMonth(requestedMonth ?? first);
    setStatus(`${run.frames.length} matched checkpoints ready. The URL preserves this recipe and month.`);
  } catch (error) {
    comparison.hidden = true;
    setStatus(error.message, true);
  } finally {
    busy = false;
    submit.disabled = false;
  }
}

for (const option of POLICY_OPTIONS) policy.add(new Option(option.label, option.id));

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const recipe = normalizeRecipe({ seed: seed.valueAsNumber, months: months.valueAsNumber, policyId: policy.value });
    void compare(recipe, null);
  } catch (error) {
    setStatus(error.message, true);
  }
});

populateForm(DEFAULT_RECIPE);
try {
  const query = new URLSearchParams(location.search);
  const recipe = query.has('run') ? decodeRecipe(query.get('run')) : DEFAULT_RECIPE;
  populateForm(recipe);
  const rawMonth = query.get('month');
  const requestedMonth = rawMonth === null ? null : /^\d+$/.test(rawMonth) ? Number(rawMonth) : NaN;
  void compare(recipe, requestedMonth);
} catch (error) {
  setStatus(error.message, true);
}
