import { createChallengeEnvelope, verifyChallenge } from '../challenges/contract.js';
import { VERSION } from '../city/contracts.js';

export const FORGE_VERSION = 'citizen-quest-forge.v1';
const keys = ['schemaVersion', 'id', 'revision', 'sourceKind', 'sourceRef', 'text', 'concern', 'districtId', 'modelVersion', 'checkpointHash'];
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };
const canonical = value => JSON.stringify(value, function (_, row) {
  return row && typeof row === 'object' && !Array.isArray(row)
    ? Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])) : row;
});
async function hash(value) {
  const bytes = new TextEncoder().encode(canonical(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
function validateRequest(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))) throw Error('A complete versioned origin request is required.');
  if (record.schemaVersion !== 'civic-quest-request.v1' || record.modelVersion !== VERSION) throw Error('Request/model version unavailable.');
  if (!['authored-demo', 'logged-request'].includes(record.sourceKind)) throw Error('Unknown request source kind.');
  for (const key of ['id', 'districtId']) if (typeof record[key] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(record[key])) throw Error('Invalid request identity.');
  if (!Number.isSafeInteger(record.revision) || record.revision < 1 || !/^[a-f0-9]{64}$/.test(record.checkpointHash)) throw Error('Request revision/checkpoint unavailable.');
  for (const key of ['text', 'sourceRef']) if (typeof record[key] !== 'string' || !record[key].trim() || record[key].length > 1000 || /[\x00-\x1f\x7f]/.test(record[key])) throw Error('Request citation and text must be bounded plain text.');
  if (record.concern !== 'housing-access') throw Error('No compatible model lever for this request.');
}

export async function forgeQuest(record, initialState) {
  // Take owned snapshots before any await: callers cannot change source/run mid-forge.
  const origin = structuredClone(record), initial = structuredClone(initialState);
  validateRequest(origin);
  if (!initial?.districts?.some(row => row.id === origin.districtId)) throw Error('Request district has no compatible City mapping.');
  // Authored template assumptions, not inferred cost estimates or resident preferences.
  const terms = { initialState: initial, months: 20, budget: 5000,
    actions: [{ id: 'housing', label: 'Build two synthetic homes', intervention: { type: 'housing', districtId: origin.districtId, amount: 2, cost: 1000 } }],
    metrics: ['unhousedHouseholds'], referenceSelection: [], title: 'Housing access request' };
  const challenge = await createChallengeEnvelope(terms);
  if (origin.checkpointHash !== challenge.initialHash) throw Error('Request checkpoint mismatch; no geographic or identity mapping inferred.');
  const body = { schemaVersion: FORGE_VERSION, origin, challenge,
    evidenceKind: 'synthetic-modeled',
    winCondition: 'At month 20, fewer unhoused synthetic households than the matched no-action control; retain population and employment, and keep both public capital ledgers within 5,000 synthetic USD.',
    limitations: 'Request text is source material, not a measured outcome or an endorsement. Template costs and wording are authored assumptions. Local hashes do not authenticate a resident or civic source. No real resident endorsement is inferred.' };
  return freeze({ ...body, digest: await hash(body) });
}

export async function verifyQuest(input, candidate, options = {}) {
  const quest = structuredClone(input);
  if (quest?.schemaVersion !== FORGE_VERSION) throw Error('Quest version unavailable.');
  const expected = await forgeQuest(quest.origin, quest.challenge?.initialState);
  if (canonical(quest) !== canonical(expected)) throw Error('Quest replay mismatch; no outcome claimed.');
  const result = await verifyChallenge(expected.challenge, candidate, options);
  return freeze({ schemaVersion: 'citizen-quest-result.v1', questDigest: expected.digest,
    origin: expected.origin, winCondition: expected.winCondition, result,
    interpretation: 'Synthetic modeled result under authored template assumptions. No real resident endorsement or player causality is inferred.' });
}

export async function forgeRequests(records, initialState) {
  if (!Array.isArray(records) || records.length > 32) throw Error('Provide at most 32 logged request records.');
  records = structuredClone(records);
  initialState = structuredClone(initialState);
  const quests = [], rejected = [], seen = new Set();
  for (const record of records) {
    const identity = `${record?.id}:${record?.revision}`;
    try {
      if (seen.has(identity)) throw Error('Duplicate origin request revision.');
      seen.add(identity);
      quests.push(await forgeQuest(record, initialState));
    } catch (error) { rejected.push({ id: record?.id ?? null, reason: error.message }); }
  }
  return { status: !records.length ? 'no-source-data' : quests.length ? 'available' : 'unsupported', quests, rejected };
}
