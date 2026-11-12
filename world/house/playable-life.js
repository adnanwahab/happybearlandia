import { createPopulationRuntime } from '../population/runtime.js';
import { persistCityReturn } from './bridge.js';
import { journeyURL } from '../future-journey/navigation.js';

const DAY = 1440;
const FOLLOW_UP_DAYS = 30;
const sessionVersion = 'playable-life.v1';
const labels = { work: 'Clean the living room', travel: 'Travel home', socialize: 'Talk with a housemate', purchase: 'Buy a plant', rest: 'Rest' };

function element(doc, tag, text) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  return node;
}

export function residentSummary(person, household) {
  return {
    name: person.name,
    home: person.homeId ?? null,
    job: person.employment?.jobId ?? person.employmentStatus ?? null,
    schedule: person.schedule ?? null,
    activity: person.currentActivity ?? null,
    needs: person.needs ?? {},
    savings: household.savings ?? household.budget?.savings ?? null,
  };
}

export function submitLifeAction(runtime, { householdId, entityId }, action, targetId) {
  const actor = { householdId, personId: entityId };
  switch (action) {
    case 'work': return runtime.householdAction({ ...actor, type: 'clean', roomId: 'living' });
    case 'travel': return runtime.walkPerson(entityId, { home: true });
    case 'socialize': return runtime.socialAction(entityId, targetId, 'talk');
    case 'purchase': return runtime.householdAction({ ...actor, type: 'furniture', object: 'plant' });
    case 'rest': return runtime.householdAction({ ...actor, type: 'rest' });
    default: throw new Error('Choose a supported resident action.');
  }
}

// Compare only arms with the same recorded starting state, identity and clock.
export function lifeComparison(report) {
  const a = report.arm, b = report.matchedControl;
  if (!a || !b || !b.after || !['seed', 'modelVersion', 'runId', 'entityId', 'startTick', 'endTick'].every(
    key => a[key] != null && a[key] === b[key])) return null;
  const difference = (x, y) => Number.isFinite(x) && Number.isFinite(y) ? x - y : null;
  return {
    needs: Object.fromEntries(Object.entries(report.after.needs).map(([key, value]) => [key, difference(value, b.after.needs[key])])),
    savings: difference(report.after.savings, b.after.savings),
  };
}

export async function mountPlayableLife(container, { runtime, entry, record }, entityId, { review = false } = {}) {
  const doc = container.ownerDocument;
  const make = (tag, text) => element(doc, tag, text);
  const { householdId, members } = entry;
  if (!members.includes(entityId)) throw new Error('Choose a resident from this saved household.');
  runtime.pause();
  const root = make('main');
  root.className = 'house-chooser';
  const title = make('h1', 'Live a day as a resident');
  const identity = make('p', entityId);
  const facts = make('dl');
  const profile = make('details');
  profile.append(make('summary', 'Relationships and goals'));
  const clock = make('p');
  const status = make('p');
  status.setAttribute('role', 'status');
  const controls = make('section');
  controls.setAttribute('aria-label', 'Resident actions');
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem';
  const result = make('section');
  const links = make('nav');
  links.setAttribute('aria-label', 'Saved city checkpoints');
  root.append(title, identity, facts, profile, clock, controls, status, result, links);
  container.replaceChildren(root);
  const location = doc.defaultView.location;
  if (new URLSearchParams(location.search).get('journey') === '1') {
    const back = make('a', 'Return to Worldline');
    back.href = journeyURL('worldline', { experiment: record.id, person: entityId, tick: runtime.getSnapshot().runtime.tick }, location.search);
    root.prepend(back);
  }

  const read = async () => {
    const person = await runtime.inspectPerson(entityId);
    const household = await runtime.inspectHousehold(householdId);
    if (!person || !household) throw new Error('The saved resident is unavailable.');
    return { person, household };
  };

  function showFacts({ person, household }) {
    const summary = residentSummary(person, household);
    title.textContent = 'Live a day as ' + (summary.name ?? entityId);
    const rows = [
      ['Home', summary.home], ['Job', summary.job],
      ['Schedule', summary.schedule?.template], ['Current activity', summary.activity],
      ...Object.entries(summary.needs),
    ];
    facts.replaceChildren(...rows.flatMap(([label, value]) => [
      make('dt', label), make('dd', Number.isFinite(value) ? value.toFixed(1) : value ?? 'Unavailable'),
    ]));
    const relationships = make('ul');
    const goals = make('ul');
    for (const row of (person.social?.relationships ?? []).slice(0, 12)) {
      relationships.append(make('li', [row.name, row.label].filter(Boolean).join(' · ')));
    }
    for (const goal of person.social?.goals ?? []) {
      goals.append(make('li', goal.title + (goal.completed ? ' · Completed' : '')));
    }
    profile.replaceChildren(make('summary', 'Relationships and goals'),
      make('h2', 'Relationships'), relationships.childElementCount ? relationships : make('p', 'No relationships recorded.'),
      make('h2', 'Current goals'), goals.childElementCount ? goals : make('p', 'No goals recorded.'));
  }

  const anchor = (text, url) => {
    const link = make('a', text);
    link.href = url;
    link.style.display = 'block';
    return link;
  };
  const worldURL = id => '/world?' + new URLSearchParams({ experiment: id });
  const residentURL = (id, mode) => '/world/house/' + encodeURIComponent(householdId) + '?' +
    new URLSearchParams({ experiment: id, person: entityId, [mode]: '1' });

  function showReport(report, finalId) {
    const { controlSession, before, dayEnd: day, after, events, actions, trace } = report;
    title.textContent = 'A day as ' + (before.name ?? entityId);
    clock.textContent = 'The city advanced 30 modeled days after the resident’s day ended.';
    const changes = make('dl');
    for (const [key, value] of Object.entries(before.needs)) {
      const values = [value, day.needs[key], after.needs[key]];
      if (values.some(Number.isFinite)) changes.append(make('dt', key), make('dd',
        values.map(entry => Number.isFinite(entry) ? entry.toFixed(1) : 'Unavailable').join(' → ')));
    }
    for (const [key, label] of [['home', 'Home'], ['job', 'Job'], ['activity', 'Activity']]) {
      changes.append(make('dt', label), make('dd',
        [before[key], day[key], after[key]].map(value => value ?? 'Unavailable').join(' → ')));
    }
    changes.append(make('dt', 'Household savings'), make('dd',
      [before.savings, day.savings, after.savings].map(value => Number.isFinite(value) ? value.toFixed(2) : 'Unavailable').join(' → ')));
    const evidence = make('details');
    evidence.id = 'evidence';
    const evidenceRows = make('ol');
    for (const event of events) evidenceRows.append(make('li', 'Minute ' + event.minute + ' · ' + event.type.replaceAll('_', ' ')));
    const decisions = make('ul');
    for (const [period, rows] of [['End of day', trace.day], ['Follow-up', trace.followUp]]) {
      for (const row of rows) {
        decisions.append(make('li', [period, row.type, row.chosen, row.reason].filter(Boolean).join(' · ')));
      }
    }
    const commands = make('ol');
    for (const receipt of actions) {
      commands.append(make('li', 'Minute ' + receipt.minute + ' · ' + labels[receipt.action] +
        (receipt.actionId ? ' · ' + receipt.actionId : '') + (receipt.detail ? ' · ' + receipt.detail : '')));
    }
    evidence.append(make('summary', 'Inspect recorded events and decisions'),
      make('p', 'Population model ' + report.modelVersion + ' · Up to 100 recent events from the played day.'),
      make('p', 'The follow-up includes autonomous city activity. These changes describe the observed trajectory.'),
      actions.length ? commands : make('p', 'The resident followed the ordinary schedule.'),
      evidenceRows, decisions);
    const delta = lifeComparison(report);
    const comparison = make('section');
    comparison.setAttribute('aria-label', delta ? 'Matched comparison' : 'observational');
    comparison.append(make('h2', delta ? 'Matched comparison' : 'observational'),
      make('p', 'Seed ' + (report.arm?.seed ?? 'Unavailable') + ' · Population model ' + report.modelVersion));
    if (delta) {
      const table = make('table');
      const header = make('tr');
      for (const label of ['Outcome', 'with your action', 'matched control', 'Difference']) header.append(make('th', label));
      table.append(header);
      const format = value => Number.isFinite(value) ? value.toFixed(2) : 'Unavailable';
      for (const [label, played, control, difference] of [
        ...Object.keys(delta.needs).map(key => [key, after.needs[key], report.matchedControl.after.needs[key], delta.needs[key]]),
        ['Household savings', after.savings, report.matchedControl.after.savings, delta.savings],
      ]) {
        const row = make('tr');
        for (const value of [label, format(played), format(control), format(difference)]) row.append(make('td', value));
        table.append(row);
      }
      comparison.append(table, make('p', 'Modeled difference for this command sequence in one seeded run.'));
    }
    result.replaceChildren(comparison, make('h2', 'Resident changes'), make('p', 'Start → End of day → 30-day follow-up'), changes, evidence);
    links.replaceChildren(
      anchor('Open starting World checkpoint', worldURL(controlSession.runId)),
      anchor('Open follow-up World checkpoint', worldURL(finalId)),
      anchor('Open saved resident report', residentURL(finalId, 'lifeReview')),
      anchor('Open saved event evidence', residentURL(finalId, 'lifeReview') + '#evidence'),
    );
    controls.hidden = true;
    if (doc.defaultView.location.hash === '#evidence') evidence.open = true;
  }

  if (review) {
    const report = record.save.view.playableLife;
    if (report?.schemaVersion !== sessionVersion || report.controlSession?.entityId !== entityId) {
      throw new Error('This checkpoint has no saved day for the selected resident.');
    }
    showFacts(await read());
    showReport(report, record.id);
    runtime.destroy();
    return;
  }

  // Export before accepting any command: a seed alone cannot restore current RNG/state.
  const startingCheckpoint = await runtime.exportCheckpoint();
  let controlRuntime;
  const initial = await read();
  const start = runtime.getSnapshot();
  const before = residentSummary(initial.person, initial.household);
  const { stepMinutes } = start.runtime;
  if (!Number.isInteger(stepMinutes) || stepMinutes <= 0 || DAY % stepMinutes) {
    throw new Error('The saved clock cannot represent a full day in fixed steps.');
  }
  const controlSession = {
    worldId: entry.householdId.slice(0, entry.householdId.lastIndexOf('-h')),
    runId: record.id,
    entityId,
    startTick: start.runtime.tick,
    endTick: start.runtime.tick + DAY / stepMinutes,
  };
  const population = start.config.population;
  const batchMinutes = Math.min(DAY, Math.floor(20_000_000 / population) * stepMinutes);
  const dayEnd = start.minute + DAY;
  const followUpEnd = dayEnd + FOLLOW_UP_DAYS * DAY;
  const events = new Map();
  const previousEvents = new Set((start.events ?? []).map(event => event.id));
  const actions = [];
  const pause = make('button', 'Pause follow-up');
  pause.type = 'button';
  pause.hidden = true;
  let followUpController;
  pause.addEventListener('click', () => followUpController?.abort());
  let dayClose;
  let handoff = false;
  let busy = false;
  let finished = false;
  const captureEvents = snapshot => {
    for (const event of snapshot.events ?? []) {
      if (previousEvents.has(event.id) || event.minute < start.minute || event.minute > dayEnd) continue;
      if (event.personId !== entityId && !event.personIds?.includes(entityId) && event.householdId !== householdId) continue;
      events.set(event.id, { minute: event.minute, type: event.type, id: event.id });
      if (events.size > 100) events.delete(events.keys().next().value);
    }
  };
  const unsubscribe = runtime.subscribe(captureEvents);
  doc.defaultView.addEventListener('pagehide', () => { unsubscribe(); followUpController?.abort(); controlRuntime?.destroy(); runtime.destroy(); }, { once: true });

  const target = make('select');
  target.setAttribute('aria-label', 'Housemate to talk with');
  for (const member of initial.household.memberDetails ?? []) {
    if (member.id === entityId) continue;
    const option = make('option', member.name ?? member.id);
    option.value = member.id;
    target.append(option);
  }

  const buttons = [];
  const refresh = () => {
    const remaining = Math.max(0, dayEnd - runtime.getSnapshot().minute);
    clock.textContent = handoff ? 'Autonomous follow-up' : remaining + ' modeled minutes left in this day.';
    for (const button of buttons) button.disabled = busy || finished ||
      (button !== finish && (handoff || !remaining || (button.dataset.action === 'socialize' && !target.value)));
  };
  function button(text, action) {
    const node = make('button', text);
    node.type = 'button';
    node.addEventListener('click', async () => {
      if (busy || finished) return;
      busy = true;
      status.textContent = '';
      refresh();
      try { await action(); }
      catch (error) { status.textContent = error.message; }
      finally { busy = false; if (!finished) refresh(); }
    });
    controls.append(node);
    buttons.push(node);
    return node;
  }

  for (const [action, label] of Object.entries(labels)) {
    if (action === 'socialize') controls.append(target);
    button(label, async () => {
      if (actions.length >= 24) throw new Error('Advance to the end of the day after 24 accepted commands.');
      const receipt = await submitLifeAction(runtime, { householdId, entityId }, action, target.value);
      if (receipt?.accepted === false) throw new Error(receipt.reason ?? 'The simulation declined that action.');
      actions.push({
        action,
        minute: receipt?.minute ?? runtime.getSnapshot().minute,
        actionId: receipt?.actionId ?? null,
        detail: receipt?.text ?? null,
      });
      showFacts(await read());
      status.textContent = 'Command accepted. Advance time to see elapsed effects.';
    }).dataset.action = action;
  }
  async function advanceTo(end, signal, armRuntime = runtime) {
    while (armRuntime.getSnapshot().minute < end) {
      if (signal?.aborted) throw new Error('Follow-up paused. Continue to resume from the last committed minute.');
      const minutes = Math.min(batchMinutes, end - armRuntime.getSnapshot().minute);
      const progress = await armRuntime.observeHousehold({ householdId, minutes, signal });
      if (progress.status !== 'completed') throw new Error('The clock stopped. Continue to resume from the last committed minute.');
      if (handoff) status.textContent = (armRuntime === runtime ? 'Autonomous follow-up · ' : 'Matched control · ') +
        Math.max(0, Math.floor((armRuntime.getSnapshot().minute - dayEnd) / DAY)) + ' of 30 days';
    }
  }
  button('Advance time', async () => {
    await advanceTo(Math.min(dayEnd, runtime.getSnapshot().minute + stepMinutes * Math.max(1, Math.floor(60 / stepMinutes))));
    showFacts(await read());
  });
  const finish = button('End the day and observe 30 days', async () => {
    handoff = true;
    finish.textContent = 'Continue follow-up and save';
    followUpController = new AbortController();
    pause.hidden = false;
    try {
      if (!dayClose) {
        await advanceTo(dayEnd, followUpController.signal);
        dayClose = await read();
      }
      await advanceTo(followUpEnd, followUpController.signal);
      if (!controlRuntime) {
        controlRuntime = createPopulationRuntime({ config: start.config, workerCount: 1 });
        try {
          await controlRuntime.ready;
          await controlRuntime.restoreCheckpoint(startingCheckpoint);
          controlRuntime.pause();
        } catch (error) {
          controlRuntime.destroy();
          controlRuntime = null;
          throw error;
        }
      }
      status.textContent = 'Running matched control…';
      await advanceTo(followUpEnd, followUpController.signal, controlRuntime);
    } finally {
      pause.hidden = true;
      followUpController = null;
    }
    const final = await read();
    const arm = {
      seed: start.config.seed, modelVersion: startingCheckpoint.modelVersion,
      runId: record.id, entityId, startTick: start.runtime.tick,
      endTick: runtime.getSnapshot().runtime.tick,
    };
    const controlPerson = await controlRuntime.inspectPerson(entityId);
    const controlHousehold = await controlRuntime.inspectHousehold(householdId);
    if (!controlPerson || !controlHousehold) throw new Error('The control resident is unavailable.');
    const report = {
      arm,
      matchedControl: { ...arm, seed: controlRuntime.getSnapshot().config.seed,
        endTick: controlRuntime.getSnapshot().runtime.tick,
        after: residentSummary(controlPerson, controlHousehold), actions: [] },
      schemaVersion: sessionVersion, modelVersion: record.save.checkpoint.modelVersion, controlSession, before,
      dayEnd: residentSummary(dayClose.person, dayClose.household),
      after: residentSummary(final.person, final.household),
      actions: [...actions], events: [...events.values()],
      trace: { day: (dayClose.person.decisionTrace ?? []).slice(-10), followUp: (final.person.decisionTrace ?? []).slice(-10) },
    };
    status.textContent = 'Saving the resident and city checkpoints…';
    const checkpoint = await runtime.exportCheckpoint();
    const saved = await persistCityReturn({
      save: record.save, checkpoint, parentId: record.id,
      viewPatch: { playableLife: report, selection: { id: entityId, type: 'person' },
        playback: { ...record.save.view.playback, paused: true } },
    });
    controlRuntime.destroy();
    controlRuntime = null;
    finished = true;
    unsubscribe();
    showFacts(final);
    showReport(report, saved.record.id);
    status.textContent = 'Saved the follow-up checkpoint.';
    doc.defaultView.history.replaceState(null, '', residentURL(saved.record.id, 'lifeReview'));
    runtime.destroy();
  });
  controls.append(pause);
  showFacts(initial);
  links.append(anchor('Open starting World checkpoint', worldURL(record.id)));
  refresh();
}
