import { makeReceiptRecipe, readReceiptRecipe, recipeVersion } from '../laboratory/receipts/receipt.js';
export const key = 'hbl.provenance-museum.v1';
export function exhibit(receipt, index) {
  if (`${receipt.scenarioVersion}+${receipt.modelVersion}` !== recipeVersion) throw new Error('Receipt version unavailable');
  const recipe = makeReceiptRecipe({ seed: receipt.seed, amount: receipt.policy.amount, index });
  readReceiptRecipe(recipe);
  if (!receipt.pairs.some(pair => pair.index === index)) throw new Error('Selected pair unavailable');
  return { version: 1, recipe, receipt: JSON.parse(JSON.stringify(receipt)) };
}
export function readExhibits(storage) {
  const rows = JSON.parse(storage.getItem(key) || '[]');
  if (!Array.isArray(rows) || rows.length > 20) throw new Error('Museum data unavailable');
  return rows.map(row => {
    try {
      if (row.version !== 1) throw new Error();
      const recipe = readReceiptRecipe(row.recipe);
      const rebuilt = exhibit(row.receipt, recipe.index);
      if (rebuilt.recipe !== row.recipe) throw new Error();
      return rebuilt;
    } catch { return { unavailable: true }; }
  });
}
export function saveExhibit(storage, receipt, index) {
  const next = exhibit(receipt, index);
  const rows = readExhibits(storage).filter(row => !row.unavailable && row.recipe !== next.recipe);
  storage.setItem(key, JSON.stringify([...rows, next].slice(-20)));
}
