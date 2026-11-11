import { decodePlan, encodePlan, futureURL, normalizePlan, planCost, POLICY_CATALOG } from '../model.js';

const status = document.querySelector('#status');
const section = document.querySelector('#result');
const slider = document.querySelector('#month');
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function commute(value) {
  return value === null ? 'Unavailable' : `${number.format(value)} min`;
}

function show({ recipe, series, scenarioVersion }, selectedMonth) {
  const encoded = encodePlan(recipe);
  document.querySelector('#merge').href = '/world/invention/merge/?' + new URLSearchParams({ left: encoded });
  document.querySelector('#breakpoint').href = '/world/invention/breakpoints/?' + new URLSearchParams({ plan: encoded });
  document.querySelector('#scope').textContent = `Seed ${recipe.seed} · ${scenarioVersion} · ${recipe.modelVersion}`;
  document.querySelector('#cost').textContent = `Total proposed cost · ${money.format(planCost(recipe))} modeled USD`;
  slider.min = series[0].month;
  slider.max = series.at(-1).month;
  slider.value = selectedMonth ?? slider.max;

  function render() {
    const month = Number(slider.value);
    const row = series[month - series[0].month];
    document.querySelector('#snapshot').textContent = `Month ${month}`;
    const metrics = [
      ['Mean recorded commute', commute(row.meanCommuteMinutes)],
      ['Recorded trips', number.format(row.commuteCount)],
      ['Unemployment among available workers', row.unemploymentRate === null ? 'Unavailable' : percent.format(row.unemploymentRate)],
      ['Unhoused households', number.format(row.unhoused)],
      ['Mean rent per month', money.format(row.meanRent) + ' modeled USD'],
      ['Public balance', money.format(row.publicBalance) + ' modeled USD'],
    ];
    document.querySelector('#metrics').replaceChildren(...metrics.map(([label, value]) => {
      const block = element('div');
      block.append(element('dt', label), element('dd', value));
      return block;
    }));

    const policyRows = recipe.policies.map(id => {
      const policy = POLICY_CATALOG.find(item => item.id === id);
      const stage = row.policyStages.find(item => item.id === id)?.stage ?? 'Pending submission';
      return element('li', `${policy.label} · ${stage}`);
    });
    document.querySelector('#policies').replaceChildren(...(policyRows.length ? policyRows : [element('li', 'Baseline plan')]));

    document.querySelector('#districts').replaceChildren(...row.districts.map(district => {
      const tr = element('tr');
      const heading = element('th', district.name);
      heading.scope = 'row';
      tr.append(heading, ...[
        commute(district.meanCommuteMinutes), district.commuteCount, district.housingUnits, district.unhoused,
      ].map(value => element('td', String(value))));
      return tr;
    }));

    const events = row.events.map(event => element('li', [
      event.eventType, event.system, event.geographyId, JSON.stringify(event.payload),
    ].filter(Boolean).join(' · ')));
    document.querySelector('#events').replaceChildren(...(events.length ? events : [element('li', 'No system events emitted this month.')]));
    history.replaceState(null, '', futureURL(recipe, month));
  }

  slider.addEventListener('input', render);
  render();
  section.hidden = false;
  status.textContent = 'Recomputed from the selected City plan.';
}

try {
  const query = new URLSearchParams(location.search);
  if (query.getAll('plan').length > 1 || query.getAll('month').length > 1) throw new Error('This replay link has repeated settings.');
  const recipe = query.has('plan') ? decodePlan(query.get('plan')) : normalizePlan();
  const month = query.has('month') ? Number(query.get('month')) : undefined;
  futureURL(recipe, month); // Validate the selected month before starting a worker.
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data }) => {
    worker.terminate();
    if (data.error) status.textContent = data.error;
    else show(data.result, month);
  }, { once: true });
  worker.addEventListener('error', () => {
    worker.terminate();
    status.textContent = 'The City replay worker could not run.';
  }, { once: true });
  worker.postMessage(recipe);
} catch (error) {
  status.textContent = error.message;
}
