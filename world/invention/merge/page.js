import { decodePlan, encodePlan, futureURL, PLAN_DEFAULTS, POLICY_CATALOG } from '../model.js';
import { measures, mergePlans, readFutureLink } from './merge.js';

const form = document.querySelector('form');
const status = document.querySelector('#status');
const run = document.querySelector('#run');
const results = document.querySelector('#results');
const labels = { baseline: 'Baseline', left: 'Future A', right: 'Future B', merged: 'Merged' };
const policies = new Map(POLICY_CATALOG.map(policy => [policy.id, policy.label]));
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

function append(parent, tag, text = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}

function format(value, unit, multiplier = 1) {
  return Number.isFinite(value) ? number.format(value * multiplier) + ' ' + unit : 'Unavailable';
}

function render({ arms, shared, interactions }) {
  const { recipe } = arms.merged;
  document.querySelector('#scope').textContent =
    `Seed ${recipe.seed} · ${recipe.months} simulated months · City model ${recipe.modelVersion} · ${recipe.version}`;
  const cards = document.querySelector('#arms');
  cards.replaceChildren();
  for (const [key, arm] of Object.entries(arms)) {
    const card = append(cards, 'article');
    append(card, 'h3', labels[key]);
    append(card, 'p', format(arm.cost, 'modeled USD') + ' proposed capital cost');
    if (arm.recipe.policies.length) {
      const list = append(card, 'ul');
      for (const { id, stage } of arm.final.policyStages) {
        append(list, 'li', policies.get(id) + ' · ' + (stage ?? 'stage unavailable'));
      }
    } else append(card, 'p', 'No new policies');
    append(card, 'a', 'Open ' + labels[key].toLowerCase() + ' ↗').href = arm.href;
  }

  const metrics = document.querySelector('#metrics');
  metrics.replaceChildren();
  const table = append(metrics, 'table');
  const header = append(append(table, 'thead'), 'tr');
  for (const label of ['Metric', ...Object.values(labels)]) append(header, 'th', label).scope = 'col';
  const body = append(table, 'tbody');
  for (const metric of measures) {
    const row = append(body, 'tr');
    append(row, 'th', metric.label).scope = 'row';
    for (const { final } of Object.values(arms)) {
      append(row, 'td', format(final[metric.key], metric.unit, metric.multiplier));
    }
  }

  const interactionPanel = document.querySelector('#interactions');
  interactionPanel.replaceChildren();
  if (shared.length) {
    append(interactionPanel, 'p', `Shared policies counted once in the merged plan. ${shared.map(id => policies.get(id)).join(', ')}.`);
    append(interactionPanel, 'p', 'A separate-effects comparison is unavailable because both sources include a shared policy.');
  } else {
    append(interactionPanel, 'p', 'The difference below compares the merged change with the sum of the two separate changes from baseline. It describes this modeled seed.');
    const summary = append(interactionPanel, 'dl');
    for (const metric of measures) {
      append(summary, 'dt', metric.label);
      append(summary, 'dd', format(interactions[metric.key], metric.deltaUnit ?? metric.unit, metric.multiplier));
    }
  }
  results.hidden = false;
  status.textContent = 'Compared the baseline, both source plans, and the merged plan.';
}

function updateURL(plans) {
  const url = new URL(location.href);
  url.searchParams.set('left', encodePlan(plans.left));
  url.searchParams.set('right', encodePlan(plans.right));
  history.replaceState(null, '', url);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (run.disabled) return;
  results.hidden = true;
  let plans;
  try {
    plans = mergePlans(readFutureLink(form.elements.left.value), readFutureLink(form.elements.right.value));
  } catch (error) {
    status.textContent = error.message;
    return;
  }

  run.disabled = true;
  status.textContent = 'Rerunning four plans from the same City seed…';
  try {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    function finish() {
      worker.terminate();
      run.disabled = false;
    }
    worker.addEventListener('message', ({ data }) => {
      try {
        if (data.error) throw new Error(data.error);
        render(data.result);
        updateURL(plans);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        finish();
      }
    }, { once: true });
    worker.addEventListener('error', () => {
      status.textContent = 'The City comparison worker could not run.';
      finish();
    }, { once: true });
    worker.postMessage({ left: plans.left, right: plans.right });
  } catch (error) {
    status.textContent = error.message;
    run.disabled = false;
  }
});

function fill(left, right) {
  form.elements.left.value = futureURL(left);
  form.elements.right.value = futureURL(right);
}

document.querySelector('#example').addEventListener('click', () => {
  const transit = POLICY_CATALOG.find(policy => policy.type === 'transit' && policy.districtId === 'd1' && policy.amount === 8);
  const housing = POLICY_CATALOG.find(policy => policy.type === 'housing' && policy.districtId === 'd0' && policy.amount === 3);
  const settings = { ...PLAN_DEFAULTS, months: 20 };
  fill({ ...settings, policies: [transit.id] }, { ...settings, policies: [housing.id] });
});

const params = new URLSearchParams(location.search);
try {
  for (const key of ['left', 'right']) {
    if (params.getAll(key).length > 1) throw new Error('The comparison link repeats a source recipe.');
    if (params.has(key)) form.elements[key].value = futureURL(decodePlan(params.get(key)));
  }
  if (form.elements.left.value && form.elements.right.value) form.requestSubmit();
} catch (error) {
  status.textContent = error.message;
}
