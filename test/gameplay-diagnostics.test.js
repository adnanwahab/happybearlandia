import { describe, expect, test } from 'bun:test';
import { SCHEMA_VERSION, validateDiagnostic } from '../world/gameplay-diagnostics/contract.js';
import { createDiagnosticCollector } from '../world/gameplay-diagnostics/collector.js';
import { exportDiagnosticFixture, importDiagnosticFixture } from '../world/gameplay-diagnostics/fixture.js';
import { runPlayer } from '../tools/player-lab/lab.js';
import { decodeBakeryRecipe, encodeBakeryRecipe } from '../world/journeys/bakery-scenario.js';
const event = (changes = {}) => ({
  schemaVersion: SCHEMA_VERSION, route: '/world/journeys/bakery.html', surface: 'bakery',
  symptom: 'scripted-step-failed', source: 'synthetic-scripted', renderer: 'dom',
  build: null, modelVersion: 'bakery-v1', rulesVersion: null, dataVersion: null,
  elapsedBucket: 'unavailable', status: 'failed', replay: {
    modelVersion: 'bakery-v1', rulesVersion: null, dataVersion: null, seed: 2911,
    recipe: { version: 'bakery-v1', seed: 2911, reopenMonth: 72 },
  }, ...changes,
});
const enabled = capacity => { const c = createDiagnosticCollector({ capacity }); c.optIn(); return c; };

describe('consented local gameplay diagnostics', () => {
  test('default opt-out never reads the input; opt-in and revoke/clear reset everything', () => {
    const c = createDiagnosticCollector();
    const trap = new Proxy({}, { ownKeys() { throw new Error('must not inspect'); } });
    expect(c.capture(trap).code).toBe('CONSENT_REQUIRED');
    expect(c.snapshot()).toEqual([]);
    expect(exportDiagnosticFixture(c).code).toBe('CONSENT_REQUIRED');
    expect(importDiagnosticFixture('invalid', c).code).toBe('CONSENT_REQUIRED');
    for (const stop of ['clear', 'withdraw']) {
      c.optIn(); expect(c.capture(event()).ok).toBe(true);
      c[stop](); expect(c.consented).toBe(false); expect(c.size).toBe(0);
      expect(c.capture(event()).ok).toBe(false);
      c.optIn(); expect(c.capture(event()).duplicate).toBe(false); c.withdraw();
    }
  });
  test('fixed ring retains newest unique events and dedup state is bounded to retained events', () => {
    const c = enabled(2);
    const a = event(), b = event({ status: 'recovered' }), d = event({ status: 'unavailable' });
    c.capture(a); c.capture(b); c.capture(d);
    expect(c.size).toBe(2); expect(c.snapshot()).toEqual([b, d]);
    expect(c.capture(b)).toEqual({ ok: true, duplicate: true });
    expect(c.capture(a).duplicate).toBe(false);
    expect(c.snapshot()).toEqual([d, a]);
    for (const capacity of [0, -1, 129, 1.5, Infinity, NaN])
      expect(() => createDiagnosticCollector({ capacity })).toThrow();
  });
  test('copies input/output and normalizes property order for deterministic duplicates', () => {
    const c = enabled(2), a = event();
    c.capture(a);
    const reordered = Object.fromEntries(Object.entries(event()).reverse());
    reordered.replay = Object.fromEntries(Object.entries(reordered.replay).reverse());
    expect(c.capture(reordered).duplicate).toBe(true);
    a.replay.recipe.reopenMonth = 80;
    c.snapshot()[0].replay.recipe.reopenMonth = 100;
    expect(c.snapshot()[0]).toEqual(event());
    expect(exportDiagnosticFixture(c)).toEqual(exportDiagnosticFixture(c));
  });
  test('strict fields reject arbitrary content, unsafe/overlarge strings and missing versions', () => {
    for (const key of ['console', 'url', 'chat', 'journal', 'accountId', 'secret', 'stack'])
      expect(validateDiagnostic({ ...event(), [key]: 'private' }).ok).toBe(false);
    for (const key of ['schemaVersion', 'route', 'surface', 'symptom', 'source', 'renderer',
      'build', 'modelVersion', 'rulesVersion', 'dataVersion', 'elapsedBucket', 'status']) {
      expect(validateDiagnostic(event({ [key]: 'https://private.example/' + 'x'.repeat(2000) })).ok).toBe(false);
      const missing = event(); delete missing[key];
      expect(validateDiagnostic(missing).ok).toBe(false);
    }
    expect(validateDiagnostic(event({ replay: { ...event().replay, stack: 'secret' } })).ok).toBe(false);
    expect(validateDiagnostic(event({ replay: { ...event().replay, recipe: 'bakery-v1.2911.72' } })).ok).toBe(false);
    expect(validateDiagnostic(event({ source: 'observed-error' })).ok).toBe(false);
    expect(validateDiagnostic(event({ route: '/world' })).ok).toBe(false);
    expect(validateDiagnostic(event({ build: 'a'.repeat(40) })).ok).toBe(true);
  });
  test('does not invoke getters or serializers; rejects nonplain, symbolic and throwing input', () => {
    let calls = 0;
    const a = event(); Object.defineProperty(a, 'build', { enumerable: true, get() { calls++; return null; } });
    expect(validateDiagnostic(a).ok).toBe(false);
    expect(validateDiagnostic({ ...event(), toJSON() { calls++; } }).ok).toBe(false);
    expect(validateDiagnostic({ ...event(), [Symbol('secret')]: 'secret' }).ok).toBe(false);
    expect(validateDiagnostic(new Date()).ok).toBe(false);
    expect(validateDiagnostic(new Proxy({}, { getPrototypeOf() { throw new Error(); } })).ok).toBe(false);
    expect(calls).toBe(0);
  });
  test('replay seed/model/data/rules mismatch fails, unavailable evidence stays null', () => {
    for (const patch of [{ seed: 2912 }, { seed: -1 }, { seed: 2 ** 32 },
      { modelVersion: 'city-systems.1.1.0' }, { dataVersion: 'future-machine.v1' },
      { rulesVersion: 'invented' }, { modelVersion: null },
      { recipe: { ...event().replay.recipe, seed: 1 } },
      { recipe: { ...event().replay.recipe, reopenMonth: 71 } }])
      expect(validateDiagnostic(event({ replay: { ...event().replay, ...patch } })).ok).toBe(false);
    const unknown = event({ modelVersion: null, replay: null, renderer: null,
      symptom: 'render-unavailable', source: 'observed-error' });
    const c = enabled(1); expect(c.capture(unknown).ok).toBe(true);
    expect(c.snapshot()[0]).toEqual(unknown);
    expect(validateDiagnostic(event({ replay: { ...event().replay, recipe: null } })).ok).toBe(true);
  });
  test('fixture validation is bounded and atomic, repeats deterministically deduplicate', () => {
    const c = enabled(2); c.capture(event());
    const json = exportDiagnosticFixture(c).json, target = enabled(2);
    expect(importDiagnosticFixture(json, target)).toEqual({ ok: true, accepted: 1, duplicates: 0 });
    expect(importDiagnosticFixture(json, target)).toEqual({ ok: true, accepted: 0, duplicates: 1 });
    expect(exportDiagnosticFixture(target).json).toBe(json);
    for (const invalid of ['bad', 'x'.repeat(132000), JSON.stringify({
      schemaVersion: 'hbl.gameplay-diagnostic-fixture.v1', events: Array(129).fill(event()),
    }), JSON.stringify({ schemaVersion: 'hbl.gameplay-diagnostic-fixture.v1',
      events: [event({ status: 'recovered' }), { ...event(), stack: 'secret' }] }),
      json.replace('fixture.v1', 'fixture.v999')]) {
      expect(importDiagnosticFixture(invalid, target).code).toBe('INVALID_FIXTURE');
      expect(target.snapshot()).toEqual([event()]);
    }
  });
  test('actual scripted-player failure projects only permitted evidence and roundtrips real recipe', async () => {
    const page = { on() {}, off() {}, async goto() { throw new Error('private URL and stack must stay out'); },
      async evaluate() { throw new Error('no observation'); } };
    const run = await runPlayer(page, { seed: 2911, strategy: 'first-play' }, 'local-fixture-revision');
    expect(run.status).toBe('failed'); expect(run.finalState).toBe(null);
    const recipe = decodeBakeryRecipe(encodeBakeryRecipe({ version: run.scenario.model,
      seed: run.scenario.modelSeed, reopenMonth: run.scenario.month }));
    const diagnostic = event(); diagnostic.replay.recipe = recipe;
    const c = enabled(2); c.capture(diagnostic);
    const output = exportDiagnosticFixture(c).json;
    expect(output).not.toContain('private'); expect(output).not.toContain('local-fixture-revision');
    const target = enabled(2); expect(importDiagnosticFixture(output, target).ok).toBe(true);
    expect(target.snapshot()[0].source).toBe('synthetic-scripted');
    expect(target.snapshot()[0].replay.recipe).toEqual(recipe);
  });
  test('capture/export/import/withdraw never access network, storage or beacon APIs', () => {
    const names = ['fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator'];
    const originals = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    let accesses = 0;
    try {
      for (const name of names) Object.defineProperty(globalThis, name, {
        configurable: true, get() { accesses++; throw new Error('forbidden I/O'); },
      });
      const c = enabled(2); c.capture(event());
      const json = exportDiagnosticFixture(c).json;
      importDiagnosticFixture(json, c); c.withdraw(); c.capture(event());
      expect(accesses).toBe(0);
    } finally {
      names.forEach((name, i) => { if (originals[i]) Object.defineProperty(globalThis, name, originals[i]); else delete globalThis[name]; });
    }
  });
});
