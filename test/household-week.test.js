import { test, expect } from 'bun:test';
import { createWeekRecorder, WEEK_MINUTES, validateWeekReport } from '../world/house/household-week.js';
import { createPopulationRuntime } from '../world/population/runtime.js';
import { readPopulationCheckpoint } from '../world/population/checkpoint.js';

const snapshot = { minute: 360, modelVersion: 'test.v1', config: { seed: 42 }, runtime: { tick: 12, stepMinutes: 30 }, events: [{ id: 'old' }] };
function recorder() { return createWeekRecorder({ householdId: 'city-h0', members: ['city-p0'], runId: 'saved123', snapshot }); }
function complete(rec) {
  for (let day = 0; day <= 7; day++) rec.observe(360 + day * 1440, { id: 'city-h0' }, [{ id: 'city-p0' }]);
  return rec.finish({ minute: 360 + WEEK_MINUTES, runtime: { tick: 348 } });
}
test('retains authoritative event payloads and causal fields, filters exact identities and orders chronologically', () => {
  const rec = recorder();
  const events = [
    { id: 'b', minute: 400, personId: 'city-p0', type: 'TRIP', parentIds: ['cause'], payload: { destination: 'work' } },
    { id: 'a', minute: 380, householdId: 'city-h0', type: 'DECISION' },
    { id: '0', minute: 400, personIds: ['city-p0'], type: 'CONTACT' },
    { id: 'old', minute: 380, householdId: 'city-h0' },
    { id: 'other', minute: 400, personId: 'city-p01' },
    { id: 'late', minute: 360 + WEEK_MINUTES + 1, householdId: 'city-h0' },
    { id: 'early', minute: 359, householdId: 'city-h0' },
  ];
  rec.capture({ events }); rec.capture({ events });
  const report = complete(rec);
  expect(report.events).toEqual([events[1], events[0], events[2]]);
  expect(report.events[1]).not.toBe(events[0]);
  expect(report).toMatchObject({ householdId: 'city-h0', seed: 42, startTick: 12, endTick: 348 });
  expect(report.coverage.limits).toContain('cannot be reconstructed');
  expect(() => validateWeekReport(report, 'city-h1')).toThrow('no complete week');
});
test('explicitly retains empty intervals, rejects incomplete week, wrong members and inexact clocks', () => {
  const rec = recorder();
  expect(() => rec.finish(snapshot)).toThrow('incomplete');
  expect(() => rec.observe(360, { id: 'wrong' }, [{ id: 'city-p0' }])).toThrow('unavailable');
  expect(() => rec.observe(360, { id: 'city-h0' }, [])).toThrow('unavailable');
  expect(() => rec.observe(1800, { id: 'city-h0' }, [{ id: 'city-p0' }])).toThrow('out of order');
  expect(complete(rec).events).toEqual([]);
  expect(() => createWeekRecorder({ householdId: 'h', members: ['p'], runId: 'r', snapshot: { ...snapshot, runtime: { stepMinutes: 7 } } })).toThrow('exact days');
});
test('report retention is bounded with a visible eviction count', () => {
  const rec = recorder();
  rec.capture({ events: Array.from({ length: 2001 }, (_, i) => ({ id: String(i), minute: 400 + i, householdId: 'city-h0' })) });
  const report = complete(rec);
  expect(report.events).toHaveLength(2000); expect(report.coverage.evicted).toBe(1);
});

test('real Population week matches worker events, exact clock and seed-matched replay from immutable checkpoint', async () => {
  const runtime = createPopulationRuntime({ config: { population: 4, householdSize: 2, seed: 42 }, initialMinute: 360, stepMinutes: 30 });
  await runtime.ready; runtime.pause();
  const checkpoint = await runtime.exportCheckpoint();
  const original = JSON.stringify(checkpoint);
  const model = readPopulationCheckpoint(checkpoint).model;
  const householdId = model.prefix + '-h0';
  const members = (await runtime.inspectHousehold(householdId)).members;
  async function run() {
    const rec = createWeekRecorder({ householdId, members, runId: 'saved123', snapshot: runtime.getSnapshot() });
    const initial = new Set(runtime.getSnapshot().events.map(e => e.id));
    const authority = new Map();
    const unsub = runtime.subscribe(frame => {
      rec.capture(frame);
      for (const e of frame.events ?? []) if (!initial.has(e.id) && (e.householdId === householdId || members.includes(e.personId) || e.personIds?.some(id => members.includes(id)))) authority.set(e.id, structuredClone(e));
    });
    try {
      for (let day = 0; day <= 7; day++) {
        if (day) expect((await runtime.observeHousehold({ householdId, minutes: 1440 })).status).toBe('completed');
        rec.observe(runtime.getSnapshot().minute, await runtime.inspectHousehold(householdId), await Promise.all(members.map(id => runtime.inspectPerson(id))));
      }
      const report = rec.finish(runtime.getSnapshot());
      expect(report.events).toEqual([...authority.values()].sort((a,b) => a.minute-b.minute));
      expect(report.observations[0].people[0].needs).not.toBeNull();
      return report;
    } finally { unsub(); }
  }
  try {
    const first = await run(); await runtime.restoreCheckpoint(checkpoint); const second = await run();
    expect(second).toEqual(first); expect(JSON.stringify(checkpoint)).toBe(original);
    expect(first.endMinute - first.startMinute).toBe(10080);
  } finally { runtime.destroy(); }
}, 30000);

// Minimal DOM, following the repository's presentation-test convention. This
// verifies real UI nodes against authority; layout still requires a browser.
function documentFixture() {
  const doc = { defaultView: { addEventListener() {}, history: { replaceState(...args) { doc.url = args[2]; } } },
    createElement(tag) { return { tag, ownerDocument: doc, children: [], dataset: {}, style: {}, handlers: {}, textContent: '',
      append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; },
      setAttribute(key, value) { this[key] = value; }, addEventListener(type, fn) { this.handlers[type] = fn; } }; } };
  return { doc, container: doc.createElement('div') };
}
function nodes(root) { return [root, ...(root.children ?? []).flatMap(nodes)]; }

test('actual week UI resumes committed time, retries failed persistence and reloads authoritative events without simulation', async () => {
  const { mountHouseholdWeek } = await import('../world/house/household-week-ui.js');
  const runtime = createPopulationRuntime({ config: { population: 2, householdSize: 2, seed: 8 }, initialMinute: 360, stepMinutes: 30 });
  await runtime.ready; runtime.pause();
  const checkpoint = await runtime.exportCheckpoint();
  const householdId = readPopulationCheckpoint(checkpoint).model.prefix + '-h0';
  const entry = { householdId, members: (await runtime.inspectHousehold(householdId)).members };
  const record = { id: 'saved123', save: { schemaVersion: 'world-experiment-save.v1', mode: 'living', checkpoint,
    geometry: {}, view: { houseMode: { householdId }, playback: { paused: true } } } };
  const { doc, container } = documentFixture();
  let posted, writes = 0, observations = 0;
  const observe = runtime.observeHousehold;
  runtime.observeHousehold = async options => {
    observations++;
    if (observations === 1) { // Pause after real committed half-day, then resume.
      const result = await observe({ ...options, minutes: 720 });
      nodes(container).find(n => n.textContent === 'Pause week').handlers.click();
      return { ...result, status: 'cancelled' };
    }
    return observe(options);
  };
  try {
    await mountHouseholdWeek(container, { runtime, entry, record }, { fetchImpl: async (_, options) => {
      writes++; posted = JSON.parse(options.body);
      return writes === 1 ? Response.json({ error: 'Quota full' }, { status: 507 }) : Response.json({ id: 'final123' });
    } });
    const button = nodes(container).find(n => n.textContent === 'Observe seven days and save replay');
    await button.handlers.click();
    expect(runtime.getSnapshot().minute).toBe(1080);
    expect(writes).toBe(0);
    await button.handlers.click();
    expect(nodes(container).some(n => n.textContent === 'Quota full')).toBe(true);
    const count = observations;
    await button.handlers.click(); // Retry only saving the already completed week.
    expect(observations).toBe(count); expect(writes).toBe(2);
    const report = posted.view.householdWeek;
    const rows = nodes(container).filter(n => n.dataset?.eventId);
    expect(rows.map(n => n.dataset.eventId)).toEqual(report.events.map(e => e.id));
    expect(rows.map(n => n.children[0].children[1].textContent)).toEqual(report.events.map(e => JSON.stringify(e, null, 2)));
    expect(nodes(container).some(n => n.textContent.includes('Gap: no matching'))).toBe(report.events.length === 0 ||
      Array.from({ length: 7 }, (_, i) => report.events.filter(e => e.minute >= report.startMinute + i*1440 && e.minute < report.startMinute + (i+1)*1440).length).includes(0));
    expect(doc.url).toContain('weekReview=1');
    const replay = documentFixture();
    await mountHouseholdWeek(replay.container, { entry, record: { id: 'final123', save: posted }, runtime: {
      pause() {}, destroy() {}, getSnapshot: () => ({ minute: report.endMinute, modelVersion: report.modelVersion,
        config: { seed: report.seed }, runtime: { tick: report.endTick } }),
    } }, { review: true });
    expect(nodes(replay.container).filter(n => n.tag === 'button')).toEqual([]);
    expect(nodes(replay.container).filter(n => n.dataset?.eventId).map(n => n.dataset.eventId)).toEqual(report.events.map(e => e.id));
    expect(record.save.checkpoint).toEqual(checkpoint); expect(posted.parentId).toBe(record.id);
  } finally { runtime.destroy(); }
}, 30000);
