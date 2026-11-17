import { test, expect } from 'bun:test';
import { createHarness, KEY, DEMO_URL } from '../world/onboarding-experiment/core.js';
function fixture(random = () => .1) {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  return { data, storage, harness: createHarness({ storage, random, now: () => 100 }) };
}
test('no pre-consent assignment; exposure precedes choice/start and is deduplicated across reloads', () => {
  const { data, storage, harness } = fixture(() => .8);
  expect(harness.read()).toBeNull(); harness.record('exposure'); expect(data.size).toBe(0);
  expect(harness.consent().variant).toBe('policy'); harness.record('exposure');
  const reload = createHarness({ storage, random: () => { throw Error('must not reassign'); } });
  expect(reload.read().variant).toBe('policy'); reload.record('exposure'); reload.record('choice','budget'); reload.record('start');
  expect(JSON.parse(data.get(KEY)).events.map(e=>e.type)).toEqual(['exposure','choice','start']);
  reload.withdraw(); expect(data.size).toBe(0); reload.record('start'); expect(data.size).toBe(0);
});
test('balanced allocation boundary, disable and invalid storage recovery', () => {
  for (const [draw,variant] of [[0,'direct'],[.49999,'direct'],[.5,'policy'],[.99999,'policy']]) expect(fixture(()=>draw).harness.consent().variant).toBe(variant);
  const { storage, harness, data } = fixture(); harness.consent();
  const off = createHarness({ storage, enabled:false }); expect(off.read()).toBeNull(); expect(off.consent()).toBeNull(); expect(data.size).toBe(0);
  storage.setItem(KEY,'broken'); expect(harness.read()).toBeNull(); expect(harness.consent().variant).toBe('direct');
  expect(DEMO_URL).toBe('/world/future-machine.html?demo=1');
});
test('both variants preserve matched model states and provenance', async () => {
  const { initialForRecipe } = await import('../world/future-machine/data/index.js');
  const { DEFAULT_RECIPE } = await import('../world/future-machine/contracts.js');
  const { createEngine, addIntervention } = await import('../world/city/engine.js');
  const results = [.1,.9].map(draw => {
    const { harness } = fixture(()=>draw); harness.consent(); harness.record('exposure');
    const initial = initialForRecipe(DEFAULT_RECIPE);
    let state = addIntervention(initial, DEFAULT_RECIPE.intervention);
    const engine = createEngine();
    for (let month=0; month<120; month++) state = engine.step(state).state;
    return { initial, state, recipe: DEFAULT_RECIPE };
  });
  expect(results[0]).toEqual(results[1]);
});
test('storage denial is surfaced for browser fallback and cleared storage removes stale consent', () => {
  const { harness, storage } = fixture(); harness.consent(); storage.removeItem(KEY);
  expect(harness.read()).toBeNull();
  const denied = createHarness({ storage: { getItem(){ throw Error('denied'); }, removeItem(){ throw Error('denied'); } } });
  expect(()=>denied.read()).toThrow('denied');
});
