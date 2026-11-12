import { loadPerspectives } from './model.js';

const find = id => document.getElementById(id);
const status = find('status');
const record = find('record');
const retry = find('retry');
const reportPanel = find('report');

function housingLabel({ district, unitId }) {
  return [unitId === null ? 'No housing unit' : unitId, district].filter(Boolean).join(' · ');
}

function renderPerspective(perspective) {
  const fragment = find('perspective').content.cloneNode(true);
  const select = selector => fragment.querySelector(selector);
  select('h3').textContent = perspective.title;
  if (perspective.resident === null) {
    select('.resident').textContent = 'No distinct resident with supporting records was available.';
    for (const selector of ['.interpretation', '.checkpoints', '.evidence']) select(selector).remove();
    return fragment;
  }

  select('.resident').textContent = `${perspective.resident} · ${perspective.household}`;
  select('.interpretation p').textContent = perspective.interpretation;
  select('.before').textContent = housingLabel(perspective.before);
  select('.after').textContent = housingLabel(perspective.after);
  select('.unit-status').textContent = perspective.priorUnitStatus ?? 'Unavailable';
  select('.before-link').href = perspective.beforeLink;
  select('.after-link').href = perspective.afterLink;
  if (perspective.routeEvidence) {
    select('.route-link').href = perspective.routeEvidence;
    select('.route-link').hidden = false;
  }
  return fragment;
}

function renderReport(report) {
  find('month').textContent = `Simulation month ${report.month} · ${report.district}`;
  find('event-title').textContent = 'Flood damage';
  find('outcome').textContent = `The city recorded flood damage to ${report.affectedUnits} housing units.`;
  find('provenance').textContent =
    `Simulated city · Seed ${report.seed} · ${report.modelVersion} · ${report.rulesVersion}`;
  find('event-link').href = report.evidenceLink;
  find('replay-link').href = report.replayLink;
  find('perspectives').replaceChildren(...report.perspectives.map(renderPerspective));
}

async function open() {
  reportPanel.hidden = true;
  record.hidden = true;
  retry.hidden = true;
  status.hidden = false;
  status.textContent = 'Reading saved city records…';
  try {
    const { state, report } = await loadPerspectives();
    if (state === 'missing') {
      status.textContent = 'The city demo has no saved run yet.';
      record.hidden = false;
    } else if (state === 'incomplete') {
      status.textContent = 'The saved city run is incomplete.';
    } else if (state === 'no-event') {
      status.textContent = 'The saved city run has no supported flood record.';
    } else {
      renderReport(report);
      status.hidden = true;
      reportPanel.hidden = false;
    }
  } catch (error) {
    status.textContent = `Could not load the perspectives. ${error.message}`;
    retry.hidden = false;
  }
}

retry.addEventListener('click', open);
open();
