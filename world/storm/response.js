import { consequences } from './compare.js';
import { simulateWater } from './physics.js';
import { compileStorm, normalizeStorm, readStorm } from './scenario.js';
import { RECOVERY_VERSION, RESPONSE_BUDGET, responseOptions, SHIFTS, simulateRecovery } from './recovery.js';
import { mountTreaty, negotiateAid } from './treaty.js';

const find = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const dollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const status = find('status');
let actions = [];
let terms = { crews: 0, offer: 0 };
let storm, impact, options, comparison;
const treaty = mountTreaty(find('treaty'), { onChange(next) {
  terms = next;
  paintPlan();
} });

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function button(label, action) {
  const node = element('button', label);
  node.type = 'button';
  node.onclick = action;
  return node;
}

function paintPlan() {
  treaty.render(terms);
  const available = options.filter(option => !actions.includes(option.id));
  find('action').replaceChildren(...available.map(job =>
    new Option(`${job.label} · ${job.duration} shifts · ${dollars.format(job.cost)}`, job.id)));
  find('dispatch').querySelector('button').disabled = !available.length;
  const selected = actions.map(id => options.find(job => job.id === id));
  const aid = negotiateAid(terms);
  const cost = selected.reduce((sum, job) => sum + job.cost, aid.accepted ? aid.price : 0);
  find('order').replaceChildren(...selected.map((job, index) => {
    const item = element('li', job.label + ' ');
    const promote = button('Move up', () => {
      [actions[index - 1], actions[index]] = [actions[index], actions[index - 1]];
      paintPlan();
    });
    promote.disabled = index === 0;
    item.append(promote, button('Remove', () => {
      actions.splice(index, 1);
      paintPlan();
    }));
    return item;
  }));
  find('cost').textContent = `${dollars.format(cost)} planned of ${dollars.format(RESPONSE_BUDGET)} modeled USD · ${1 + aid.crews} crews`;
  find('run').disabled = cost > RESPONSE_BUDGET;
  status.textContent = cost > RESPONSE_BUDGET ? 'Remove an action or request less aid to fit the budget.' : '';
  find('results').hidden = true;
}

function show() {
  const shift = Number(find('shift').value);
  const before = comparison.control.timeline[shift];
  const after = comparison.response.timeline[shift];
  find('shift-label').value = `Shift ${shift} of ${SHIFTS}`;
  const metrics = {
    closedRoads: 'Closed roads', reachableBuildings: 'Reachable buildings', operatingServices: 'Operating services',
    operatingBusinesses: 'Operating businesses', shelteredHouseholds: 'Households in shelter', spent: 'Modeled spending',
  };
  find('measures').replaceChildren(...Object.entries(metrics).map(([key, label]) => {
    const row = document.createElement('tr');
    const heading = element('th', label);
    heading.scope = 'row';
    row.append(heading, ...[before[key], after[key]].map(value =>
      element('td', key === 'spent' ? dollars.format(value) : value)));
    return row;
  }));
  const events = comparison.response.timeline.slice(0, shift + 1).flatMap(row => row.events);
  find('events').replaceChildren(...events.map(event => element('li',
    `Shift ${event.shift} · ${event.kind} · ${event.label}${event.count ? ` · ${event.count} households` : ''}`)));
  const active = after.active.map(job => `${job.label} finishes at shift ${job.finish}`);
  const waiting = after.pending.map(job => `${job.label} ${job.reachable ? 'awaits a crew or enough time' : 'awaits route access'}`);
  find('pending').textContent = [...active, ...waiting].join(' · ') || 'No active or waiting jobs.';
  const url = new URL(location.href);
  url.searchParams.set('storm', JSON.stringify(storm));
  url.searchParams.set('response', JSON.stringify({ version: RECOVERY_VERSION, actions, terms, shift }));
  find('share').href = url.href;
  history.replaceState(history.state, '', url);
}

function run(shift = SHIFTS) {
  try {
    comparison = {
      control: simulateRecovery(impact),
      response: simulateRecovery(impact, { actions, aid: negotiateAid(terms) }),
    };
    find('shift').max = SHIFTS;
    find('shift').value = Number.isInteger(shift) && shift >= 0 && shift <= SHIFTS ? shift : SHIFTS;
    find('results').hidden = false;
    show();
  } catch (error) {
    status.textContent = error.message;
  }
}

find('shift').oninput = show;
find('run').onclick = () => run();
find('dispatch').onsubmit = event => {
  event.preventDefault();
  if (find('action').value) {
    actions.push(find('action').value);
    paintPlan();
  }
};

try {
  storm = query.has('storm') ? readStorm(query.get('storm')) : normalizeStorm({ rainRate: 0.0016 });
  impact = consequences(simulateWater(compileStorm(storm)));
  options = responseOptions(impact);
  find('scope').textContent = `After storm step ${storm.steps} · ${storm.rainRate} m rain per step · ${impact.version} / ${RECOVERY_VERSION}`;
  find('storm-link').href = '/world/storm/?' + new URLSearchParams({ storm: JSON.stringify(storm), step: storm.steps });
  paintPlan();
  const encoded = query.get('response');
  if (encoded !== null) {
    if (encoded.length > 1600) throw new Error('This response link is too long.');
    const saved = JSON.parse(encoded);
    if (saved.version !== RECOVERY_VERSION) throw new Error('Unsupported response version.');
    simulateRecovery(impact, { actions: saved.actions, aid: negotiateAid(saved.terms) });
    actions = saved.actions;
    terms = saved.terms;
    paintPlan();
    run(saved.shift);
  }
} catch (error) {
  status.textContent = error.message;
  if (!options) {
    find('run').disabled = true;
    find('dispatch').querySelector('button').disabled = true;
  }
}
