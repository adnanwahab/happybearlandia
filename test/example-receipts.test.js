import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkExamples, examplesDirectory } from '../scripts/example-receipts.js';
import { decodeRecipe, encodeRecipe } from '../world/future-machine/share/index.js';
import { validateRunReceipt } from '../world/future-machine/share/run-receipt.js';

const read = async name => (await validateRunReceipt(JSON.parse(await readFile(new URL(name + '.json', examplesDirectory), 'utf8')))).evidence;

test('checked-in receipts regenerate byte-for-byte with matching canonical SHA-256', async () => {
  await checkExamples();
});

test('examples retain synthetic provenance, supported recipes and real completion evidence', async () => {
  const housing = await read('housing-month-16');
  const control = await read('zero-control-month-120');
  for (const report of [housing, control]) {
    expect(decodeRecipe(encodeRecipe(report.recipe))).toEqual(report.recipe);
    expect(report.schemaVersion).toBe('future-machine-evidence.v1');
    expect(report.experimentId).toBeNull();
    expect(report.evidenceKind).toBe('manifest-recomputation');
    expect(report.provenance.datasetVersion).toBe('future-machine-synthetic.v1');
    expect(report.limitations.join(' ')).toContain('not empirical forecasts');
    expect(report.narrativeInterpretation).toBeNull();
  }
  expect(housing.observations.plan.metrics.housingUnits - housing.observations.baseline.metrics.housingUnits).toBe(24);
  expect(housing.observations.plan.events.some(event => event.eventType === 'PROJECT_COMPLETE')).toBe(true);
  expect(control.observations.plan).toEqual(control.observations.baseline);
  expect(() => encodeRecipe({ ...housing.recipe, modelVersion: 'unsupported' })).toThrow();
});

test('checked-in canonical receipt rejects edited observations and checksum', async () => {
  const receipt = JSON.parse(await readFile(new URL('housing-month-16.json', examplesDirectory), 'utf8'));
  const edited = structuredClone(receipt);
  edited.evidence.observations.plan.metrics.housingUnits++;
  await expect(validateRunReceipt(edited)).rejects.toThrow();
  receipt.checksum = '0'.repeat(64);
  await expect(validateRunReceipt(receipt)).rejects.toThrow('checksum');
});

test('historical receipts retain their bytes and remain rejected by the current model validator', async () => {
  const hashes = {
    'housing-month-16': 'db2eab83cf2f8123e26a825b1736f5d748a175d8be090d8f73a72a5b7a09c801',
    'zero-control-month-120': '66f15cb2d8a4f613b28671afc695f5c5e5f56abd2c5d18279bed02273797e46f',
    hashes: '42ae9ee7e603effde60fc949736d1128922d922661470b965ea83875a348317a',
  };
  for (const [name, hash] of Object.entries(hashes)) {
    const bytes = await readFile(new URL(`historical/city-systems.1.0.0/${name}.json`, examplesDirectory));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    if (name === 'hashes') continue;
    const receipt = JSON.parse(bytes);
    expect(receipt.evidence.modelVersion).toBe('city-systems.1.0.0');
    await expect(validateRunReceipt(receipt)).rejects.toThrow('model version');
  }
});
