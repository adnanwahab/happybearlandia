import { categories, constraintsAtMonth, loadConstraintRun, RULES_VERSION } from './model.js';

const find = id => document.getElementById(id);
const status = find('status');
const record = find('record');
const retry = find('retry');
const picker = find('month');
const panel = find('report');
const params = new URLSearchParams(location.search);
let run;

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function evidenceLink(label, href) {
  const link = element('a', label);
  link.href = href;
  return link;
}

function renderFinding(finding) {
  const article = document.createElement('article');
  article.append(
    element('p', categories[finding.category]),
    element('h3', finding.title),
  );
  const labels = [finding.district && `District ${finding.district}`, finding.subject].filter(Boolean);
  if (labels.length) article.append(element('p', labels.join(' · ')));
  if (finding.reason !== null) article.append(element('p', `Recorded reason “${finding.reason}”`));
  if (finding.progress !== null) {
    article.append(element('p', `Recorded progress fraction ${new Intl.NumberFormat(undefined, {
      style: 'percent', maximumFractionDigits: 2,
    }).format(finding.progress)}`));
  }
  const links = document.createElement('div');
  links.append(
    evidenceLink('Inspect source event', finding.evidenceLink),
    evidenceLink('Open event in Time Machine', finding.replayLink),
  );
  article.append(links);
  return article;
}

function showMonth(month) {
  const result = constraintsAtMonth(run, month);
  panel.hidden = result.state !== 'ready';
  status.hidden = result.state === 'ready';
  if (result.state !== 'ready') {
    status.textContent = 'The requested month has no stored checkpoint. Choose an available month.';
    return;
  }
  find('month-title').textContent = `Simulation month ${month}`;
  find('provenance').textContent =
    `Recorded city model · Seed ${run.context.seed} · ${run.context.modelVersion} · ${RULES_VERSION}`;
  find('counts').replaceChildren(...Object.entries(result.counts).flatMap(([key, count]) => [
    element('dt', categories[key]), element('dd', count),
  ]));
  find('empty').hidden = result.findings.length > 0;
  find('events').replaceChildren(...result.findings.map(renderFinding));
}

async function openRun() {
  retry.hidden = true;
  record.hidden = true;
  status.hidden = false;
  panel.hidden = true;
  status.textContent = 'Reading saved city records…';
  try {
    run = await loadConstraintRun(params.get('runId') || undefined);
    if (run.state !== 'ready') {
      status.textContent = {
        missing: 'No saved city run was found.',
        incomplete: 'The saved run is incomplete.',
        unsupported: 'The saved run uses an unsupported city model.',
        'no-checkpoints': 'This run contains no compatible monthly city checkpoints.',
      }[run.state];
      record.hidden = false;
      return;
    }
    const months = [...run.checkpoints.keys()].sort((a, b) => a - b);
    const defaultMonth = months.findLast(month => run.findings.has(month)) ?? months.at(-1);
    const raw = params.get('month');
    const month = raw === null ? defaultMonth : /^\d+$/.test(raw) ? Number(raw) : NaN;
    picker.replaceChildren(...months.map(tick => new Option(`Month ${tick}`, tick)));
    picker.value = month;
    find('month-field').hidden = false;
    showMonth(month);
  } catch (error) {
    status.textContent = `Could not load constraint evidence. ${error.message}`;
    retry.hidden = false;
  }
}

picker.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('month', picker.value);
  history.replaceState(null, '', url);
  showMonth(Number(picker.value));
});
retry.addEventListener('click', openRun);
openRun();
