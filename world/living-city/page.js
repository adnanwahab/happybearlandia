import { mountBuilder } from './builder-panel.js';
import { VERSION } from '../city/contracts.js';
import { cityMetrics } from '../city/engine.js';
import { COMMUTE_OPTIONS, QUEST_SCENARIO_VERSION } from './quests.js';
import { decodeChallenge, encodeChallenge } from './recipe.js';
import { mountLivingNetwork } from './network.js';
import { mountLivingCouncil } from './council.js';

const find = id => document.getElementById(id);
const sampleCount = 100;
const months = 12;
const defaultSeed = 2911;
const defaultAmount = 8;
const recipeVersion = `${QUEST_SCENARIO_VERSION}+${VERSION}`;
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
const updateNetwork = mountLivingNetwork(find('network'));
const updateCouncil = mountLivingCouncil(find('council'));
let workerError;
let sequence = 0;
let starting;
let activeExperiment;
let currentPair;
let enteredSnapshot;
let homeOpen = false;
let replayRevision = 0;

worker.addEventListener('message', ({ data }) => {
  const request = pending.get(data.id);
  if (!request) return;
  pending.delete(data.id);
  if (data.error) request.reject(new Error(data.error));
  else request.resolve(data.result);
});

worker.addEventListener('error', () => {
  workerError = new Error('The simulation worker could not run.');
  for (const request of pending.values()) request.reject(workerError);
  pending.clear();
});

function simulate(action, options) {
  if (workerError) return Promise.reject(workerError);
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, action, options });
  });
}

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function measurements(host, rows) {
  host.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div');
    row.append(element('dt', label), element('dd', value));
    return row;
  }));
}

function measure(value, unit = '') {
  return Number.isFinite(value) ? `${number.format(value)}${unit ? ' ' + unit : ''}` : 'Unavailable';
}

function direction(delta) {
  return Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${measure(delta, 'min')}` : 'No matched trip';
}

function selection() {
  return enteredSnapshot ?? currentPair?.[find('view').value] ?? starting;
}

function showHome(snapshot) {
  const { state, participant } = snapshot;
  const household = state.households.find(row => row.id === participant.householdId);
  const building = state.buildings.find(row => row.id === participant.buildingId);
  const district = state.districts.find(row => row.id === household?.districtId);
  const job = state.jobs.find(row => row.id === participant.jobId);
  const destination = state.districts.find(row => row.id === job?.districtId);
  const title = element('h3', district ? `Home in ${district.name}` : 'Resident’s home');
  const details = document.createElement('dl');
  measurements(details, [
    ['Resident', participant.personId],
    ['Building', building?.id ?? 'No assigned building'],
    ['Household', household?.id ?? 'Not in this city state'],
    ['Work district', destination?.name ?? 'No recorded workplace'],
    ['Recorded commute', measure(participant.commuteMinutes, 'min')],
  ]);
  const host = find('home');
  host.replaceChildren(title, details);
  host.hidden = false;
}

function showSnapshot() {
  const snapshot = selection();
  updateNetwork({
    state: snapshot.state, trips: snapshot.trips, events: snapshot.events,
    selectedWorkerId: snapshot.participant.personId,
  });
  if (homeOpen) showHome(snapshot);
}

function showQuest() {
  const quest = starting.quests.find(item => item.id === find('quest').value);
  if (!quest) return;
  find('quest-title').textContent = quest.title;
  find('request').textContent = quest.request;
  const visit = find('visit');
  visit.hidden = quest !== starting.quests[0];
  if (visit.hidden && homeOpen) {
    homeOpen = false;
    find('home').hidden = true;
    visit.setAttribute('aria-expanded', 'false');
  }
  measurements(find('quest-evidence'), quest.evidence.map(row => [
    row.label, `${measure(row.value, row.unit)} · Month ${row.month}`,
  ]));
}

function setProposal() {
  const option = COMMUTE_OPTIONS.find(item => item.amount === Number(find('investment').value));
  const district = starting.state.districts.find(row => row.id === starting.participant.districtId);
  find('proposal').textContent =
    `Propose a capacity upgrade in ${district?.name ?? 'the home district'} at a modeled cost of ${currency.format(option.cost)}. Construction and funding follow the city model.`;
  if (currentPair && activeExperiment.amount === option.amount) {
    updateCouncil({ before: currentPair.baseline, after: currentPair.intervention, proposal: option });
  } else {
    const before = { ...cityMetrics(starting.state), commuteMinutes: starting.participant.commuteMinutes };
    updateCouncil({ before, after: null, proposal: option });
  }
}

function showSummary(ensemble) {
  const { summary, samples } = ensemble;
  measurements(find('summary'), [
    ['Matched commutes', `${summary.paired} of ${samples.length} pairs`],
    ['Shorter / unchanged / longer', `${summary.improved} / ${summary.unchanged} / ${summary.worsened}`],
    ['Average paired change', direction(summary.meanDelta)],
    ['Average budget change', Number.isFinite(summary.meanBalanceDelta)
      ? currency.format(summary.meanBalanceDelta) : 'Unavailable'],
    ['Range of paired changes', summary.paired ? `${direction(summary.minDelta)} to ${direction(summary.maxDelta)}` : 'No matched trips'],
  ]);
  find('sample').replaceChildren(...samples.map(sample => {
    const delta = Number.isFinite(sample.baseline.commuteMinutes) && Number.isFinite(sample.intervention.commuteMinutes)
      ? sample.intervention.commuteMinutes - sample.baseline.commuteMinutes : null;
    return new Option(`Pair ${sample.index + 1} · Seed ${sample.seed} · ${direction(delta)}`, sample.index);
  }));
}

function describeCommute(arm) {
  if (!Number.isFinite(arm.commuteMinutes)) return 'has no measured commute';
  const mode = arm.participant.trip?.mode;
  return `records a ${measure(arm.commuteMinutes, 'min')} commute${mode ? ' by ' + mode : ''}`;
}

async function openPair(index) {
  const revision = ++replayRevision;
  const experiment = activeExperiment;
  const { seed, amount } = experiment;
  find('sample').value = index;
  find('share').value = '';
  find('copy').disabled = true;
  find('pair-scorecard').hidden = true;
  find('pair-status').textContent = `Replaying pair ${index + 1}…`;
  try {
    const pair = await simulate('replay', { seed, amount, index, months });
    if (revision !== replayRevision) return;
    enteredSnapshot = null;
    currentPair = pair;
    find('view').value = 'intervention';
    const { baseline, intervention } = pair;
    measurements(find('pair'), [
      ['Commute · baseline', measure(baseline.commuteMinutes, 'min')],
      ['Commute · transit future', measure(intervention.commuteMinutes, 'min')],
      ['Proposal stage', intervention.policyStage ?? 'Unavailable'],
    ]);
    find('pair-status').textContent = `Pair ${index + 1} · Seed ${pair.seed} · ${months} months after the decision`;
    find('pair-shock').textContent = pair.shock
      ? `Both arms include a modeled Riverside flood beginning in month ${pair.shock.start}, lasting ${pair.shock.duration} month(s).`
      : 'This pair has no scheduled flood.';
    find('answer').textContent =
      `${baseline.participant.personId} ${describeCommute(baseline)} in the baseline and ${describeCommute(intervention)} with the transit proposal.`;
    const proposal = COMMUTE_OPTIONS.find(option => option.amount === amount);
    const before = baseline.commuteMinutes;
    const after = intervention.commuteMinutes;
    const delta = Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
    const fraction = delta !== null && before > 0 ? delta / before : null;
    find('pair-difference').textContent = delta === null ? 'Commute change unavailable for this pair.' :
      direction(delta) + (fraction === null ? '' : ` · ${new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(fraction)} from baseline`);
    const bar = find('pair-bar');
    const width = delta === null ? 0 : 50 * Math.abs(delta) / Math.max(1, before, after);
    bar.style.width = width + '%';
    bar.style.left = (delta < 0 ? 50 - width : 50) + '%';
    bar.dataset.direction = delta < 0 ? 'shorter' : 'longer';
    find('pair-cost').textContent = Number.isFinite(proposal?.cost)
      ? `Proposed investment · ${currency.format(proposal.cost)} modeled USD` : 'Proposed investment unavailable.';
    find('pair-scorecard').hidden = false;
    updateCouncil({ before: baseline, after: intervention, proposal });
    showSnapshot();
    const url = new URL(location.href);
    url.searchParams.set('challenge', encodeChallenge({ version: recipeVersion, seed, amount, index }));
    find('share').value = url.href;
    find('copy').textContent = 'Copy';
    find('copy').disabled = false;
    history.replaceState(history.state, '', url);
  } catch (error) {
    if (revision !== replayRevision) return;
    find('pair-status').textContent = `This pair could not be replayed. ${error.message}`;
  }
}

async function compare({ amount, index, seed }) {
  replayRevision++;
  activeExperiment = { seed, amount };
  enteredSnapshot = null;
  currentPair = null;
  find('view').value = 'starting';
  find('test').disabled = true;
  find('investment').disabled = true;
  find('results').hidden = true;
  find('share').value = '';
  setProposal();
  showSnapshot();
  find('progress').textContent = `Simulating ${sampleCount} seed-matched pairs…`;
  try {
    const ensemble = await simulate('compare', { seed, amount, samples: sampleCount, months });
    showSummary(ensemble);
    const cost = COMMUTE_OPTIONS.find(option => option.amount === amount).cost;
    find('progress').textContent =
      `Compared ${ensemble.samples.length} pairs over ${months} months · +${amount} capacity · ${currency.format(cost)} modeled cost.`;
    find('results').hidden = false;
    await openPair(index ?? 0);
  } catch (error) {
    find('progress').textContent = `The comparison could not run. ${error.message}`;
  } finally {
    find('test').disabled = false;
    find('investment').disabled = false;
  }
}

find('quest').onchange = showQuest;
find('visit').onclick = () => {
  homeOpen = !homeOpen;
  find('home').hidden = !homeOpen;
  find('visit').setAttribute('aria-expanded', String(homeOpen));
  if (homeOpen) showHome(selection());
};
find('investment').onchange = setProposal;
find('test').onclick = () => compare({ seed: starting.seed, amount: Number(find('investment').value) });
find('sample').onchange = () => openPair(Number(find('sample').value));
find('view').onchange = () => { enteredSnapshot = null; showSnapshot(); };
find('copy').onclick = async () => {
  const input = find('share');
  try {
    await navigator.clipboard.writeText(input.value);
    find('copy').textContent = 'Copied';
  } catch {
    input.select();
  }
};

async function open() {
  const encoded = new URLSearchParams(location.search).get('challenge');
  let recipe;
  let recipeError;
  if (encoded !== null) {
    try {
      recipe = decodeChallenge(encoded, { version: recipeVersion, samples: sampleCount, options: COMMUTE_OPTIONS });
    } catch (error) {
      recipeError = error.message;
    }
  }
  try {
    starting = await simulate('open', { seed: recipe?.seed ?? defaultSeed });
    find('quest').replaceChildren(...starting.quests.map(quest => new Option(quest.title, quest.id)));
    find('investment').replaceChildren(...COMMUTE_OPTIONS.map(option => new Option(option.label, option.amount)));
    find('investment').value = recipe?.amount ?? defaultAmount;
    showQuest();
    setProposal();
    showSnapshot();
    find('city').hidden = false;
    find('opening').hidden = true;
    if (recipeError) find('progress').textContent = recipeError;
    if (recipe) await compare(recipe);
  } catch (error) {
    find('opening').textContent = `Could not open the city. ${error.message}`;
  }
}

mountBuilder(find('builder'), {
  selection, simulate,
  enter(snapshot) { enteredSnapshot = snapshot; showSnapshot(); },
});

open();
