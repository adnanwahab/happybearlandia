const filters = document.querySelector('#filters');
const status = document.querySelector('#status');
const retry = document.querySelector('#retry');
const empty = document.querySelector('#empty');
const list = document.querySelector('#runs');
let runs = [];

function element(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

function runCard(run, months) {
  const card = document.createElement('li');
  const heading = element('h2', { Demo: 'Deterministic demo', Branch: 'City branch', Recording: 'City recording' }[run.kind]);
  const details = document.createElement('dl');
  const first = run.months[0];
  const last = run.months.at(-1);
  const range = first === last ? String(first) : `${first}–${last}`;
  for (const [key, value] of [
    ['Run', run.id], ['Seed', run.seed], ['Model', run.modelVersion],
    ['Recorded months', `${range} (${run.months.length} saved)`],
  ]) {
    details.append(element('dt', key), element('dd', value));
  }

  const history = document.createElement('div');
  history.className = 'history';
  const label = element('label', 'Open at month');
  const select = document.createElement('select');
  for (const month of months) select.add(new Option(String(month), String(month)));
  select.value = String(months.at(-1));
  const link = element('a', 'Open history');
  const updateLink = () => {
    link.href = '/world/causal.html?' + new URLSearchParams({ runId: run.id, month: select.value });
  };
  select.addEventListener('change', updateLink);
  updateLink();
  label.append(select);
  history.append(label, link);
  card.append(heading, details, history);
  return card;
}

function render() {
  const { seed, model, kind, from, through } = filters.elements;
  const start = from.valueAsNumber;
  const end = through.valueAsNumber;
  list.replaceChildren();
  if (!from.validity.valid || !through.validity.valid || start > end) {
    status.textContent = 'Enter an ordered month range using whole months from 0 onward.';
    return;
  }
  for (const run of runs) {
    if ((seed.value.trim() && String(run.seed) !== seed.value.trim()) ||
        (model.value && run.modelVersion !== model.value) ||
        (kind.value && run.kind !== kind.value)) continue;
    const months = run.months.filter(month => !(month < start || month > end));
    if (months.length) list.append(runCard(run, months));
  }
  const count = list.childElementCount;
  if (runs.length === 0) status.textContent = 'No public city runs have been recorded yet.';
  else if (count === 0) status.textContent = 'No saved runs match these filters.';
  else status.textContent = `${count} saved ${count === 1 ? 'run' : 'runs'}`;
}

async function load() {
  retry.hidden = true;
  status.textContent = 'Loading saved runs…';
  try {
    const response = await fetch('/api/causality/saved-futures');
    if (!response.ok) throw new Error('Catalog unavailable');
    ({ items: runs } = await response.json());
    for (const [name, field] of [['model', 'modelVersion'], ['kind', 'kind']]) {
      const values = [...new Set(runs.map(run => run[field]))].sort();
      const select = filters.elements[name];
      select.replaceChildren(select.options[0], ...values.map(value => new Option(value, value)));
    }
    filters.hidden = runs.length === 0;
    empty.hidden = runs.length !== 0;
    render();
  } catch {
    status.textContent = 'Could not load saved city runs.';
    retry.hidden = false;
  }
}

filters.addEventListener('submit', event => event.preventDefault());
filters.addEventListener('input', render);
filters.addEventListener('reset', () => requestAnimationFrame(render));
retry.addEventListener('click', load);
load();
