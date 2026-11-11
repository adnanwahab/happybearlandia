import { BASELINE, normalizeRecipe, readRecipe } from './model.js';
import { mountHousehold } from './household.js';
import { mountQueues } from './queues.js';
import { mountTheater } from './theater.js';

const find = id => document.getElementById(id);
const form = find('setup');
const status = find('status');
const timeline = find('month');
const future = find('future');
const project = find('project');
const play = find('play');
const queues = mountQueues(find('queues'));
const theater = mountTheater(find('theater'));
const household = mountHousehold(find('family'));
const query = new URLSearchParams(location.search);
let comparison;
let timer;

find('baseline').textContent =
  `Baseline each month · ${BASELINE.permits} permit · ${BASELINE.labor} labor units · ${BASELINE.materials} material units`;

function fill(recipe) {
  for (const name of ['seed', 'months', 'permits', 'labor', 'materials']) form.elements[name].value = recipe[name];
}

function stop() {
  clearInterval(timer);
  timer = undefined;
  play.textContent = 'Play timeline';
}

function render() {
  const month = Number(timeline.value);
  const { baseline, adjusted, recipe } = comparison;
  find('month-label').value = `Month ${month} of ${recipe.months}`;
  queues.render(baseline[month], adjusted[month]);
  const arm = comparison[future.value];
  theater.render(arm[month], project.value || null);
  renderProjectHistory(arm, month, project.value);
  household.render(baseline[month], adjusted[month]);

  const url = new URL(location.href);
  url.searchParams.set('recipe', JSON.stringify(recipe));
  url.searchParams.set('month', month);
  url.searchParams.set('future', future.value);
  if (project.value) url.searchParams.set('project', project.value);
  else url.searchParams.delete('project');
  find('share').href = url.href;
  history.replaceState(history.state, '', url);
}

function renderProjectHistory(arm, month, id) {
  const events = arm.slice(0, month + 1).flatMap(row =>
    row.projects.find(item => item.id === id)?.events ?? []);
  const rows = events.map(event => {
    const item = document.createElement('li');
    const link = document.createElement('button');
    link.type = 'button';
    link.textContent = `Month ${event.simulationTime}`;
    link.onclick = () => jump(event.simulationTime, future.value, id);
    const details = [event.eventType.toLowerCase().replaceAll('_', ' '), event.payload.reason].filter(Boolean);
    item.append(link, ' ' + details.join(' · '));
    return item;
  });
  if (!rows.length) {
    const item = document.createElement('li');
    item.textContent = 'No project events by this month.';
    rows.push(item);
  }
  find('project-events').replaceChildren(...rows);
}

function jump(month, arm, id) {
  stop();
  timeline.value = month;
  future.value = arm;
  if (id && [...project.options].some(option => option.value === id)) project.value = id;
  render();
}

function show(result, selection) {
  comparison = result;
  const { baseline, adjusted, recipe } = result;
  const last = recipe.months;
  const projects = adjusted[last].projects;
  project.replaceChildren(...projects.map(row => new Option(`${row.districtName} · ${row.id}`, row.id)));
  if (!projects.length) project.add(new Option('Awaiting project creation', ''));
  project.disabled = !projects.length;
  timeline.max = last;
  timeline.value = Number.isInteger(selection.month) && selection.month >= 0 && selection.month <= last
    ? selection.month : Math.min(4, last);
  future.value = selection.future === 'baseline' ? 'baseline' : 'adjusted';
  if (projects.some(row => row.id === selection.project)) project.value = selection.project;

  const delay = baseline.find(row => row.projects.some(item =>
    item.events.some(event => ['CAPACITY_DELAY', 'MATERIAL_DELAY'].includes(event.eventType))));
  const delayedProject = delay?.projects.find(item =>
    item.events.some(event => ['CAPACITY_DELAY', 'MATERIAL_DELAY'].includes(event.eventType)));
  find('bottleneck').disabled = !delay;
  find('bottleneck').onclick = () => jump(delay.month, 'baseline', delayedProject.id);

  const move = adjusted.find(row => row.household.move && row.household.firstHousedMonth === row.month);
  const newProject = move?.projects.find(row => row.buildingId === move.household.buildingId);
  find('move').disabled = !move;
  find('move').onclick = () => jump(move.month, 'adjusted', newProject?.id);

  const placement = arm => arm[last].household.firstHousedMonth === null
    ? `no placement by month ${last}` : `month ${arm[last].household.firstHousedMonth}`;
  const completions = arm => arm[last].projects.filter(row => row.stage === 'completion').length;
  find('outcome').textContent =
    `First housing placement · Baseline ${placement(baseline)} · Adjusted ${placement(adjusted)}. By month ${last}, ${completions(baseline)} baseline and ${completions(adjusted)} adjusted projects completed.`;
  find('version').textContent = `Seed ${recipe.seed} · ${recipe.modelVersion} · ${recipe.version}`;
  find('comparison').hidden = false;
  render();
}

function run(input, selection = {}) {
  stop();
  let recipe;
  try {
    recipe = normalizeRecipe(input);
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  const submit = form.querySelector('button');
  submit.disabled = true;
  find('comparison').hidden = true;
  status.textContent = 'Running the same-seed City futures…';
  try {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const finish = message => {
      worker.terminate();
      submit.disabled = false;
      status.textContent = message;
    };
    worker.onmessage = ({ data }) => {
      if (data.error) {
        finish(data.error);
        return;
      }
      show(data.comparison, selection);
      finish('Matched futures ready.');
    };
    worker.onerror = () => finish('The City simulation worker could not run.');
    worker.postMessage(recipe);
  } catch {
    submit.disabled = false;
    status.textContent = 'The City simulation worker could not start.';
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  run(Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)])));
});
timeline.addEventListener('input', () => { stop(); render(); });
future.addEventListener('change', render);
project.addEventListener('change', render);
play.addEventListener('click', () => {
  if (timer) {
    stop();
    return;
  }
  if (timeline.value === timeline.max) {
    timeline.value = 0;
    render();
  }
  play.textContent = 'Pause timeline';
  timer = setInterval(() => {
    timeline.value = Number(timeline.value) + 1;
    render();
    if (timeline.value === timeline.max) stop();
  }, 550);
});
fill(normalizeRecipe());
try {
  const recipe = readRecipe(query.get('recipe'));
  fill(recipe);
  run(recipe, {
    month: query.has('month') ? Number(query.get('month')) : undefined,
    future: query.get('future'), project: query.get('project'),
  });
} catch (error) {
  status.textContent = error.message;
}
