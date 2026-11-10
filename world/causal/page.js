import '../causality/inspector.js';
import { VERSION } from '../city/contracts.js';
import { demoRunId } from './demo.js';
import { mountCityHeatmap } from './heatmap.js';
import { mountLivingNetwork } from '../living-city/network.js';
import { cityInventory, compareInventory, indexConstructionEvidence } from './history.js';

const find = id => document.getElementById(id);
const runButton = find('run');
const status = find('status');
const retry = find('retry');
const slider = find('month');
const eventPicker = find('event');
const checkpointStatus = find('checkpoint');
const inventory = find('inventory');
const inspectorHost = find('inspector');
const runPicker = find('saved-run');
const updateHeatmap = mountCityHeatmap(find('heatmap'));
const networkDetails = find('network-details');
const updateHistoricalNetwork = mountLivingNetwork(find('historical-network'));
let networkSnapshot;
networkDetails.addEventListener('toggle', () => {
  updateHistoricalNetwork(networkDetails.open ? networkSnapshot : null);
});
const checkpointCacheSize = 12;
const labels = {
  buildings: 'Buildings',
  households: 'Households',
  workers: 'People',
  businesses: 'Businesses',
  links: 'District links',
};
let selectedRun;
let savedRuns = new Map();
let selectionNumber = 0;
let requestNumber = 0;

async function read(path, query = {}, options) {
  const url = new URL('/api/causality/' + path, location.origin);
  url.search = new URLSearchParams(query);
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.message || result.error || 'Request failed'), {
      status: response.status,
    });
  }
  return result;
}

async function readPages(path, query, cursorKey, validCursor) {
  const items = [];
  let cursor = null;
  do {
    const page = await read(path, {
      ...query, limit: 250, ...(cursor === null ? {} : { [cursorKey]: cursor }),
    });
    items.push(...page.items);
    if (page.nextCursor !== null && !validCursor(page.nextCursor, cursor)) {
      throw new Error('The history cursor did not advance.');
    }
    cursor = page.nextCursor;
  } while (cursor !== null);
  return items;
}

const sequenceAdvances = (next, prior) => Number.isSafeInteger(next) && next > (prior ?? -1);
const idAdvances = (next, prior) => typeof next === 'string' && next > (prior ?? '');

function compatibleRun(run) {
  return run.status === 'completed' && run.context.modelVersion === VERSION &&
    (run.metadata?.manifest?.domain ?? 'world-city') === 'world-city';
}

function runLabel(run) {
  if (run.id === demoRunId) return 'Deterministic demo';
  const kind = run.context.parentRunId ? 'Branched city' : 'City recording';
  return `${kind} · seed ${run.context.seed} · ${run.id}`;
}

async function listRuns() {
  const runs = await readPages('runs', { status: 'completed' }, 'afterId', idAdvances);
  return new Map(runs.filter(compatibleRun).map(run => [run.id, run]));
}

function renderRunPicker(runId) {
  runPicker.replaceChildren(new Option('Choose a saved city run', ''));
  runPicker.options[0].disabled = true;
  const runs = [...savedRuns.values()];
  for (const run of runs) runPicker.add(new Option(runLabel(run), run.id));
  runPicker.value = savedRuns.has(runId) ? runId : '';
  find('run-selection').hidden = runs.length === 0;
}

async function loadRun(run) {
  const { context } = run;
  const [metadata, recordedEvents] = await Promise.all([
    readPages('checkpoints', { runId: run.id }, 'afterSequence', sequenceAdvances),
    readPages('events', { runId: run.id }, 'afterSequence', sequenceAdvances),
  ]);
  const checkpoints = new Map();
  for (const checkpoint of metadata) {
    if (checkpoint.domain !== 'world-city' || checkpoint.modelVersion !== VERSION ||
        checkpoint.adapterVersion !== 'city-replay.v1' || !Number.isSafeInteger(checkpoint.tick) ||
        checkpoint.tick < 0) continue;
    const previous = checkpoints.get(checkpoint.tick);
    if (!previous || checkpoint.id < previous.id) checkpoints.set(checkpoint.tick, checkpoint);
  }
  const months = [...checkpoints.keys()].sort((a, b) => a - b);
  if (!months.length) throw new Error('This run has no supported city checkpoints.');
  return {
    context,
    checkpoints,
    inventory: new Map(),
    events: new Map(recordedEvents.map(event => [event.id, event])),
    constructionEvidence: indexConstructionEvidence(recordedEvents, context.worldId),
    firstMonth: months[0],
    lastMonth: months.at(-1),
  };
}

function renderTimeline(run) {
  slider.min = run.firstMonth;
  slider.max = run.lastMonth;
  find('first-month').textContent = run.firstMonth;
  find('last-month').textContent = run.lastMonth;
  eventPicker.length = 1;
  for (const event of run.events.values()) {
    if (!run.checkpoints.has(event.context.tick)) continue;
    const label = event.type.replaceAll('_', ' ').toLowerCase();
    const transition = event.payload.transition;
    const subject = typeof transition === 'string' ? ` for ${transition.toLowerCase().replaceAll('_', ' ')}` : '';
    eventPicker.add(new Option(`Month ${event.context.tick} · ${label}${subject}`, event.id));
  }
}

async function loadInventory(run, month) {
  const checkpointId = run.checkpoints.get(month)?.id;
  if (!checkpointId) throw new Error('No stored checkpoint is available for this month.');
  const result = await read('state', {
    context: JSON.stringify({ ...run.context, tick: month }), tick: month, checkpointId,
  });
  if (result.checkpoint?.id !== checkpointId || result.checkpoint.tick !== month ||
      result.context?.runId !== run.context.runId || result.targetTick !== month ||
      result.state?.month !== month) {
    throw new Error('The server did not return the selected stored checkpoint.');
  }
  return { state: result.state, rows: cityInventory(result.state, run.context.worldId) };
}

function getInventory(run, month) {
  let pending = run.inventory.get(month);
  if (pending) run.inventory.delete(month);
  else {
    pending = loadInventory(run, month).catch(error => {
      if (run.inventory.get(month) === pending) run.inventory.delete(month);
      throw error;
    });
  }
  run.inventory.set(month, pending);
  if (run.inventory.size > checkpointCacheSize) {
    run.inventory.delete(run.inventory.keys().next().value);
  }
  return pending;
}

function updateURL(month, eventId, entityId) {
  const url = new URL(location.href);
  url.searchParams.set('runId', selectedRun.context.runId);
  url.searchParams.set('month', month);
  url.searchParams.delete('targetId');
  for (const [key, value] of [['event', eventId], ['inspectEntity', entityId]]) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  history.replaceState(history.state, '', url);
}

function inspect(month, entityId, eventId) {
  for (const button of inventory.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.entityId === entityId));
  }
  if (!entityId && !eventId) {
    inspectorHost.replaceChildren();
    return;
  }
  const inspector = document.createElement('causal-inspector');
  inspector.tab = eventId ? 'Why' : 'History';
  inspector.context = { runId: selectedRun.context.runId, tick: month, entityId, targetId: eventId };
  inspectorHost.replaceChildren(inspector);
}

function renderInventory(rows, month) {
  const sections = Object.entries(rows).map(([collection, items]) => {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = labels[collection];
    const list = document.createElement('ul');
    for (const row of items) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.entityId = row.id;
      const name = document.createElement('strong');
      name.textContent = row.change ? `${row.name} · ${row.change}` : row.name;
      const detail = document.createElement('small');
      detail.textContent = row.description;
      button.append(name, detail);
      if (row.change) button.classList.add('changed');
      if (row.previous) {
        const previous = document.createElement('small');
        previous.textContent = `Previous month · ${row.previous}`;
        button.append(previous);
      }
      const eventId = collection === 'buildings' ? selectedRun.constructionEvidence(month, row.id) : undefined;
      if (eventId) {
        const evidence = document.createElement('small');
        evidence.textContent = 'Construction evidence available';
        button.append(evidence);
      }
      button.onclick = () => {
        eventPicker.value = eventId ?? '';
        updateURL(month, eventId, row.id);
        inspect(month, row.id, eventId);
      };
      li.append(button);
      list.append(li);
    }
    section.append(title, list);
    return section;
  });
  inventory.replaceChildren(...sections);
}

async function showMonth(month, { eventId, entityId } = {}) {
  const run = selectedRun;
  if (!run) return;
  const request = ++requestNumber;
  slider.value = month;
  eventPicker.value = eventId ?? '';
  find('month-label').value = `Month ${month}`;
  slider.setAttribute('aria-valuetext', `Month ${month} of ${run.lastMonth}`);
  inventory.replaceChildren();
  inspectorHost.replaceChildren();
  updateHeatmap(null);
  networkSnapshot = null;
  updateHistoricalNetwork(null);
  checkpointStatus.textContent = `Loading stored month ${month}…`;
  updateURL(month, eventId, entityId);
  try {
    const [current, previous] = await Promise.all([
      getInventory(run, month), run.checkpoints.has(month - 1) ? getInventory(run, month - 1) : null,
    ]);
    if (request !== requestNumber) return;
    renderInventory(compareInventory(current.rows, previous?.rows), month);
    updateHeatmap(current.state);
    networkSnapshot = {
      state: current.state,
      events: [...run.events.values()].filter(event => event.context.tick === month),
    };
    if (networkDetails.open) updateHistoricalNetwork(networkSnapshot);
    checkpointStatus.textContent = previous
      ? `Stored month ${month} · changes since month ${month - 1}`
      : month === run.firstMonth ? `Stored month ${month} · starting state` : `Stored month ${month}`;
    inspect(month, entityId, eventId);
  } catch (error) {
    if (request !== requestNumber) return;
    checkpointStatus.textContent = `Could not open month ${month}. ${error.message}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Retry checkpoint';
    button.onclick = () => showMonth(month, { eventId, entityId });
    checkpointStatus.append(' ', button);
  }
}

async function openScenario({ runId, month, eventId, entityId, record = false, refreshRuns = false } = {}) {
  const selection = ++selectionNumber;
  requestNumber++;
  selectedRun = undefined;
  retry.hidden = true;
  runButton.disabled = true;
  find('history').hidden = true;
  inventory.replaceChildren();
  inspectorHost.replaceChildren();
  status.textContent = record ? 'Recording the seeded city scenario…' : 'Checking for saved city checkpoints…';
  try {
    if (record) await read('world-scenario', {}, { method: 'POST' });
    const runs = refreshRuns || record ? await listRuns() : savedRuns;
    if (selection !== selectionNumber) return;
    savedRuns = runs;
    const run = runs.get(runId ?? demoRunId) ?? (runId ? undefined : runs.values().next().value);
    renderRunPicker(run?.id);
    runButton.hidden = runs.has(demoRunId);
    runButton.disabled = false;
    if (!run) {
      if (runId) throw new Error('This saved city run is unavailable.');
      status.textContent = 'Record the scenario to create the first set of checkpoints.';
      return;
    }
    const opened = await loadRun(run);
    if (selection !== selectionNumber) return;
    selectedRun = opened;
    renderTimeline(opened);
    find('history').hidden = false;
    status.textContent = `${runLabel(run)} · months ${opened.firstMonth}–${opened.lastMonth}`;
    const event = opened.events.get(eventId);
    if (event && opened.checkpoints.has(event.context.tick)) {
      await showMonth(event.context.tick, { eventId: event.id, entityId: entityId ?? event.entityIds[0] });
      return;
    }
    const requested = Number(month);
    const initialMonth = Number.isSafeInteger(requested) && requested >= opened.firstMonth &&
      requested <= opened.lastMonth ? requested : opened.firstMonth;
    await showMonth(initialMonth, { entityId });
  } catch (error) {
    if (selection !== selectionNumber) return;
    status.textContent = `Could not open the scenario. ${error.message}`;
    retry.hidden = false;
    retry.onclick = () => openScenario({ runId, month, eventId, entityId, refreshRuns: true });
    runButton.disabled = false;
  }
}

runButton.onclick = () => openScenario({ runId: demoRunId, record: true });
runPicker.onchange = () => openScenario({ runId: runPicker.value });
slider.oninput = () => {
  const entityId = new URLSearchParams(location.search).get('inspectEntity');
  showMonth(Number(slider.value), { entityId });
};
eventPicker.onchange = () => {
  const event = selectedRun?.events.get(eventPicker.value);
  if (event) showMonth(event.context.tick, { eventId: event.id, entityId: event.entityIds[0] });
  else showMonth(Number(slider.value));
};

const params = new URLSearchParams(location.search);
openScenario({
  runId: params.get('runId') ?? undefined,
  month: params.get('month') ?? params.get('tick'),
  eventId: params.get('event') ?? params.get('targetId'),
  entityId: params.get('inspectEntity') ?? params.get('entityId'),
  refreshRuns: true,
});
