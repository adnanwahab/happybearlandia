import { createRunReceipt, validateRunReceipt, canonicalReceiptJSON } from './run-receipt.js';
import { createShareURL, parseShareURL, encodeRecipe } from './index.js';

export const QUESTIONS = Object.freeze([
  'What housing policy changes the number of homes in this future?',
  'What policy changes modeled rent in this future?',
  'What policy changes the capital cost of this future?'
]);
export const MAX_CHALLENGE_LENGTH = 120000;
function questionText(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error('Challenge question must contain 1–200 characters.');
  return value.trim();
}
export async function createChallengeURL(history, {question, month}, baseURL) {
  const receipt = await createRunReceipt(history, {month});
  if (!receipt.evidence.experimentId) throw new Error('Challenge requires a saved experiment.');
  const url = new URL(createShareURL({recipe:history.recipe, experimentId:history.experimentId, month}, baseURL));
  url.hash = 'challenge=' + encodeURIComponent(JSON.stringify({version:'future-question.v1',question:questionText(question),receipt}));
  if (url.hash.length > MAX_CHALLENGE_LENGTH) throw new Error('Challenge receipt is too large for a link.');
  return url.href;
}
export async function parseChallengeURL(input) {
  const url = new URL(input);
  if (!url.hash.startsWith('#challenge=')) return null;
  if (url.hash.length > MAX_CHALLENGE_LENGTH) throw new Error('Challenge receipt is too large for a link.');
  let data;
  try { data = JSON.parse(decodeURIComponent(url.hash.slice(11))); }
  catch { throw new Error('Malformed challenge link.'); }
  if (!data || Object.keys(data).sort().join(',') !== 'question,receipt,version' || data.version !== 'future-question.v1') throw new Error('Unsupported challenge version or fields.');
  const question = questionText(data.question);
  const receipt = await validateRunReceipt(data.receipt);
  const context = parseShareURL(url.href), e = receipt.evidence;
  if (!context || !e.experimentId || context.experimentId !== e.experimentId || context.month !== e.month || encodeRecipe(context.recipe) !== encodeRecipe(e.recipe)) throw new Error('Challenge context does not match receipt.');
  return {question, receipt, ...context};
}
export async function verifyChallengeHistory(history, challenge) {
  const actual = await createRunReceipt(history, {month:challenge.month});
  if (canonicalReceiptJSON(actual) !== canonicalReceiptJSON(challenge.receipt)) throw new Error('Challenge replay does not match receipt evidence or outcome digests.');
}
