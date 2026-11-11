import {
  horizon, makePolicyReceipt, makeReceiptRecipe, readReceiptRecipe, receiptOptions, sampleCount,
} from './receipt.js';

const form = document.querySelector('form');
const seedField = form.elements.seed;
const amountField = form.elements.amount;
const status = document.querySelector('#status');
const receipt = document.querySelector('#receipt');
const picker = document.querySelector('#pair');
const submit = form.querySelector('button');
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const dollars = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const outcomeLabel = { improved: 'Shorter', unchanged: 'Unchanged', worse: 'Longer', missing: 'Unevaluated' };
let active;

for (const option of receiptOptions) amountField.add(new Option(option.label, option.amount));
amountField.value = 8;

function list(id, rows) {
  const items = rows.map(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    row.append(term, description);
    return row;
  });
  document.querySelector('#' + id).replaceChildren(...items);
}

function format(value, unit, { money = false, signed = false } = {}) {
  if (!Number.isFinite(value)) return 'Unavailable';
  const formatted = (money ? dollars : number).format(value);
  return (signed && value > 0 ? '+' : '') + formatted + ' ' + unit;
}

function renderPair(pair, result) {
  list('evidence', [
    ['Pair seed', pair.seed],
    ['Baseline commute', format(pair.baseline, 'min')],
    ['Transit future commute', format(pair.intervention, 'min')],
    ['Policy stage at end month', pair.stage],
    ['City balance change', format(pair.balance, 'modeled USD', { money: true, signed: true })],
    ['Shared flood exposure', pair.shock
      ? `Starts month ${pair.shock.start} · ${pair.shock.duration} month(s)`
      : 'No scheduled flood'],
  ]);
  document.querySelector('#open-pair').href = pair.evidenceURL;
  const url = new URL(location.href);
  url.searchParams.set('challenge', makeReceiptRecipe({
    seed: result.seed, amount: result.policy.amount, index: pair.index,
  }));
  history.replaceState(history.state, '', url);
}

function render(result, index) {
  list('proposal', [
    ['Proposed capital cost', format(result.policy.cost, 'modeled USD', { money: true })],
    ['Capacity proposed', `+${result.policy.amount} units`],
    ['Policy district', result.policy.districtId],
    ['Observation window', `Month ${result.startMonth} to ${result.endMonth}`],
    ['Stage at end month', result.stages.map(([stage, count]) => `${stage} · ${count} pairs`).join(' / ')],
    ['City model and recipe', `${result.modelVersion} · ${result.scenarioVersion}`],
  ]);
  list('distribution', Object.entries(result.outcomes).map(([key, value]) => [outcomeLabel[key], value]));
  list('uncertainty', [
    ['Mean commute change in measured pairs', format(result.meanCommuteDelta, 'min', { signed: true })],
    ['Commute change range', Number.isFinite(result.minCommuteDelta)
      ? format(result.minCommuteDelta, 'min', { signed: true }) + ' to ' +
        format(result.maxCommuteDelta, 'min', { signed: true })
      : 'Unavailable'],
    ['Mean city balance change across all pairs', format(result.meanBalanceDelta, 'modeled USD', { money: true, signed: true })],
  ]);
  picker.replaceChildren(...result.pairs.map(pair =>
    new Option(`Pair ${pair.index + 1} · ${outcomeLabel[pair.outcome]}`, pair.index)));
  picker.value = index;
  renderPair(result.pairs[picker.selectedIndex], result);
  receipt.hidden = false;
  status.textContent = `Compared ${result.pairs.length} matched pairs · scenario seed ${result.seed}.`;
}

function compare({ seed, amount, index = 0 }) {
  if (submit.disabled) return;
  submit.disabled = true;
  receipt.hidden = true;
  status.textContent = `Comparing ${sampleCount} paired simulations…`;
  try {
    const worker = new Worker(new URL('../../living-city/worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      try {
        if (data.error) throw new Error(data.error);
        active = makePolicyReceipt(data.result);
        render(active, index);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        worker.terminate();
        submit.disabled = false;
      }
    }, { once: true });
    worker.addEventListener('error', () => {
      status.textContent = 'The City simulation worker could not run.';
      worker.terminate();
      submit.disabled = false;
    }, { once: true });
    worker.postMessage({ id: 1, action: 'compare', options: { seed, amount, samples: sampleCount, months: horizon } });
  } catch (error) {
    status.textContent = error.message;
    submit.disabled = false;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  compare({ seed: seedField.valueAsNumber, amount: Number(amountField.value) });
});
picker.addEventListener('change', () => renderPair(active.pairs[picker.selectedIndex], active));
const challenge = new URLSearchParams(location.search).get('challenge');
if (challenge) {
  try {
    const recipe = readReceiptRecipe(challenge);
    seedField.value = recipe.seed;
    amountField.value = recipe.amount;
    compare(recipe);
  } catch (error) {
    status.textContent = error.message;
  }
} else {
  compare({ seed: seedField.valueAsNumber, amount: Number(amountField.value) });
}
