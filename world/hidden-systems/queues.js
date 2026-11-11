const permitMetrics = [
  ['opening', 'Projects waiting at start'],
  ['arrivals', 'Applications submitted'],
  ['served', 'Permits granted'],
  ['closing', 'Projects waiting at end'],
  ['capacity', 'Permit processing capacity'],
];
const constructionMetrics = [
  ['opening', 'Projects in construction at start'],
  ['arrivals', 'Projects entering construction'],
  ['served', 'Projects completed'],
  ['closing', 'Projects still in construction at end'],
];
const quantity = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
const available = value => Number.isFinite(value) && value >= 0;
const count = value => available(value) ? quantity.format(value) : 'Unavailable';

function element(parent, tag, text, className) {
  const node = parent.ownerDocument.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function heading(parent, text, scope) {
  const cell = element(parent, 'th', text);
  cell.scope = scope;
}

function comparisonTable(parent, caption) {
  const table = element(parent, 'table', undefined, 'queues-table');
  element(table, 'caption', caption);
  const head = element(element(table, 'thead'), 'tr');
  heading(head, 'Measure', 'col');
  heading(head, 'Baseline', 'col');
  heading(head, 'Adjusted', 'col');
  return element(table, 'tbody');
}

function barCell(row, value, maximum, arm) {
  const cell = element(row, 'td');
  element(cell, 'span', count(value));
  if (available(value)) {
    const track = element(cell, 'div', undefined, 'queues-track');
    track.setAttribute('aria-hidden', 'true');
    const bar = element(track, 'div', undefined, 'queues-bar queues-bar--' + arm);
    bar.style.width = (100 * value / maximum) + '%';
  }
  return cell;
}

function queueCounts(parent, caption, metrics, left, right) {
  const maximum = Math.max(1, ...metrics.flatMap(([key]) => [left?.[key], right?.[key]]).filter(available));
  const body = comparisonTable(parent, caption);
  for (const [key, label] of metrics) {
    const row = element(body, 'tr');
    heading(row, label, 'row');
    barCell(row, left?.[key], maximum, 'baseline');
    barCell(row, right?.[key], maximum, 'adjusted');
  }
}

function projectDetails(parent, label, rows, empty, format, expanded) {
  const details = element(parent, 'details');
  details.open = expanded.has(label);
  element(details, 'summary', label + (rows ? ' (' + rows.length + ')' : ''));
  if (!rows?.length) {
    element(details, 'p', rows ? empty : 'Project records unavailable for this snapshot.');
    return;
  }
  const list = element(details, 'ul');
  for (const row of rows) element(list, 'li', format(row));
}

function resourceTable(parent, left, right) {
  const baseline = new Map((left ?? []).map(row => [row.resource, row]));
  const adjusted = new Map((right ?? []).map(row => [row.resource, row]));
  const resources = [...new Set([...baseline.keys(), ...adjusted.keys()])].sort();
  if (!resources.length) {
    element(parent, 'p', 'Resource reservations are unavailable for this snapshot.');
    return;
  }
  const body = comparisonTable(parent, 'Construction resources');
  for (const resource of resources) {
    const row = element(body, 'tr');
    heading(row, resource, 'row');
    const sides = [[baseline.get(resource), 'baseline'], [adjusted.get(resource), 'adjusted']];
    const maximum = Math.max(1, ...sides.flatMap(([value]) => [value?.capacity, value?.used]).filter(available));
    for (const [value, arm] of sides) {
      const cell = barCell(row, value?.used, maximum, arm);
      if (value) {
        element(cell, 'small',
          `Used · ${count(value.capacity)} capacity · ${count(value.available)} available`);
      }
    }
  }
  element(parent, 'p', 'Resource bars show use on a shared scale within each row. Units differ by resource.');
}

function waitLabel({ id, months }) {
  if (!available(months)) return id + ' · Waiting age unavailable';
  return id + ' · ' + count(months) + (months === 1 ? ' month waiting' : ' months waiting');
}

export function mountQueues(host) {
  const root = element(host, 'section', undefined, 'queues-city');

  function render(baselineSnapshot, adjustedSnapshot) {
    const expanded = new Set([...root.querySelectorAll('details[open] summary')].map(summary =>
      summary.textContent.replace(/ \(\d+\)$/, '')));
    root.replaceChildren();
    element(root, 'h2', 'Queue City');
    const month = baselineSnapshot?.month ?? adjustedSnapshot?.month;
    if (month === undefined) {
      element(root, 'p', 'No queue snapshot is available at the selected month.');
      return;
    }
    if (baselineSnapshot && adjustedSnapshot && baselineSnapshot.month !== adjustedSnapshot.month) {
      element(root, 'p', 'Choose the same simulation month for both queue snapshots.');
      return;
    }

    element(root, 'p', month === 0
      ? 'Month 0 · Opening inventory. Monthly flows require a completed simulation step.'
      : 'Month ' + month + ' · Completed simulation step.');
    if (!baselineSnapshot || !adjustedSnapshot) {
      element(root, 'p', (baselineSnapshot ? 'Adjusted' : 'Baseline') + ' snapshot unavailable.');
    }
    element(root, 'p', 'Project-count bars share a scale across both futures within each queue.');

    queueCounts(root, 'Building permits', permitMetrics, baselineSnapshot?.permits, adjustedSnapshot?.permits);
    const waits = element(root, 'div', undefined, 'queues-details');
    projectDetails(waits, 'Baseline permit waiting ages', baselineSnapshot?.permits?.waiting,
      'No projects are awaiting permits.', waitLabel, expanded);
    projectDetails(waits, 'Adjusted permit waiting ages', adjustedSnapshot?.permits?.waiting,
      'No projects are awaiting permits.', waitLabel, expanded);
    element(root, 'p', 'Waiting ages describe projects still in the queue. The model prioritizes projects by its construction rules.');

    queueCounts(root, 'Construction', constructionMetrics, baselineSnapshot?.construction, adjustedSnapshot?.construction);
    const blocked = element(root, 'div', undefined, 'queues-details');
    const blockingReason = row => row.id + ' · ' + (row.reason || 'Reason unavailable');
    projectDetails(blocked, 'Baseline construction delays', baselineSnapshot?.construction?.blocked,
      'No construction delays were recorded.', blockingReason, expanded);
    projectDetails(blocked, 'Adjusted construction delays', adjustedSnapshot?.construction?.blocked,
      'No construction delays were recorded.', blockingReason, expanded);

    resourceTable(root, baselineSnapshot?.resources, adjustedSnapshot?.resources);
  }

  return { render, destroy() { root.remove(); } };
}
