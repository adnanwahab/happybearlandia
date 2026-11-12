import { replayRunReceipt } from './run-receipt.js';

export const MAX_RECEIPT_BYTES = 4_500_000;
export function parseReceiptText(text) {
  if (typeof text !== 'string') throw new Error('Paste a receipt or choose a JSON file.');
  if (text.length > MAX_RECEIPT_BYTES || new TextEncoder().encode(text).byteLength > MAX_RECEIPT_BYTES)
    throw new Error('Receipt exceeds the 4.5 MB import limit.');
  if (!text.trim()) throw new Error('Paste a receipt or choose a JSON file.');
  try { return JSON.parse(text); }
  catch { throw new Error('Receipt is not valid JSON. Choose a canonical run receipt export.'); }
}
export async function readReceiptFile(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error('Choose a JSON receipt file.');
  if (file.size > MAX_RECEIPT_BYTES) throw new Error('Receipt exceeds the 4.5 MB import limit.');
  return file.text();
}
export async function importReceiptText(text, options = {}) {
  // No network/replay work occurs before the input byte bound and JSON parse.
  const input = parseReceiptText(text);
  try { return await replayRunReceipt(input, options); }
  catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error(`Receipt could not be verified: ${error?.message || 'Invalid or unavailable saved run.'}`);
  }
}
