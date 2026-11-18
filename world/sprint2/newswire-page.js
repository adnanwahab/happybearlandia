import {
  CITYWIDE, UNMAPPED, demoRunId, filterNewswire, listNewswireRuns, readNewswire,
} from './newswire.js';

const find = id => document.getElementById(id);
const runPicker = find('run');
const neighborhood = find('neighborhood');
const month = find('month');
const year = find('year');
const filters = [neighborhood, month, year];
const status = find('status');
const stories = find('stories');
const runContext = find('run-context');
const mappingStatus = find('mapping-status');
const requestedRun = new URLSearchParams(location.search).get('runId');

let runs = [];
let archive;
let pending;

function options(select, placeholder, choices) {
  select.replaceChildren(new Option(placeholder, ''), ...choices.map(([id, label]) => new Option(label, id)));
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function renderStory(story) {
  const { event } = story;
  const source = event.payload.source;
  const article = element('article');
  const link = element('a', 'Inspect source event');
  link.href = story.href;
  const record = element('details');
  record.append(
    element('summary', 'Recorded event data'),
    element('p', `${event.type} · ${source.system} · ${event.provenance.modelVersion}`),
    element('p', `Recorded geography ID: ${source.geographyId ?? 'none'}`),
    element('pre', JSON.stringify(source.payload, null, 2)),
  );
  article.append(
    element('p', `Year ${story.year}, month ${story.month} · Tick ${event.context.tick} · ${story.neighborhoodName}`, 'dateline'),
    element('h2', story.headline),
    element('p', `Simulation narrative · ${story.desk}`, 'story-label'),
    element('p', story.copy),
    record,
    link,
  );
  return article;
}

function render() {
  if (!archive) return;
  const matches = filterNewswire(archive.stories, {
    neighborhood: neighborhood.value, month: month.value, year: year.value,
  });
  stories.replaceChildren(...matches.map(renderStory));
  status.textContent = matches.length
    ? `${matches.length} ${matches.length === 1 ? 'story' : 'stories'}`
    : archive.stories.length ? 'No stories match these filters.' : 'This run has no recorded newspaper stories.';
}

async function selectRun(runId) {
  pending?.abort();
  archive = undefined;
  stories.replaceChildren();
  filters.forEach(select => { select.disabled = true; });
  options(neighborhood, 'All neighborhoods', []);
  options(month, 'All months', []);
  options(year, 'All years', []);
  runContext.textContent = '';
  mappingStatus.hidden = true;

  const run = runs.find(item => item.id === runId);
  if (!run) {
    status.textContent = 'The requested run is unavailable. Choose a recorded city run.';
    return;
  }
  const controller = new AbortController();
  pending = controller;
  status.textContent = 'Reading recorded events and district inventory…';
  const { seed, modelVersion } = run.context;
  runContext.textContent = `Seed ${seed} · ${modelVersion} · ${run.id}`;
  try {
    const result = await readNewswire(run, { signal: controller.signal });
    if (controller.signal.aborted) return;
    archive = result;
    const places = result.neighborhoods.map(({ id, name, localId }) => [id, `${name} (${localId})`]);
    options(neighborhood, 'All neighborhoods', [...places, [CITYWIDE, 'Citywide'], [UNMAPPED, 'Unmapped']]);
    options(month, 'All months', Array.from({ length: 12 }, (_, index) => [index + 1, `Month ${index + 1}`]));
    const years = [...new Set(result.ticks.map(tick => Math.ceil(tick / 12)))];
    options(year, 'All years', years.map(value => [value, `Year ${value}`]));
    filters.forEach(select => { select.disabled = false; });
    mappingStatus.hidden = !result.mappingIssue;
    mappingStatus.textContent = result.mappingIssue ? `Neighborhood mapping unavailable. ${result.mappingIssue}` : '';
    render();
  } catch (error) {
    if (!controller.signal.aborted) status.textContent = error.message;
  }
}

runPicker.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('runId', runPicker.value);
  history.replaceState(null, '', url);
  selectRun(runPicker.value);
});
filters.forEach(select => select.addEventListener('change', render));

try {
  runs = await listNewswireRuns();
  options(runPicker, 'Choose a recorded run', runs.map(run => [
    run.id, run.id === demoRunId ? 'Deterministic city demo' : `Seed ${run.context.seed} · ${run.id}`,
  ]));
  runPicker.options[0].disabled = true;
  if (!runs.length) {
    status.textContent = 'No completed city runs are recorded.';
    find('record-help').hidden = false;
  } else {
    runPicker.disabled = false;
    runPicker.value = requestedRun ?? (runs.some(run => run.id === demoRunId) ? demoRunId : runs[0].id);
    await selectRun(runPicker.value);
  }
} catch (error) {
  status.textContent = error.message;
}
