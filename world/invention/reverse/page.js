import { encodePlan, futureURL, PLAN_DEFAULTS, POLICY_CATALOG } from '../model.js';
import { REVERSE_DEFAULTS, REVERSE_SEARCH_LIMITS } from './model.js';

const byId = id => document.getElementById(id);
const form = byId('goal');
const progress = byId('progress');
const status = byId('progress-status');
const cancel = byId('cancel');
const results = byId('results');
const frontier = byId('frontier');
const table = byId('plan-rows');
const more = byId('more');
const typeLabels = { transit: 'Improve public transit', housing: 'Build public housing', upzone: 'Change zoning capacity' };
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const catalog = new Map(POLICY_CATALOG.map(policy => [policy.id, policy]));
const formatMinutes = value => value === null ? 'Unavailable' : `${number.format(value)} min`;
let worker;

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(label, href) {
  const node = element('a', label);
  node.href = href;
  return node;
}

for (const type of new Set(POLICY_CATALOG.map(policy => policy.type))) {
  const label = element('label');
  const input = element('input');
  input.type = 'checkbox';
  input.name = 'policyTypes';
  input.value = type;
  input.checked = true;
  label.append(input, ' ' + typeLabels[type]);
  byId('interventions').append(label);
}
for (const field of ['targetReductionPercent', 'budget']) form.elements[field].value = REVERSE_DEFAULTS[field];
for (const field of ['seed', 'months']) form.elements[field].value = PLAN_DEFAULTS[field];
for (const limit of REVERSE_SEARCH_LIMITS) {
  const label = limit === REVERSE_SEARCH_LIMITS.at(-1) ? 'Full compatible catalog' : `Up to ${number.format(limit)} alternatives`;
  form.elements.candidateLimit.append(new Option(label, limit));
}

function stopWorker() {
  worker?.terminate();
  worker = null;
  cancel.disabled = true;
}

function planRow(plan) {
  const row = element('tr');
  const heading = element('th');
  heading.scope = 'row';
  const title = element('span', plan.recipe.policies.length
    ? plan.recipe.policies.map(id => catalog.get(id).label).join(' / ')
    : 'No-change baseline');
  title.className = 'plan-title';
  const stages = plan.final.policyStages;
  const active = stages.filter(policy => policy.stage === 'ACTIVE').length;
  const meta = element('span', stages.length ? `${active} of ${stages.length} policies active by month ${plan.final.month}` : '');
  meta.className = 'plan-meta';
  const links = element('div');
  links.className = 'plan-links';
  const encoded = encodePlan(plan.recipe);
  links.append(link('Open future ↗', futureURL(plan.recipe, plan.final.month)));
  if (stages.length) links.append(link('Merge this plan ↗', '/world/invention/merge/?' + new URLSearchParams({ left: encoded })));
  links.append(link('Set breakpoint ↗', '/world/invention/breakpoints/?' + new URLSearchParams({ plan: encoded })));
  heading.append(title, meta, links);
  row.append(heading, ...[
    currency.format(plan.cost),
    formatMinutes(plan.final.meanCommuteMinutes),
    percent.format(plan.reduction / 100),
    number.format(plan.final.commuteCount),
    number.format(plan.final.unhoused),
    plan.final.unemploymentRate === null ? 'Unavailable' : percent.format(plan.final.unemploymentRate),
    number.format(plan.final.housingUnits),
  ].map(value => element('td', value)));
  return row;
}

function showReport(report) {
  const { goal, baseline, state, completed, outsideBudget, omitted, missing, feasibleCount } = report;
  const baselineLink = link('Open no-change baseline ↗', futureURL(goal.baseline, baseline.month));
  byId('baseline').replaceChildren(
    `Baseline · ${formatMinutes(baseline.meanCommuteMinutes)} across ${baseline.commuteCount} modeled trips · Month ${baseline.month} · Seed ${goal.baseline.seed} · `,
    baselineLink,
  );
  byId('coverage').textContent =
    `${number.format(completed)} alternatives evaluated · ${number.format(outsideBudget)} combinations over budget · ` +
    `${number.format(omitted)} affordable combinations outside the search limit${missing ? ` · ${missing} runs without a commute estimate` : ''}.`;

  const title = byId('results-title');
  const description = byId('result-status');
  const target = percent.format(goal.targetReductionPercent / 100);
  if (state === 'feasible') {
    title.textContent = 'Commute target met';
    description.textContent = `${number.format(feasibleCount)} evaluated plans reached a reduction of at least ${target} within the proposed budget.`;
  } else if (state === 'baseline-unavailable') {
    title.textContent = 'Baseline commute unavailable';
    description.textContent = 'The final baseline month has no usable commute measure. Try a different horizon or seed.';
  } else if (state === 'unmeasured') {
    title.textContent = 'Candidate commute unavailable';
    description.textContent = 'The tested alternatives have no usable final-month commute records.';
  } else {
    title.textContent = 'No feasible plan found';
    description.textContent = `No evaluated plan met the ${target} reduction within the proposed budget and tested search space.`;
    if (completed === 0) description.textContent += ' The selected options and budget admitted no alternatives.';
  }

  const plans = report.frontier;
  frontier.hidden = plans.length === 0;
  if (plans.length) {
    byId('frontier-title').textContent = state === 'feasible' ? 'Feasible trade-offs' : 'Best available trade-offs';
    const strongest = plans.reduce((a, b) => a.reduction >= b.reduction ? a : b);
    byId('strongest').textContent = `Strongest commute result · ${percent.format(strongest.reduction / 100)} reduction · ${currency.format(strongest.cost)} proposed cost.`;
    let rendered = 0;
    function appendPage() {
      const page = plans.slice(rendered, rendered + 20);
      table.append(...page.map(planRow));
      rendered += page.length;
      more.hidden = rendered >= plans.length;
    }
    table.replaceChildren();
    more.onclick = appendPage;
    appendPage();
  }
  results.hidden = false;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  stopWorker();
  results.hidden = true;
  progress.hidden = true;
  status.textContent = 'Preparing the search…';

  const data = new FormData(form);
  const types = new Set(data.getAll('policyTypes'));
  const goal = Object.fromEntries(['targetReductionPercent', 'budget', 'seed', 'months', 'candidateLimit']
    .map(key => [key, Number(data.get(key))]));
  goal.allowedPolicies = POLICY_CATALOG.filter(policy => types.has(policy.type)).map(policy => policy.id);

  try {
    const job = new Worker(new URL('./reverse.worker.js', import.meta.url), { type: 'module' });
    worker = job;
    cancel.disabled = false;
    let completed = 0;
    let total = null;
    cancel.onclick = () => {
      stopWorker();
      status.textContent = total === null ? 'Search cancelled during preparation.' : `Search cancelled after ${completed} of ${total} alternatives.`;
    };
    job.onmessage = ({ data: message }) => {
      if (worker !== job) return;
      if (message.type === 'progress') {
        ({ completed, total } = message.progress);
        progress.hidden = total === 0;
        progress.max = total || 1;
        progress.value = completed;
        status.textContent = `Evaluated ${number.format(completed)} of ${number.format(total)} alternatives.`;
      } else if (message.type === 'result') {
        stopWorker();
        status.textContent = 'Search complete.';
        showReport(message.report);
      } else {
        stopWorker();
        status.textContent = message.message;
      }
    };
    job.onerror = () => {
      if (worker !== job) return;
      stopWorker();
      status.textContent = 'The City simulation worker could not start.';
    };
    job.postMessage(goal);
  } catch (error) {
    stopWorker();
    status.textContent = error.message;
  }
});
