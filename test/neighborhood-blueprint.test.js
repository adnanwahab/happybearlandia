import { test, expect } from 'bun:test';
import { createBlueprint, encodeBlueprint, decodeBlueprint, previewImport, confirmImport, blueprintPlan } from '../world/invention/blueprint/model.js';
import { runPlan } from '../world/invention/model.js';

const design = () => createBlueprint({ seed: 2911, policies: ['transit-d1-8', 'upzone-d2-12'] }, [{ parcelId: 'parcel-d1', palette: 'brick' }]);
test('export/import retains source, units, bounded edits, cosmetics and deterministic City replay', () => {
  const original = design();
  const text = encodeBlueprint(original);
  expect(decodeBlueprint(text)).toEqual(original);
  expect(original.source).toEqual({ seed: 2911, months: 12, startMonth: 2, kind: 'synthetic' });
  expect(original.units.currency).toBe('USD');
  const before = createBlueprint();
  const snapshot = structuredClone(before);
  const preview = previewImport(text, before);
  expect(preview.duplicate).toBe(false);
  expect(before).toEqual(snapshot);
  const accepted = confirmImport(text);
  expect(confirmImport(encodeBlueprint(accepted))).toEqual(accepted);
  expect(previewImport(text, accepted).duplicate).toBe(true);
  const run = runPlan(blueprintPlan(accepted), { retainMonths: true });
  expect(run).toEqual(runPlan({ seed: 2911, policies: ['transit-d1-8', 'upzone-d2-12'] }, { retainMonths: true }));
  expect(run.final.meanCommuteMinutes).toBeLessThan(runPlan({ seed: 2911 }).final.meanCommuteMinutes);
  const cosmeticOnly = createBlueprint(blueprintPlan(accepted), [{ parcelId: 'parcel-d0', palette: 'pastel' }]);
  expect(runPlan(blueprintPlan(cosmeticOnly), { retainMonths: true })).toEqual(run);
});

test('reject incompatible and malformed payloads atomically, with no silent dropping or coercion', () => {
  const changes = [
    b => b.version = 'next', b => b.modelVersion = 'next', b => b.scenarioVersion = 'next',
    b => b.source.startMonth = 3, b => b.source.kind = 'observed', b => delete b.source.seed,
    b => b.source.months = 37, b => b.source.seed = '2911', b => b.units.currency = 'EUR',
    b => b.edits[0].parcelId = 'real-parcel', b => b.edits[0].parcelId = 'parcel-d0',
    b => b.edits[0].policyId = 'road-d1-8', b => b.edits.push(b.edits[0]),
    b => b.edits = Array(10).fill(b.edits[0]), b => b.cosmetics[0].palette = '<script>',
    b => b.cosmetics.push(b.cosmetics[0]), b => b.cosmetics[0].parcelId = 'unknown',
    b => b.extra = true, b => b.edits[0].amount = 999,
  ];
  const current = createBlueprint(); const snapshot = structuredClone(current);
  for (const change of changes) {
    const invalid = design(); change(invalid); const text = JSON.stringify(invalid);
    expect(() => previewImport(text, current)).toThrow();
    expect(() => confirmImport(text)).toThrow(); expect(current).toEqual(snapshot);
  }
  for (const text of ['null', '[]', '{', '"hi"', ' '.repeat(8193), 'é'.repeat(4097)]) expect(() => decodeBlueprint(text)).toThrow();
});

test('canonical export ignores edit order and enforces boundary settings', () => {
  const b = design(); b.edits.reverse();
  expect(encodeBlueprint(b)).toBe(encodeBlueprint(design()));
  expect(decodeBlueprint(encodeBlueprint(createBlueprint({ seed: 0, months: 1 })))).toEqual(createBlueprint({ seed: 0, months: 1 }));
  expect(decodeBlueprint(encodeBlueprint(createBlueprint({ seed: 4294967295, months: 36 })))).toEqual(createBlueprint({ seed: 4294967295, months: 36 }));
});

test('supported parcel identities match the source fixture and maximum compatible design stays bounded', async () => {
  const { createQuestScenario } = await import('../world/living-city/quests.js');
  const { PARCELS } = await import('../world/invention/blueprint/model.js');
  const { POLICY_CATALOG } = await import('../world/invention/model.js');
  for (const seed of [0, 2911, 4294967295]) {
    const state = createQuestScenario({ seed }).state;
    expect(state.month).toBe(2);
    expect(state.parcels.map(row => row.id)).toEqual(PARCELS);
    for (const row of state.parcels) expect(row.id).toBe(`parcel-${row.districtId}`);
  }
  const seen = new Set();
  const policies = POLICY_CATALOG.filter(row => {
    const scope = `${row.districtId}/${row.type}`;
    if (seen.has(scope)) return false;
    seen.add(scope); return true;
  }).map(row => row.id);
  const maximum = createBlueprint({ policies }, PARCELS.map(parcelId => ({ parcelId, palette: 'natural' })));
  expect(maximum.edits).toHaveLength(9);
  expect(new TextEncoder().encode(encodeBlueprint(maximum)).length).toBeLessThan(8192);
  expect(decodeBlueprint(encodeBlueprint(maximum))).toEqual(maximum);
});
