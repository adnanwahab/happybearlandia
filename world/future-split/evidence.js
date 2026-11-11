const metricDefinitions = [
  ['housingUnits', 'Housing units', 'units', 'count'],
  ['unhoused', 'Unhoused households', 'households', 'count'],
  ['meanRent', 'Mean monthly rent', 'USD', 'currency'],
  ['meanCommuteMinutes', 'Mean modeled commute', 'min', 'decimal'],
  ['publicBalance', 'Public balance', 'USD', 'currency'],
  ['capitalSpending', 'Capital spending since split', 'USD', 'currency'],
];

const statusLabels = { added: 'New', modified: 'Changed', removed: 'Removed' };
const kindLabels = { building: 'Building', project: 'Project', route: 'Route', household: 'Household' };
const count = new Intl.NumberFormat('en-US');
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
});

function metricValue(value, unit, format) {
  if (!Number.isFinite(value)) return 'Unavailable';
  if (format === 'currency') return currency.format(value);
  if (format === 'decimal') return decimal.format(value) + ' ' + unit;
  return count.format(value);
}

export function metricDifference(before, after) {
  return Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
}

function signedMetric(value, unit, format) {
  if (value === null) return 'Unavailable';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const formatted = metricValue(Math.abs(value), unit, format);
  if (value !== 0 && Math.abs(value) < 0.005) {
    return sign + (format === 'currency' ? '< $0.01' : '< 0.01 ' + unit);
  }
  return sign + formatted;
}

export function describeMilestones(run) {
  const months = new Map();
  if (run.firstDivergenceMonth !== null) {
    months.set(run.firstDivergenceMonth, ['First divergence']);
  }
  const seen = new Set();
  for (const frame of run.frames) {
    for (const change of frame.changes) {
      const key = change.kind + '/' + change.status;
      if (seen.has(key)) continue;
      seen.add(key);
      const labels = months.get(frame.month) ?? [];
      labels.push(statusLabels[change.status] + ' ' + kindLabels[change.kind].toLowerCase());
      months.set(frame.month, labels);
    }
  }
  return [...months.entries()]
    .sort(([left], [right]) => left - right)
    .map(([month, labels]) => ({ month, labels }));
}

function makeElement(doc, tag, text, className) {
  const element = doc.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderImpact(container, frame) {
  const doc = container.ownerDocument;
  const metricsA = frame.baseline.metrics;
  const metricsB = frame.intervention.metrics;
  const cards = [];
  for (const [id, label, unit, format] of metricDefinitions) {
    if (!Object.hasOwn(metricsA, id) && !Object.hasOwn(metricsB, id)) continue;
    const card = makeElement(doc, 'article', undefined, 'fs-metric');
    card.dataset.metric = id;
    const title = makeElement(doc, 'h3', label);
    const pair = makeElement(doc, 'dl', undefined, 'fs-metric-pair');
    for (const [branch, metrics] of [['A', metricsA], ['B', metricsB]]) {
      const value = metricValue(metrics[id], unit, format);
      const branchValue = makeElement(doc, 'div', undefined, 'fs-arm-' + branch.toLowerCase());
      branchValue.append(makeElement(doc, 'dt', 'Future ' + branch), makeElement(doc, 'dd', value));
      if (id === 'meanCommuteMinutes') {
        const sample = metrics.commuteCount;
        const trips = Number.isFinite(sample) ? count.format(sample) + ' modeled trips' : 'Trip count unavailable';
        branchValue.append(makeElement(doc, 'dd', trips, 'fs-evidence-note'));
      }
      pair.append(branchValue);
    }
    const delta = metricDifference(metricsA[id], metricsB[id]);
    const deltaLabel = makeElement(doc, 'p', 'B − A ' + signedMetric(delta, unit, format), 'fs-metric-delta');
    deltaLabel.dataset.delta = delta ?? 'unavailable';
    card.append(title, pair, deltaLabel);
    cards.push(card);
  }
  if (!cards.length) cards.push(makeElement(doc, 'p', 'No impact measurements are available for this month.'));
  container.replaceChildren(...cards);
}

function findEntity(arm, id) {
  return arm.entities.find(entity => entity.id === id);
}

export function entityHistory(frames, id) {
  return frames.map(frame => {
    const change = frame.changes.find(entry => entry.id === id);
    return {
      month: frame.month,
      baseline: findEntity(frame.baseline, id),
      intervention: findEntity(frame.intervention, id),
      status: change?.status ?? null,
    };
  });
}

const fieldUnits = {
  meanRent: 'USD/month',
  income: 'USD/month',
  rent: 'USD/month',
  savings: 'USD',
  cost: 'USD',
  costOverrun: 'USD',
  progress: 'months',
  duration: 'months',
  freeTimeMinutes: 'min',
  travelTimeMinutes: 'min',
};

function fieldLabel(field) {
  const label = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
  const unit = fieldUnits[field];
  return label + (unit ? ' (' + unit + ')' : '');
}

function fieldValue(entity, field) {
  if (!entity) return 'Absent';
  const value = entity.fields[field];
  if (value === undefined) return 'Unavailable';
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function makeTable(doc, headers) {
  const table = makeElement(doc, 'table', undefined, 'fs-evidence-table');
  const head = table.createTHead().insertRow();
  for (const label of headers) {
    const header = makeElement(doc, 'th', label);
    header.scope = 'col';
    head.append(header);
  }
  const body = table.createTBody();
  const scroll = makeElement(doc, 'div', undefined, 'fs-evidence-scroll');
  scroll.append(table);
  return { scroll, body };
}

function appendRow(doc, body, label, values) {
  const row = body.insertRow();
  const key = makeElement(doc, 'th', label);
  key.scope = 'row';
  row.append(key);
  for (const value of values) row.insertCell().textContent = value;
  return row;
}

function mountTimeline(container, onMonth) {
  const doc = container.ownerDocument;
  const scrubber = makeElement(doc, 'label', undefined, 'fs-month-scrubber');
  const monthLabel = makeElement(doc, 'span', 'Simulation month');
  const output = makeElement(doc, 'output');
  const slider = makeElement(doc, 'input');
  slider.type = 'range';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Simulation month');
  slider.addEventListener('input', () => onMonth(Number(slider.value)));
  scrubber.append(monthLabel, output, slider);
  const status = makeElement(doc, 'p', undefined, 'fs-divergence-status');
  status.setAttribute('role', 'status');
  const milestones = makeElement(doc, 'div', undefined, 'fs-milestones');
  container.append(scrubber, status, milestones);

  let lastRun;
  return (run, frame) => {
    if (lastRun !== run) {
      slider.min = run.frames[0].month;
      slider.max = run.frames.at(-1).month;
      slider.disabled = run.frames.length < 2;
      const buttons = describeMilestones(run).map(({ month, labels }) => {
        const button = makeElement(doc, 'button', labels.join(' · ') + ' · Month ' + month);
        button.type = 'button';
        button.dataset.month = month;
        button.addEventListener('click', () => onMonth(month));
        return button;
      });
      milestones.replaceChildren(...buttons);
      lastRun = run;
    }
    slider.value = frame.month;
    slider.setAttribute('aria-valuetext', 'Month ' + frame.month);
    output.value = 'Month ' + frame.month;
    const first = run.firstDivergenceMonth;
    const message = first === null ? 'The compared outputs are identical across this run.'
      : 'First divergence at month ' + first + '.';
    if (status.textContent !== message) status.textContent = message;
    for (const button of milestones.children) {
      if (Number(button.dataset.month) === frame.month) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
  };
}

function mountInspector(container, onSelect, onMonth) {
  const doc = container.ownerDocument;
  const listHeading = makeElement(doc, 'h3');
  const list = makeElement(doc, 'ul', undefined, 'fs-changed-list');
  const detail = makeElement(doc, 'div', undefined, 'fs-entity-detail');
  container.append(listHeading, list, detail);

  let lastFrame;
  let lastRun;
  let lastSelectedId;
  let history;
  let historyField;
  return (run, frame, selectedId) => {
    if (lastFrame !== frame) {
      const changes = frame.changes;
      listHeading.textContent = changes.length
        ? changes.length + (changes.length === 1 ? ' changed entity' : ' changed entities')
        : 'No entity differences this month';
      list.replaceChildren(...changes.map(change => {
        const entity = change.after ?? change.before;
        const item = makeElement(doc, 'li');
        const button = makeElement(doc, 'button');
        button.type = 'button';
        button.dataset.entityId = change.id;
        button.dataset.changeStatus = change.status;
        button.append(
          makeElement(doc, 'strong', entity.label),
          makeElement(doc, 'span', statusLabels[change.status] + ' · ' + kindLabels[entity.kind]),
        );
        button.addEventListener('click', () => onSelect(change.id));
        item.append(button);
        return item;
      }));
    }
    for (const button of list.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.entityId === selectedId));
    }
    if (lastRun === run && lastFrame === frame && lastSelectedId === selectedId) return;
    if (lastRun !== run || lastSelectedId !== selectedId) {
      history = selectedId ? entityHistory(run.frames, selectedId) : [];
      historyField = null;
    }
    lastRun = run;
    lastFrame = frame;
    lastSelectedId = selectedId;

    const current = history.find(row => row.month === frame.month);
    const recorded = history.find(row => row.intervention || row.baseline);
    if (!recorded) {
      detail.replaceChildren(makeElement(doc, 'p', 'Select an entity to inspect both futures.', 'fs-evidence-note'));
      return;
    }
    const entity = current.intervention ?? current.baseline ?? recorded.intervention ?? recorded.baseline;
    const fields = [...new Set(history.flatMap(row => [row.baseline, row.intervention]
      .flatMap(arm => Object.keys(arm?.fields ?? {}))))];
    const changedFields = new Set(frame.changes.find(change => change.id === selectedId)?.fields);
    const title = makeElement(doc, 'h3', entity.label);
    const kind = kindLabels[entity.kind] + ' · City ID ' + entity.modelId;
    const identity = makeElement(doc, 'p', kind, 'fs-evidence-note');
    const currentStatus = current.status ? statusLabels[current.status] + ' in Future B'
      : current.baseline || current.intervention ? 'Identical at this month' : 'Absent in both futures at this month';
    const state = makeElement(doc, 'p', currentStatus, 'fs-entity-state');
    state.dataset.entityStatus = current.status ?? 'unchanged';
    const currentTable = makeTable(doc, ['Field', 'Future A', 'Future B']);
    for (const field of fields) {
      const row = appendRow(doc, currentTable.body, fieldLabel(field), [
        fieldValue(current.baseline, field), fieldValue(current.intervention, field),
      ]);
      if (changedFields.has(field)) row.dataset.changed = 'true';
    }

    const historyDetails = makeElement(doc, 'details', undefined, 'fs-entity-history');
    const previous = detail.querySelector('details');
    historyDetails.open = previous?.open ?? false;
    const previousJump = previous?.contains(doc.activeElement) ? doc.activeElement.dataset.month : undefined;
    historyDetails.append(makeElement(doc, 'summary', 'Monthly history'));
    const fieldPicker = makeElement(doc, 'label', 'History field ');
    const select = makeElement(doc, 'select');
    const fieldOptions = fields.length ? fields : ['presence'];
    select.append(...fieldOptions.map(field => {
      const option = makeElement(doc, 'option', fieldLabel(field));
      option.value = field;
      return option;
    }));
    historyField = fieldOptions.includes(historyField) ? historyField : fieldOptions[0];
    select.value = historyField;
    fieldPicker.append(select);
    const historyTable = makeTable(doc, ['Month', 'Future A', 'Future B', 'Difference']);
    function updateHistory() {
      historyField = select.value;
      historyTable.body.replaceChildren();
      for (const row of history) {
        const value = entity => fields.length ? fieldValue(entity, historyField) : entity ? 'Present' : 'Absent';
        const entry = appendRow(doc, historyTable.body, '', [
          value(row.baseline), value(row.intervention), row.status ? statusLabels[row.status] : '—',
        ]);
        const jump = makeElement(doc, 'button', 'Month ' + row.month);
        jump.type = 'button';
        jump.dataset.month = row.month;
        if (row.month === frame.month) jump.setAttribute('aria-current', 'step');
        jump.addEventListener('click', () => onMonth(row.month));
        entry.firstElementChild.append(jump);
      }
    }
    select.addEventListener('change', updateHistory);
    updateHistory();
    historyDetails.append(fieldPicker, historyTable.scroll);
    detail.replaceChildren(title, identity, state, currentTable.scroll, historyDetails);
    if (previousJump) historyDetails.querySelector('[data-month="' + previousJump + '"]')?.focus();
  };
}

export function mountEvidence({ impact, timeline, inspector, onMonth, onSelect }) {
  impact.classList.add('fs-impact-cards');
  timeline.classList.add('fs-evidence-timeline');
  inspector.classList.add('fs-evidence-inspector');
  const renderTimeline = mountTimeline(timeline, onMonth);
  const renderInspector = mountInspector(inspector, onSelect, onMonth);
  let lastFrame;
  return {
    render(run, frame, selectedId) {
      if (lastFrame !== frame) renderImpact(impact, frame);
      renderTimeline(run, frame);
      renderInspector(run, frame, selectedId);
      lastFrame = frame;
    },
  };
}
