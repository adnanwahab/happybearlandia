import { AUDIT_VERSION, loadAuditMonth, loadAuditRun } from './model.js';

const find = id => document.getElementById(id);
const status = find('status');
const record = find('record');
const retry = find('retry');
const picker = find('month');
const audit = find('audit');
const params = new URLSearchParams(location.search);
let run;
let request = 0;

function setStatus(message) {
  status.textContent = message;
  status.hidden = false;
  audit.hidden = true;
}

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function renderMonth(month, result) {
  const { checkpoint, report, replayLink } = result;
  find('provenance').textContent =
    `Recorded month ${month} · Seed ${run.context.seed} · ${run.context.modelVersion} · ${AUDIT_VERSION}`;
  find('checkpoint').textContent = `Checkpoint ${checkpoint.id}`;
  find('replay').href = replayLink;
  const checks = report.checks.map(({ name, issues }) => {
    const row = document.createElement('li');
    row.append(element('strong', name), element('span', issues.length ? 'Issues found' : 'Passed'));
    if (issues.length) {
      const list = document.createElement('ul');
      list.append(...issues.map(issue => element('li', issue)));
      row.append(list);
    }
    return row;
  });
  find('checks').replaceChildren(...checks);
  find('scarcity').hidden = !report.scarcity;
  find('indicators').replaceChildren(...(report.scarcity ?? []).flatMap(({ name, count }) => [
    element('dt', name), element('dd', count ?? 'Unavailable'),
  ]));
  status.hidden = true;
  audit.hidden = false;
}

async function openMonth(month) {
  const serial = ++request;
  retry.hidden = true;
  if (!run.checkpoints.has(month)) {
    setStatus('The requested month has no stored checkpoint. Choose one of the available months.');
    return;
  }
  setStatus(`Reading the stored checkpoint for month ${month}…`);
  try {
    const result = await loadAuditMonth(run, month);
    if (serial !== request) return;
    if (result.state === 'unavailable') setStatus('The selected checkpoint is unavailable.');
    else if (result.state === 'rejected') setStatus(`Replay rejected the checkpoint before inspection. ${result.reason}`);
    else renderMonth(month, result);
  } catch (error) {
    if (serial !== request) return;
    setStatus(`Could not load the checkpoint. ${error.message}`);
    retry.hidden = false;
    retry.onclick = () => openMonth(month);
  }
}

async function openRun() {
  const serial = ++request;
  retry.hidden = true;
  record.hidden = true;
  setStatus('Finding saved city checkpoints…');
  try {
    const result = await loadAuditRun(params.get('runId') || undefined);
    if (serial !== request) return;
    if (result.state !== 'ready') {
      const messages = {
        missing: 'No saved city run was found.',
        incomplete: 'The saved run is incomplete.',
        unsupported: 'The saved run uses an unsupported city model.',
        'no-checkpoints': 'This run contains no compatible monthly city checkpoints.',
      };
      setStatus(messages[result.state]);
      record.hidden = false;
      return;
    }
    run = result;
    const months = [...run.checkpoints.keys()].sort((a, b) => a - b);
    const raw = params.get('month');
    const month = raw === null ? months.at(-1) : /^\d+$/.test(raw) ? Number(raw) : NaN;
    picker.replaceChildren(...months.map(tick => new Option(`Month ${tick}`, tick)));
    picker.value = month;
    find('month-field').hidden = false;
    await openMonth(month);
  } catch (error) {
    if (serial !== request) return;
    setStatus(`Could not find saved checkpoints. ${error.message}`);
    retry.hidden = false;
    retry.onclick = openRun;
  }
}

picker.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('month', picker.value);
  history.replaceState(null, '', url);
  openMonth(Number(picker.value));
});
openRun();
