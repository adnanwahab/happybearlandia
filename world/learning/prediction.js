import { encodePlan, normalizePlan, PLAN_START_MONTH } from '../invention/model.js';

export const PREDICTION_VERSION = 'city-prediction.v1';

const metrics = new Map([
  ['meanRent', { label: 'Mean monthly rent', unit: 'modeled USD', tolerance: 250, limit: 50_000 }],
  ['meanCommuteMinutes', { label: 'Mean commute time', unit: 'minutes', tolerance: 10, limit: 1_000 }],
  ['unemploymentRate', { label: 'Unemployment rate', unit: 'percentage points', tolerance: 10, limit: 100, scale: 100 }],
  ['unhoused', { label: 'Unhoused households', unit: 'households', tolerance: 10, limit: 10_000, integer: true }],
  ['housingUnits', { label: 'Housing inventory', unit: 'units', tolerance: 10, limit: 10_000, integer: true }],
]);

/** Expected is the signed adjusted-minus-baseline change in the selected metric's display unit. */
export function createPrediction(plan, { metric, expected } = {}, createdAt = Date.now()) {
  if (!plan) throw new Error('Choose a City plan before committing a prediction.');
  const recipe = normalizePlan(plan);
  const definition = metrics.get(metric);
  if (!definition) throw new Error('Choose a supported City metric.');
  if (!Number.isFinite(expected) || Math.abs(expected) > definition.limit ||
      (definition.integer && !Number.isInteger(expected))) {
    const numberType = definition.integer ? 'whole-number change' : 'change';
    throw new Error(`Enter a ${numberType} from −${definition.limit} to +${definition.limit} ${definition.unit}.`);
  }
  const time = new Date(createdAt);
  if (createdAt === null || !Number.isFinite(time.getTime())) throw new Error('The prediction needs a valid commitment time.');
  Object.freeze(recipe.policies);
  return Object.freeze({
    version: PREDICTION_VERSION, plan: Object.freeze(recipe), planKey: encodePlan(recipe),
    metric, month: PLAN_START_MONTH + recipe.months, expected, createdAt: time.toISOString(),
  });
}

/**
 * Resolve only the exact committed City plan and its no-change control at the target month.
 * Recipe or month mismatches throw. Missing observations produce state "unavailable" with null
 * score, actual, and absoluteError. Scored results use max(0, 100 * (1 - absoluteError / tolerance)).
 * Values for unemployment are percentages and its deltas are in percentage points.
 */
export function resolvePrediction(prediction, baseline, adjusted) {
  if (prediction?.version !== PREDICTION_VERSION) throw new Error('The prediction uses an unsupported version.');
  const { metric, month, expected, planKey, plan, createdAt } = prediction;
  if (typeof createdAt !== 'string') throw new Error('The prediction is missing its commitment time.');
  const validated = createPrediction(plan, { metric, expected }, createdAt);
  if (month !== validated.month || planKey !== validated.planKey) throw new Error('The prediction does not match its committed plan.');
  if (!baseline?.recipe || !adjusted?.recipe || encodePlan(adjusted.recipe) !== planKey ||
      encodePlan(baseline.recipe) !== encodePlan({ ...plan, policies: [] }) ||
      baseline.final?.month !== month || adjusted.final?.month !== month) {
    throw new Error('The simulation results do not match the committed plan, control, and target month.');
  }
  const { scale = 1, tolerance, unit } = metrics.get(metric);
  function read(snapshot) {
    const value = snapshot[metric];
    if (!Number.isFinite(value) || (metric === 'meanCommuteMinutes' && !(snapshot.commuteCount > 0))) return null;
    return value * scale;
  }
  const before = read(baseline.final);
  const after = read(adjusted.final);
  const context = { version: PREDICTION_VERSION, planKey, metric, month, unit, expected, baseline: before, adjusted: after, tolerance };
  if (before === null || after === null) {
    return { ...context, state: 'unavailable', actual: null, absoluteError: null, score: null };
  }
  const actual = after - before;
  const absoluteError = Math.abs(expected - actual);
  return { ...context, state: 'scored', actual, absoluteError, score: Math.max(0, 100 * (1 - absoluteError / tolerance)) };
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const signed = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const points = value => `${number.format(value)} / 100`;
const difference = (value, unit) => `${signed.format(value)} ${unit}`;
const snapshotValue = (value, unit) => value === null ? 'Unavailable' : `${number.format(value)} ${unit}`;

export function mountPrediction(host, { onCommit } = {}) {
  if (!host?.ownerDocument || typeof onCommit !== 'function') {
    throw new TypeError('A prediction container and commitment callback are required.');
  }
  const doc = host.ownerDocument;
  function element(tag, text) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const panel = element('section');
  panel.className = 'hbl-prediction';
  const context = element('p', 'Choose a City plan to make a prediction.');
  context.className = 'hbl-prediction-context';
  const form = element('form');
  form.className = 'hbl-prediction-form';
  form.hidden = true;
  const metricLabel = element('label', 'Predict a change in');
  const metric = element('select');
  metric.name = 'metric';
  for (const [key, { label }] of metrics) {
    const option = element('option', label);
    option.value = key;
    metric.append(option);
  }
  metricLabel.append(metric);

  const expectedLabel = element('label');
  const expectedText = element('span');
  const expected = element('input');
  expected.name = 'expected';
  expected.type = 'number';
  expected.required = true;
  expectedLabel.append(expectedText, expected);
  const commit = element('button', 'Lock prediction');
  commit.type = 'submit';
  const rule = element('p');
  rule.className = 'hbl-prediction-context';
  rule.hidden = true;
  form.append(metricLabel, expectedLabel, commit);

  const status = element('p');
  status.className = 'hbl-prediction-status';
  status.setAttribute('role', 'status');
  const result = element('div');
  result.className = 'hbl-prediction-result';
  result.hidden = true;
  const historyPanel = element('details');
  historyPanel.hidden = true;
  const historyHeading = element('summary');
  const historyList = element('ol');
  historyPanel.append(historyHeading, historyList);
  panel.append(element('h2', 'Prediction League'), context, form, rule, status, result, historyPanel);
  host.append(panel);

  let key = null;
  let pending = false;
  function updateMetric() {
    const { unit, tolerance, limit, integer } = metrics.get(metric.value);
    expectedText.textContent = `Expected change (${unit})`;
    expected.min = String(-limit);
    expected.max = String(limit);
    expected.step = integer ? '1' : 'any';
    rule.textContent = `Enter a negative number for a decrease. The score starts at 100 and reaches 0 at an absolute error of ${tolerance} ${unit}.`;
  }

  metric.addEventListener('change', updateMetric);
  updateMetric();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || form.hidden) return;
    pending = true;
    commit.disabled = true;
    status.textContent = '';
    try {
      await onCommit({ metric: metric.value, expected: expected.valueAsNumber });
    } catch (error) {
      status.textContent = error.message || 'The prediction could not be saved.';
    } finally {
      pending = false;
      commit.disabled = form.hidden;
    }
  });

  function showResult(prediction, resolution) {
    if (!resolution) {
      result.hidden = true;
      result.replaceChildren();
      return;
    }
    const { unit } = metrics.get(prediction.metric);
    const inputUnit = prediction.metric === 'unemploymentRate' ? '%' : unit;
    const snapshot = value => inputUnit === '%' && value !== null ? `${number.format(value)}%` : snapshotValue(value, inputUnit);
    const rows = [
      ['Baseline result', snapshot(resolution.baseline)],
      ['Adjusted result', snapshot(resolution.adjusted)],
      ['Modeled change', resolution.actual === null ? 'Unavailable' : difference(resolution.actual, unit)],
      ['Absolute error', snapshotValue(resolution.absoluteError, unit)],
      ['Accuracy score', resolution.score === null ? 'Unscored' : points(resolution.score)],
    ];
    const list = element('dl');
    for (const [label, value] of rows) {
      const entry = element('div');
      entry.append(element('dt', label), element('dd', value));
      list.append(entry);
    }
    result.replaceChildren(list);
    if (resolution.state === 'unavailable') {
      result.append(element('p', 'The model did not record this metric in both plans at the target month.'));
    }
    result.hidden = false;
  }

  function showHistory(history) {
    const scored = history.filter(({ prediction, resolution }) =>
      metrics.has(prediction?.metric) && resolution?.state === 'scored' && Number.isFinite(resolution.score));
    historyPanel.hidden = !scored.length;
    if (!scored.length) return;
    const average = scored.reduce((sum, { resolution }) => sum + resolution.score, 0) / scored.length;
    historyHeading.textContent = `Prediction history · ${scored.length} scored · Average ${points(average)}`;
    historyList.replaceChildren(...scored.slice().reverse().map(({ prediction, resolution }) => {
      const { label, unit } = metrics.get(prediction.metric);
      return element('li',
        `${label} · Seed ${prediction.plan.seed} · Month ${prediction.month} · Predicted ${difference(prediction.expected, unit)} · ` +
        `Modeled ${difference(resolution.actual, unit)} · Score ${points(resolution.score)}`,
      );
    }));
  }

  function render({ plan, prediction, resolution, history = [] }) {
    const currentKey = plan ? encodePlan(plan) : null;
    if (currentKey !== key) {
      key = currentKey;
      expected.value = '';
      status.textContent = '';
    }
    form.hidden = !plan || Boolean(prediction);
    rule.hidden = form.hidden;
    commit.disabled = form.hidden || pending;
    if (prediction) {
      const { label, unit } = metrics.get(prediction.metric);
      context.textContent = `Locked for month ${prediction.month} · ${label} · ${difference(prediction.expected, unit)}.`;
    } else if (plan) {
      context.textContent = `Predict the difference between the adjusted and baseline plans at month ${PLAN_START_MONTH + plan.months}.`;
    } else {
      context.textContent = 'Choose a City plan before revealing its results to make a prediction.';
    }
    const matchedResolution = prediction && resolution?.version === PREDICTION_VERSION &&
      resolution.planKey === prediction.planKey && resolution.month === prediction.month &&
      resolution.metric === prediction.metric && resolution.expected === prediction.expected;
    showResult(prediction, matchedResolution ? resolution : null);
    showHistory(history);
  }

  return { render, destroy: () => panel.remove() };
}
