import { decodePlan, encodePlan, futureURL, PLAN_DEFAULTS, POLICY_CATALOG } from '../model.js';
import { BREAKPOINT_VERSION, metrics, runBreakpoint } from './model.js';

const find = id => document.getElementById(id);
const form = find('rule');
const select = find('metric');
const threshold = find('threshold');
const status = find('status');
const result = find('result');
const params = new URLSearchParams(location.search);
const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 });

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function setUnit() {
  const definition = metrics[select.value];
  find('unit').textContent = `Enter the threshold in ${definition.unit === '%' ? 'percent' : definition.unit}.`;
  threshold.min = definition.min ?? '';
  threshold.max = definition.max ?? '';
  threshold.step = definition.integer ? '1' : 'any';
}

function fillPlan(plan) {
  find('seed').value = plan.seed;
  find('months').value = plan.months;
  const options = find('policies');
  for (const policy of POLICY_CATALOG) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'policy';
    checkbox.value = policy.id;
    checkbox.checked = plan.policies.includes(policy.id);
    const label = element('label', policy.label);
    label.prepend(checkbox);
    options.append(label);
  }
}

function renderEvents(events) {
  const rows = (events ?? []).map(event => {
    const details = document.createElement('details');
    details.append(element('summary', `${event.system} · ${event.eventType.toLowerCase().replaceAll('_', ' ')}`));
    if (typeof event.payload?.reason === 'string') {
      details.append(element('p', `Recorded reason “${event.payload.reason}”`));
    }
    if (event.geographyId) details.append(element('p', `District ${event.geographyId}`));
    details.append(element('pre', JSON.stringify(event.payload, null, 2)));
    return details;
  });
  if (!rows.length) rows.push(element('p', 'No system events were recorded for this month.'));
  find('events').replaceChildren(...rows);
}

function showResult(report) {
  const { hit, startMonth, month, value, previous, tested, missing, recipe, rule, scenarioVersion } = report;
  const metric = metrics[rule.metric];
  const label = value => value === null ? 'Unavailable' : `${format.format(value)}${metric.unit === '%' ? '%' : ` ${metric.unit}`}`;
  find('result-title').textContent = hit ? `Paused at month ${month}`
    : tested ? `No match through month ${month}` : 'No observations available';
  find('observed-label').textContent = hit ? metric.label : `Final ${metric.label.toLowerCase()}`;
  find('observed').textContent = label(value);
  find('target').textContent = label(rule.threshold);
  find('previous-label').hidden = !previous;
  find('previous').hidden = !previous;
  find('previous').textContent = previous
    ? `${label(previous.value)} · Month ${previous.month}${previous.month === startMonth ? ' (initial state)' : ''}` : '—';
  find('tested').textContent = missing ? `${tested} tested · ${missing} unavailable` : String(tested);
  find('run-source').textContent =
    `Generated City simulation · Seed ${recipe.seed} · ${recipe.modelVersion} · ${scenarioVersion} · ${BREAKPOINT_VERSION}`;
  find('future').href = futureURL(recipe, month);
  find('evidence').hidden = !hit;
  if (hit) {
    renderEvents(hit.events);
    find('policy-report').hidden = !hit.policies.length;
    find('policy-stages').replaceChildren(...hit.policies.map(({ id, stage }) => {
      const policy = POLICY_CATALOG.find(candidate => candidate.id === id);
      return element('li', `${policy.label} · ${stage ?? 'Unavailable'}`);
    }));
  }
  status.hidden = true;
  result.hidden = false;
}

function run({ focus = false } = {}) {
  result.hidden = true;
  status.hidden = false;
  status.textContent = 'Running the city model…';
  try {
    const plan = {
      seed: find('seed').valueAsNumber,
      months: find('months').valueAsNumber,
      policies: new FormData(form).getAll('policy'),
    };
    const breakpoint = {
      metric: select.value,
      operator: find('operator').value,
      threshold: threshold.valueAsNumber,
    };
    const report = runBreakpoint(plan, breakpoint);
    showResult(report);
    if (focus) find('result-title').focus();
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ plan: encodePlan(report.recipe), ...report.rule })) {
      url.searchParams.set(key, value);
    }
    history.replaceState(null, '', url);
  } catch (error) {
    result.hidden = true;
    status.hidden = false;
    status.textContent = error.message;
  }
}

select.replaceChildren(...Object.entries(metrics).map(([key, definition]) => new Option(definition.label, key)));
select.addEventListener('change', setUnit);
form.addEventListener('submit', event => {
  event.preventDefault();
  run({ focus: true });
});

let plan = PLAN_DEFAULTS;
let linkedPlan = false;
try {
  if (params.has('plan')) {
    plan = decodePlan(params.get('plan'));
    linkedPlan = true;
  }
} catch (error) {
  status.textContent = `Could not open the linked scenario. ${error.message}`;
}
fillPlan(plan);
if (params.has('metric') && Object.hasOwn(metrics, params.get('metric'))) select.value = params.get('metric');
if (['gt', 'gte', 'lt', 'lte'].includes(params.get('operator'))) find('operator').value = params.get('operator');
if (params.has('threshold')) threshold.value = params.get('threshold');
setUnit();

if (linkedPlan && ['metric', 'operator', 'threshold'].every(key => params.has(key)) && form.checkValidity()) {
  run();
}
