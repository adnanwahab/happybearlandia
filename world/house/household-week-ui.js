import { createWeekRecorder, validateWeekReport } from './household-week.js';
import { persistCityReturn } from './bridge.js';

export function renderWeek(container, report, checkpointId) {
  validateWeekReport(report, report.householdId);
  const doc = container.ownerDocument;
  const make = (tag, text) => { const node = doc.createElement(tag); node.textContent = text; if (tag === 'pre') node.style.cssText = 'max-width:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere'; return node; };
  container.replaceChildren(make('h1', 'Household week replay'),
    make('p', `Household ${report.householdId} · Starting run ${report.runId} · Model ${report.modelVersion} · Seed ${report.seed}`),
    make('p', `Minutes ${report.startMinute}–${report.endMinute} · ${report.stepMinutes} minutes per tick · Recorded playback`),
    make('p', report.coverage.limits), make('p', `${report.coverage.evicted} matching records evicted by this report’s retention limit.`));
  for (let day = 0; day < 7; day++) {
    const start = report.startMinute + day * 1440, end = start + 1440;
    const section = make('section', '');
    section.append(make('h2', `Day ${day + 1} · Minutes ${start}–${end}`));
    const rows = report.events.filter(event => event.minute >= start && (day === 6 ? event.minute <= end : event.minute < end));
    const sample = report.observations[day];
    section.append(make('p', `Daily sample at minute ${sample.minute} · Household savings: ${sample.savings ?? 'Not recorded'}`));
    for (const person of sample.people) {
      section.append(make('p', `${person.name ?? person.id} (${person.id}) · Home: ${person.homeId ?? 'Not recorded'} · Location: ${person.locationId ?? 'Not recorded'} · Activity: ${person.activity ?? 'Not recorded'} · Travel mode: ${person.travelMode ?? 'Not recorded'}`),
        make('p', 'Needs: ' + (person.needs ? Object.entries(person.needs).map(([key, value]) => `${key}: ${Number.isFinite(value) ? value.toFixed(1) : value}`).join(' · ') : 'Not recorded')));
    }
    const list = make('ol', '');
    for (const event of rows) {
      const row = make('li', `Minute ${event.minute} · ${event.type} · ${event.id}`);
      row.dataset.eventId = event.id;
      const details = make('details', '');
      details.append(make('summary', 'Authoritative event record'), make('pre', JSON.stringify(event, null, 2)));
      row.append(details); list.append(row);
    }
    section.append(rows.length ? list : make('p', 'Gap: no matching events retained in this interval; this does not establish inactivity.'));
    const details = make('details', '');
    details.append(make('summary', 'Daily home, activity, needs and decision samples'),
      make('pre', JSON.stringify(report.observations[day], null, 2)));
    section.append(details); container.append(section);
  }
  const final = make('details', '');
  final.append(make('summary', 'End-of-week household sample'), make('pre', JSON.stringify(report.observations[7], null, 2)));
  container.append(final);
  for (const [label, id] of [['Open starting World checkpoint', report.runId], ['Open final World checkpoint', checkpointId]]) {
    const link = make('a', label); link.href = '/world?experiment=' + encodeURIComponent(id); container.append(link, make('br', ''));
  }
}

export async function mountHouseholdWeek(container, { runtime, entry, record }, { review = false, fetchImpl = fetch } = {}) {
  const doc = container.ownerDocument;
  runtime.pause();
  if (review) {
    const report = validateWeekReport(record.save.view.householdWeek, entry.householdId);
    const snap = runtime.getSnapshot();
    if (report.endMinute !== snap.minute || report.endTick !== snap.runtime.tick || report.modelVersion !== snap.modelVersion || report.seed !== snap.config.seed) {
      throw Error('The saved week does not match this checkpoint’s identity and clock.');
    }
    renderWeek(container, report, record.id); runtime.destroy(); return;
  }
  const recorder = createWeekRecorder({ ...entry, runId: record.id, snapshot: runtime.getSnapshot() });
  const root = doc.createElement('main'); root.className = 'house-chooser';
  const title = doc.createElement('h1'); title.textContent = 'Follow this household for a week';
  const identity = doc.createElement('p'); identity.textContent = `${entry.householdId} · Seven autonomous days on the saved Population clock. Home, trips, needs and decisions are shown only where recorded.`;
  const status = doc.createElement('p'); status.setAttribute('role', 'status');
  const run = doc.createElement('button'); run.textContent = 'Observe seven days and save replay';
  const pause = doc.createElement('button'); pause.textContent = 'Pause week'; pause.hidden = true;
  root.append(title, identity, run, pause, status); container.replaceChildren(root);
  let controller, busy = false, saved = false;
  const unsubscribe = runtime.subscribe(frame => recorder.capture(frame));
  const cleanup = () => { controller?.abort(); unsubscribe(); runtime.destroy(); };
  doc.defaultView.addEventListener('pagehide', cleanup, { once: true });
  pause.addEventListener('click', () => controller?.abort());
  async function sample() {
    const household = await runtime.inspectHousehold(entry.householdId);
    const people = await Promise.all(entry.members.map(id => runtime.inspectPerson(id)));
    recorder.observe(runtime.getSnapshot().minute, household, people);
  }
  run.addEventListener('click', async () => {
    if (busy || saved) return;
    busy = true; run.disabled = true; pause.hidden = false; controller = new AbortController();
    try {
      if (!recorder.report.observations.length) await sample();
      while (recorder.report.observations.length < 8) {
        if (controller.signal.aborted) throw Error('Week paused. Resume from the last committed minute.');
        const nextDay = recorder.report.startMinute + recorder.report.observations.length * 1440;
        const snap = runtime.getSnapshot();
        const batch = Math.min(1440, Math.floor(20_000_000 / snap.config.population) * snap.runtime.stepMinutes);
        if (snap.minute === nextDay) { await sample(); continue; }
        const minutes = Math.min(batch, nextDay - snap.minute);
        if (minutes <= 0) throw Error('This population exceeds the existing observation work budget.');
        const result = await runtime.observeHousehold({ householdId: entry.householdId, minutes, signal: controller.signal });
        recorder.capture(runtime.getSnapshot());
        // A cancellation at the boundary still commits that day's sample.
        if (runtime.getSnapshot().minute === nextDay) await sample();
        status.textContent = `${runtime.getSnapshot().minute - recorder.report.startMinute} of 10080 modeled minutes recorded.`;
        if (result.status !== 'completed') throw Error('Week paused. Resume from the last committed minute.');
      }
      const report = recorder.finish(runtime.getSnapshot());
      const checkpoint = await runtime.exportCheckpoint();
      const result = await persistCityReturn({ save: record.save, checkpoint, parentId: record.id, fetchImpl,
        viewPatch: { householdWeek: report, playback: { ...record.save.view.playback, paused: true } } });
      saved = true;
      renderWeek(root, report, result.record.id);
      doc.defaultView.history.replaceState(null, '', '/world/house/' + encodeURIComponent(entry.householdId) + '?' +
        new URLSearchParams({ experiment: result.record.id, weekReview: '1' }));
      cleanup();
    } catch (error) { status.textContent = error.message; run.textContent = 'Resume week and save replay'; }
    finally { busy = false; run.disabled = false; pause.hidden = true; controller = null; }
  });
}
