import { searchFutures } from './search.js';

const form = document.querySelector('form');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

function append(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}

function showEvidence(parent, evidence, unit) {
  if (!evidence) {
    append(parent, 'span', 'Unavailable');
    return;
  }
  append(parent, 'a', number.format(evidence.value) + ' ' + unit).href = evidence.url;
}

function runResult(container, { run, status, error, metrics, replay }, { start, end }) {
  const article = append(container, 'article', '');
  append(article, 'h3', run.id);
  append(article, 'p', `Seed ${run.context.seed} · ${run.context.modelVersion} · ${run.context.scenarioId}`);
  if (error) {
    append(article, 'p', error);
    return;
  }

  const table = append(article, 'table', '');
  const head = append(append(table, 'thead', ''), 'tr', '');
  for (const name of ['Recorded metric', 'Month ' + start, 'Month ' + end, 'Change']) {
    append(head, 'th', name).scope = 'col';
  }
  const body = append(table, 'tbody', '');
  for (const metric of metrics) {
    const row = append(body, 'tr', '');
    append(row, 'th', metric.label).scope = 'row';
    showEvidence(append(row, 'td', ''), metric.start, metric.unit);
    showEvidence(append(row, 'td', ''), metric.end, metric.unit);
    append(row, 'td', metric.change === null ? 'Unavailable' :
      (metric.change > 0 ? '+' : '') + number.format(metric.change) + ' ' + metric.unit);
  }
  if (status === 'missing') append(article, 'p', 'At least one required observation is missing, ambiguous, or uses an unsupported unit.');
  if (replay.length) {
    const links = append(article, 'ul', '');
    for (const { tick, url } of replay) {
      append(append(links, 'li', ''), 'a', `Replay month ${tick} ↗`).href = url;
    }
  }
  if (replay.length < 2) {
    append(article, 'p', replay.length
      ? 'Replay is unavailable for the other selected month.'
      : 'Replay is unavailable for both selected months.');
  }
}

function render(report, query) {
  const { results: rows, truncated } = report;
  if (!rows.length) {
    status.textContent = truncated ? 'The scanned catalog page has no supported City runs.' :
      'No completed monthly City runs have been saved. Open the World Time Machine to record the demo.';
    return;
  }
  const matches = rows.filter(row => row.status === 'match').length;
  status.textContent = `${matches} of ${rows.length} saved City runs matched.` +
    (truncated ? ' This browser search covers the first catalog page and up to 24 City runs.' : '');
  for (const [state, label] of [
    ['match', 'Matches'], ['missing', 'Unavailable evidence'], ['excluded', 'Outside your conditions'],
  ]) {
    const group = rows.filter(row => row.status === state);
    if (!group.length) continue;
    const section = append(results, state === 'excluded' ? 'details' : 'section', '');
    append(section, state === 'excluded' ? 'summary' : 'h2', `${label} (${group.length})`);
    for (const result of group) runResult(section, result, query);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(form);
  const query = {
    start: Number(data.get('start')),
    end: Number(data.get('end')),
    rent: data.get('rent'),
    travel: data.get('travel'),
  };
  const button = form.querySelector('button');
  button.disabled = true;
  results.replaceChildren();
  status.textContent = 'Reading saved observations…';
  try {
    render(await searchFutures(query), query);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
