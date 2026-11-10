import { rules } from './engine.js';
import { demoRunId, readMonthlyDiscoveries } from './records.js';

const $ = id => document.getElementById(id);
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const valueWithUnit = (value, unit) => `${number.format(value)} ${unit}`;
const inspector = '/world/causality/inspect.html';
const pageSize = 20;
let findings = [];
let shown = pageSize;

for (const [kind, rule] of Object.entries(rules)) {
  $('rules').append(element('dt', rule.label), element('dd', rule.description));
  $('filter').add(new Option(rule.label, kind));
}

function findingCard(finding) {
  const { kind, label, month, entityId, metricId, unit, evidence, statistics, runId } = finding;
  const card = element('li', '');
  card.className = 'finding';
  card.append(element('h2', `${label} · ${rules[kind].label}`), element('p', `Month ${month} · ${entityId}`));
  let summary;
  if (kind === 'outlier') {
    summary = `${valueWithUnit(evidence.at(-1).value, unit)} vs. prior median ${valueWithUnit(statistics.median, unit)} (MAD ${valueWithUnit(statistics.mad, unit)})`;
  } else {
    const path = evidence.map(row => valueWithUnit(row.value, unit)).join(' → ');
    const changes = kind === 'change' ? [statistics.change] : [statistics.firstChange, statistics.secondChange];
    summary = `${path} (${changes.map(change => percent.format(change)).join(', ')})`;
  }

  const details = element('details', '');
  const list = element('ul', '');
  list.className = 'evidence';
  for (const row of evidence) {
    const item = element('li', '');
    const link = element('a', `Month ${row.context.tick} · ${valueWithUnit(row.value, unit)}`);
    link.href = inspector + '?' + new URLSearchParams({
      runId, entityId, tick: row.context.tick, targetId: row.id,
    });
    const source = row.provenance;
    item.append(link, element('small', row.id));
    if (source) item.append(element('small', `${source.kind} · ${source.source} · ${source.id}`));
    list.append(item);
  }
  details.append(element('summary', 'Recorded evidence'), element('p', metricId), list);
  const jump = element('a', 'Jump to month');
  jump.href = '/world/causal.html?' + new URLSearchParams({ runId, month, inspectEntity: entityId });
  card.append(element('p', summary), details, jump);
  return card;
}

function render() {
  const filter = $('filter').value;
  const selected = findings.filter(finding => !filter || finding.kind === filter);
  $('count').textContent = selected.length
    ? `Showing ${Math.min(shown, selected.length)} of ${selected.length} findings`
    : 'No findings of this type.';
  $('findings').replaceChildren(...selected.slice(0, shown).map(findingCard));
  $('more').hidden = selected.length <= shown;
}

$('filter').addEventListener('change', () => { shown = pageSize; render(); });
$('more').addEventListener('click', () => { shown += pageSize; render(); });

const messages = {
  missing: 'No stored run was found for this ID. You can record the demo from the Monthly World scenario, then analyze it here.',
  unsupported: 'This run has no monthly World city manifest.',
  unfinished: 'This run has no completed recording to analyze.',
  'too-large': 'This recording exceeds the view’s 20,000-observation limit. No findings were calculated.',
};

async function load(runId) {
  $('status').textContent = 'Reading recorded monthly observations…';
  try {
    const result = await readMonthlyDiscoveries(runId);
    if (result.status !== 'ready') {
      $('status').textContent = messages[result.status];
      return;
    }
    if (!result.usable) {
      $('status').textContent = 'This run has no usable monthly observations.';
      return;
    }
    if (!result.comparable) {
      $('status').textContent = 'This run has no consecutive observations for the same entity, metric and unit.';
      return;
    }
    const coverage = result.outlierWindows
      ? ''
      : ' Outliers require seven consecutive monthly observations.';
    findings = result.findings;
    $('status').textContent = findings.length
      ? `Analyzed ${result.usable} monthly observations from model ${result.run.context.modelVersion}, seed ${result.run.context.seed}.${coverage}`
      : `None of the rules matched the ${result.usable} usable monthly observations.${coverage}`;
    $('results').hidden = findings.length === 0;
    render();
  } catch (error) {
    $('status').textContent = 'Could not read the recording. ' + error.message;
  }
}

const runId = new URLSearchParams(location.search).get('runId') ?? demoRunId;
$('run').value = runId;
load(runId);
