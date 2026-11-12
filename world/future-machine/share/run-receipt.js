import { createEvidenceReport, validateRecipe } from './index.js';
import { loadExperiment, initialForRecipe, validateRecipe as validateDataRecipe } from '../data/index.js';
import { freeze, stateHash } from '../data/core.js';
import { MODEL_VERSION, METRIC_UNITS, calendarLabel } from '../contracts.js';
import { createEngine } from '../../city/engine.js';

export const RECEIPT_VERSION = 'canonical-run-receipt.v1';
const fail = message => { throw new Error(`Run receipt: ${message}`); };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = async (a, b) => await stateHash(a) === await stateHash(b);
function keys(value, expected) {
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) fail('missing or unsupported fields');
}
/** Sorted keys, JSON-only values. The checksum uses the same canonical stateHash. */
export function canonicalReceiptJSON(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, canonicalReceiptJSON).join(',') + ']';
  if (value && Object.getPrototypeOf(value) === Object.prototype)
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalReceiptJSON(value[key])).join(',') + '}';
  fail('requires finite JSON data');
}
async function outcomes(history, month) {
  return Object.fromEntries(await Promise.all(['baseline', 'plan'].map(async arm => [arm, {
    selected: await stateHash(history[arm][month]), terminal: await stateHash(history[arm][120])
  }])));
}
export async function createRunReceipt(history, { month = 120 } = {}) {
  const evidence = createEvidenceReport(history, { month });
  validateDataRecipe(validateRecipe(evidence.recipe));
  const body = {
    schemaVersion: RECEIPT_VERSION, evidence,
    rulesRevision: structuredClone(history.provenance?.modelManifest ?? null),
    scenarioIds: { baseline: 'baseline', plan: 'plan' },
    timeRange: { firstMonth: 0, lastMonth: 120, firstDate: calendarLabel(0), lastDate: calendarLabel(120) },
    units: { ...METRIC_UNITS }, outcomeDigests: await outcomes(history, month)
  };
  const receipt = { ...body, checksum: await stateHash(body) };
  return validateRunReceipt(receipt);
}
/** Validate all cheap bounds and identity before allowing any replay request. */
export async function validateRunReceipt(input) {
  let text;
  try { text = canonicalReceiptJSON(input); } catch { fail('requires finite JSON data'); }
  if (text.length > 4_500_000) fail('exceeds export limit');
  const receipt = JSON.parse(text);
  keys(receipt, ['schemaVersion','evidence','rulesRevision','scenarioIds','timeRange','units','outcomeDigests','checksum']);
  if (receipt.schemaVersion !== RECEIPT_VERSION) fail('unsupported schema version');
  const e = receipt.evidence;
  keys(e, ['schemaVersion','authority','recipe','experimentId','initialHash','modelVersion','seed','month','horizon','provenance','evidenceKind','observations','modeledComparison','narrativeInterpretation','limitations']);
  const recipe = validateDataRecipe(validateRecipe(e.recipe));
  if (e.modelVersion !== MODEL_VERSION || e.seed !== recipe.seed) fail('unsupported model version or seed mismatch');
  if (!Number.isInteger(e.month) || e.month < 0 || e.month > 120) fail('invalid selected month');
  if (e.experimentId !== null && (typeof e.experimentId !== 'string' || !/^city_[\w-]{1,96}$/.test(e.experimentId))) fail('invalid experiment identity');
  if (!digest(e.initialHash) || !digest(receipt.checksum)) fail('missing digest');
  if (!await same(receipt.rulesRevision, createEngine().manifest) || !await same(e.provenance?.modelManifest, receipt.rulesRevision)) fail('unsupported rules revision');
  if (!await same(receipt.scenarioIds, {baseline:'baseline',plan:'plan'}) ||
      !await same(receipt.timeRange, {firstMonth:0,lastMonth:120,firstDate:calendarLabel(0),lastDate:calendarLabel(120)}) ||
      !await same(receipt.units, METRIC_UNITS)) fail('invalid scenarios, time range or units');
  keys(receipt.outcomeDigests, ['baseline','plan']);
  keys(e.observations, ['baseline','plan']);
  for (const arm of ['baseline','plan']) {
    keys(receipt.outcomeDigests[arm], ['selected','terminal']);
    if (!Object.values(receipt.outcomeDigests[arm]).every(digest)) fail('invalid outcome digest');
    keys(e.observations[arm], ['month','metrics','events','causalRecords','decisions']);
    if (e.observations[arm].month !== e.month) fail('observation month mismatch');
  }
  // Reuse the evidence contract to retain its version, assumptions and limits.
  const snapshots = arm => Array.from({length:121}, (_, month) => month === e.month ? e.observations[arm] : {month});
  const expected = createEvidenceReport({recipe,seed:e.seed,modelVersion:e.modelVersion,experimentId:e.experimentId,initialHash:e.initialHash,
    provenance:e.provenance,baseline:snapshots('baseline'),plan:snapshots('plan')}, {month:e.month});
  if (!await same(e, expected)) fail('invalid evidence contract');
  const {checksum, ...body} = receipt;
  if (checksum !== await stateHash(body)) fail('checksum mismatch');
  if (e.initialHash !== await stateHash(initialForRecipe(recipe))) fail('initial-state digest mismatch');
  return freeze(receipt);
}
/** Saved identity is required here. Unsaved receipts can be exported but not reopened. */
export async function replayRunReceipt(input, options = {}) {
  const receipt = await validateRunReceipt(input);
  if (receipt.evidence.experimentId === null) fail('unsaved receipt has no persisted experiment to replay');
  const history = await loadExperiment(receipt.evidence.experimentId, options);
  const regenerated = await createRunReceipt(history, {month:receipt.evidence.month});
  if (!await same(receipt, regenerated)) fail('saved replay does not match receipt evidence or outcome digests');
  return freeze({history, month:receipt.evidence.month, receipt});
}
