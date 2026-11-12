import { describe, expect, test } from 'bun:test';
import { createFeedbackAdapter, stormFeedback, tenYearFeedback } from '../world/onboarding/feedback-adapter.js';
import { mountFirstRunGuide } from '../world/first-run-guide.js';

describe('World feedback evidence', () => {
  const adapter = createFeedbackAdapter();
  test('configuration never claims an outcome', () => {
    const ids = ['t_bus']; const f = adapter.configured({ label: 'Transit', proposalIds: ids });
    ids.push('g_delivery'); expect(f.proposalIds).toEqual(['t_bus']); expect(f.kind).toBe('configured');
    expect(f.text).toContain('not been established');
  });
  test('observations preserve authority and missing needs rather than manufacturing mood', () => {
    const f = adapter.observed({ authority: 'population', residentId: 'resident-7', name: 'A', activity: 'walking', minute: 12, needs: { hunger: 90 } });
    expect(f.mood).toBeNull(); expect(f.source).toBe('Population live resident'); expect(f.residentId).toBe('resident-7');
    expect(f.text).toContain('does not establish');
    expect(adapter.observed({ needs: { hunger: 0, energy: 0, fun: 0, social: 0 } }).mood).toBe(0);
  });
  test('matched data keeps zeros, units, threshold and actual provenance', () => {
    const f = adapter.measured({ avg: { noPlan: 0, withPlan: 5.2 }, improved: 0, worse: 1, days: 7, best: { index: 3, name: 'B' } }, { seed: 'town-a', modelVersion: 'legacy-v1' });
    expect(f.available).toBe(true); expect(f.delta).toBe(5.2); expect(f.improved).toBe(0); expect(f.threshold).toBe(5);
    expect(f.resident.index).toBe(3); expect(f.seed).toBe('town-a'); expect(f.provenance.modelVersion).toBe('legacy-v1');
    expect(f.text).toContain('clocks are separate');
  });
  test('invalid measurements do not turn into zero outcomes', () => {
    for (const bad of [undefined, null, NaN, Infinity, '42']) {
      const f = adapter.measured({ avg: { noPlan: bad, withPlan: 10 } });
      expect(f.available).toBe(false); expect(f.delta).toBeNull();
    }
  });
  test('storm and ten-year results retain their distinct scope', () => {
    const storm = stormFeedback({ floodedNow: 0, displaced: 2 });
    expect(storm.floodedParcels).toBe(0); expect(storm.text).toContain('safe destination');
    expect(tenYearFeedback({ Balanced: { history: [{ year: 10 }] } }).kind).toBe('ten-year');
  });
});

// Small DOM double exercises callback/visibility semantics without a browser renderer.
function dom() {
  const nodes = [];
  const doc = { createElement(tag) { const events = {}; const node = { tag, ownerDocument: doc, textContent: '', dataset: {}, style: {}, hidden: false,
    children: [], append(child) { this.children.push(child); }, setAttribute() {}, addEventListener(name, fn) { events[name] = fn; }, removeEventListener(name) { delete events[name]; }, remove() { this.removed = true; }, click() { events.click?.(); }, dispatch(name) { events[name]?.(); } };
    nodes.push(node); return node; } };
  return { nodes, container: doc.createElement('main') };
}
test('guide gates readiness, renders honest error/retry, dispatches actions and disposes', () => {
  const { nodes, container } = dom(); let starts = 0, inspections = 0;
  const guide = mountFirstRunGuide({ container, onQuickDemo: () => starts++, onReplay() {}, onInspect: () => inspections++ });
  const find = id => nodes.find(n => n.dataset.testid === id);
  expect(find('quick-demo').disabled).toBe(true);
  guide.update({ ready: true }); find('quick-demo').click(); expect(starts).toBe(1);
  guide.update({ status: 'computing', progress: { stage: 'Warmup', fraction: 0.25 } });
  expect(find('quick-demo').disabled).toBe(true); expect(find('quick-demo-status').textContent).toContain('25%');
  guide.update({ status: 'error', error: 'Worker unavailable' });
  expect(find('quick-demo-status').textContent).toContain('Worker unavailable'); expect(find('quick-demo-replay').textContent).toBe('Retry comparison');
  guide.update({ observation: createFeedbackAdapter().observed({ name: '<script>', activity: 'walking', mood: 0 }) });
  find('quick-demo-inspect').click(); expect(inspections).toBe(1);
  expect(nodes.some(n => n.textContent.includes('<script>: walking. Mood: 0.0'))).toBe(true);
  guide.hide(); expect(container.children[0].hidden).toBe(true); guide.show(); expect(container.children[0].hidden).toBe(false);
  guide.dispose(); find('quick-demo').click(); expect(starts).toBe(1); expect(container.children[0].removed).toBe(true);
});

test('repeat prompt changes one year only after completion and preserves a pending selection', () => {
  const { nodes, container } = dom(); const changes = [];
  const guide = mountFirstRunGuide({ container, onChangeYear: year => changes.push(year) });
  const find = id => nodes.find(n => n.dataset.testid === id);
  const change = find('quick-demo-change'), year = find('quick-demo-year');
  const prompt = nodes.find(n => n.children.some(child => child.tag === 'h3' && child.textContent === 'Change one thing'));
  expect(prompt.hidden).toBe(true);
  guide.update({ status: 'completed', runId: 1, feedback: { kind: 'matched', year: 3 } });
  expect(prompt.hidden).toBe(false); expect(year.value).toBe('0');
  year.value = '5'; year.dispatch('change');
  guide.update({ status: 'completed', runId: 1 });
  expect(year.value).toBe('5'); change.click(); expect(changes).toEqual([5]);
  year.value = '3'; year.dispatch('change'); expect(change.disabled).toBe(true);
  change.click(); expect(changes).toEqual([5]);
  for (const status of ['computing', 'stopped', 'error']) {
    guide.update({ status }); expect(prompt.hidden).toBe(true); expect(change.disabled).toBe(true);
  }
  guide.update({ status: 'completed', runId: 2, feedback: { kind: 'matched', year: 0 } });
  expect(year.value).toBe('3'); expect(change.disabled).toBe(false);
  guide.dispose(); change.click(); expect(changes).toEqual([5]);
});
