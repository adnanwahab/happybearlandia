import { HISTOGRAM_OPTIONS, summarizeHistogram } from './histogram-data.js';

const get = id => document.getElementById(id);
const run = get('run');
const cancel = get('cancel');
const status = get('status');
const results = get('results');
const chart = get('histogram');
const missing = get('missing');
const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const reason = {
  'no-job': 'worker had no job',
  'not-in-city': 'worker was absent from the city',
  'no-recorded-trip': 'no trip was recorded',
  unavailable: 'commute was unavailable',
};
let worker;
let timeout;

function cell(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

function render(result) {
  const { requested, measured, bins, missing: gaps, unreported, shorter, unchanged, longer, mean, median } =
    summarizeHistogram(result.samples);
  get('coverage').textContent = [
    `${measured} of ${requested} requested pairs had a recorded commute in both runs.`,
    `${gaps.length} pairs lacked a commute in at least one run. ${unreported.length} pairs returned no result.`,
  ].join(' ');
  const stats = get('stats');
  stats.replaceChildren();
  if (measured) {
    const values = [
      ['Shorter', `${shorter} / ${measured}`],
      ['Unchanged', `${unchanged} / ${measured}`],
      ['Longer', `${longer} / ${measured}`],
      ['Mean change', `${formatter.format(mean)} min`],
      ['Median change', `${formatter.format(median)} min`],
    ];
    for (const [label, value] of values) {
      const item = document.createElement('div');
      item.append(cell('dt', label), cell('dd', value));
      stats.append(item);
    }
  }
  chart.hidden = measured === 0;
  chart.tBodies[0].replaceChildren(...bins.map(({ label, count }) => {
    const row = document.createElement('tr');
    const bin = cell('th', label);
    bin.scope = 'row';
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.width = measured ? `${100 * count / measured}%` : '0%';
    bin.prepend(bar);
    const total = cell('td', count);
    total.className = 'count';
    row.append(bin, total);
    return row;
  }));
  missing.hidden = gaps.length === 0;
  missing.open = false;
  missing.querySelector('ul').replaceChildren(...gaps.map(gap => {
    const arms = ['baseline', 'intervention'].filter(arm => gap[arm])
      .map(arm => `${arm} — ${reason[gap[arm]] ?? 'commute was unavailable'}`);
    return cell('li', `Pair ${gap.index + 1} (seed ${gap.seed}), ${arms.join(', ')}`);
  }));
  get('method').textContent = `Scenario ${result.scenarioVersion} · Model ${result.modelVersion} · Base seed ${result.seed} · Final month ${result.startMonth + result.months}`;
  results.hidden = false;
}

function finish(message) {
  clearTimeout(timeout);
  worker?.terminate();
  worker = undefined;
  run.disabled = false;
  cancel.hidden = true;
  status.textContent = message;
}

function fail(message) {
  finish(`${message} No results were returned for the ${HISTOGRAM_OPTIONS.samples} requested pairs.`);
}

run.addEventListener('click', () => {
  results.hidden = true;
  run.disabled = true;
  cancel.hidden = false;
  status.textContent = 'Simulating 100 baseline and intervention pairs…';
  try {
    worker = new Worker(new URL('../living-city/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      try {
        if (data.error) throw new Error(data.error);
        render(data.result);
        finish('Simulation complete.');
      } catch (error) {
        fail(`Simulation failed. ${error.message}`);
      }
    };
    worker.onerror = () => fail('The simulation worker could not finish.');
    worker.onmessageerror = () => fail('The simulation response could not be read.');
    timeout = setTimeout(() => fail('The simulation timed out.'), 120_000);
    worker.postMessage({ id: 1, action: 'compare', options: HISTOGRAM_OPTIONS });
  } catch (error) {
    fail(`The simulation could not start. ${error.message}`);
  }
});

cancel.addEventListener('click', () => {
  fail('Simulation canceled.');
  run.focus();
});
