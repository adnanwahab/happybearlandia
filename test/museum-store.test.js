import { expect, test } from 'bun:test';
import { runCommuteEnsemble } from '../world/living-city/quests.js';
import { makePolicyReceipt, readReceiptRecipe } from '../world/laboratory/receipts/receipt.js';
import { exhibit, key, readExhibits, saveExhibit } from '../world/museum/store.js';
const fixture = () => makePolicyReceipt(runCommuteEnsemble({ seed: 7, amount: 4 }));
function memory() { const rows = new Map(); return { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v), removeItem: k => rows.delete(k) }; }
test('deterministic representative receipt retains immutable inputs and exact selected pair', () => {
 const original = fixture(), saved = exhibit(original, 3);
 expect(saved).toEqual(exhibit(fixture(), 3));
 expect(readReceiptRecipe(saved.recipe)).toMatchObject({ seed: 7, amount: 4, index: 3 });
 original.policy.amount = 8;
 expect(saved.receipt.policy.amount).toBe(4);
});
test('opt in, deduplication, deletion, stale and damaged data', () => {
 const receipt = fixture();
 const storage = memory(); expect(readExhibits(storage)).toEqual([]);
 saveExhibit(storage, receipt, 3); saveExhibit(storage, receipt, 3);
 expect(readExhibits(storage)).toHaveLength(1);
 storage.removeItem(key); expect(readExhibits(storage)).toEqual([]);
 storage.setItem(key, '[{"version":99}]'); expect(readExhibits(storage)).toEqual([{ unavailable: true }]);
 storage.setItem(key, '{}'); expect(() => readExhibits(storage)).toThrow();
 expect(() => exhibit({ ...receipt, modelVersion: 'old' }, 0)).toThrow();
 expect(() => exhibit(receipt, 100)).toThrow();
});
