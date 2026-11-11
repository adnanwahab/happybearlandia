import { mountPlot } from './plot.js';
import { ingredients, normalizeGenomeRecipe } from './model.js';

const form = document.querySelector('#recipe');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
const submit = form.querySelector('button');
const metrics = {
  households: 'Households',
  housingUnits: 'Housing units',
  unhoused: 'Unhoused households',
  meanRent: 'Mean rent (modeled USD/month)',
  employed: 'Employed residents',
  meanTravelMinutes: 'Mean link travel time (minutes)',
  utilityFailures: 'Utilities serving below demand',
  completedProjects: 'Completed projects',
  balance: 'Public balance (modeled USD)',
};
const updatePlot = mountPlot(metrics);
const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const signed = new Intl.NumberFormat(undefined, { signDisplay: 'exceptZero', maximumFractionDigits: 2 });
const ingredientInputs = document.querySelector('#ingredients');
for (const [key, shock] of Object.entries(ingredients)) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.name = 'shocks';
  checkbox.value = key;
  label.append(checkbox, `${shock.label} · months ${shock.start}–${shock.start + shock.duration - 1} · severity ${shock.severity}`);
  ingredientInputs.append(label);
}

function fill(recipe) {
  for (const key of ['seed', 'constructionSpeed', 'populationGrowth', 'land', 'energy', 'transport', 'constructionCost']) {
    form.elements.namedItem(key).value = key === 'populationGrowth' ? Number((recipe[key] * 100).toFixed(8)) : recipe[key];
  }
  for (const checkbox of ingredientInputs.querySelectorAll('input')) {
    checkbox.checked = recipe.shocks.includes(checkbox.value);
  }
}

function show({ recipe, modelVersion, baseline, edited, series, sensitivity }) {
  document.querySelector('#scope').textContent =
    `Month ${edited.month} · Seed ${recipe.seed} · ${modelVersion} / ${recipe.version} · Synthetic monthly City model`;
  document.querySelector('#metrics').replaceChildren(...Object.entries(metrics).map(([key, label]) => {
    const row = document.createElement('tr');
    const title = document.createElement('th');
    title.scope = 'row';
    title.textContent = label;
    row.append(title);
    for (const value of [formatter.format(baseline[key]), formatter.format(edited[key]), signed.format(edited[key] - baseline[key])]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  const list = document.createElement('ul');
  for (const { label, metrics: result } of sensitivity) {
    const item = document.createElement('li');
    const changes = Object.entries(metrics).filter(([key]) => Math.abs(result[key] - edited[key]) >= 0.005)
      .map(([key, label]) => `${label} ${signed.format(result[key] - edited[key])}`);
    item.textContent = `Remove ${label.toLowerCase()} change · ${changes.join(' · ') || 'No displayed metric moved'}`;
    list.append(item);
  }
  const note = document.createElement('p');
  note.textContent = 'Change at least one assumption to see a sensitivity comparison.';
  document.querySelector('#sensitivity').replaceChildren(sensitivity.length ? list : note);
  const url = new URL(location.href);
  url.searchParams.set('recipe', JSON.stringify(recipe));
  document.querySelector('#share').href = url.href;
  history.replaceState(null, '', url);
  output.hidden = false;
  updatePlot(series);
}

function run(input) {
  let recipe;
  try {
    recipe = normalizeGenomeRecipe(input);
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  output.hidden = true;
  submit.disabled = true;
  status.textContent = 'Running matched futures and one-at-a-time sensitivity checks…';

  function finish(message) {
    status.textContent = message;
    submit.disabled = false;
  }
  try {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      worker.terminate();
      if (data.error) {
        finish(data.error);
        return;
      }
      show(data.result);
      finish('Matched futures complete.');
    }, { once: true });
    worker.addEventListener('error', () => {
      worker.terminate();
      finish('The City simulation worker could not run.');
    }, { once: true });
    worker.postMessage(recipe);
  } catch {
    finish('The City simulation worker could not start.');
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const values = Object.fromEntries([...data].filter(([key]) => key !== 'shocks').map(([key, value]) => [key, Number(value)]));
  run({ ...values, populationGrowth: values.populationGrowth / 100, shocks: data.getAll('shocks') });
});

fill(normalizeGenomeRecipe());
const saved = new URLSearchParams(location.search).get('recipe');
if (saved !== null) {
  try {
    if (saved.length > 1000) throw new Error();
    const recipe = normalizeGenomeRecipe(JSON.parse(saved));
    fill(recipe);
    run(recipe);
  } catch {
    status.textContent = 'This link contains an invalid or unsupported genome recipe.';
  }
}
