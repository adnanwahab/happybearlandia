#!/usr/bin/env bun
// Import two actual, recorded simulation artifacts into the private vote DB.
// This never runs an arbitrary player suggestion or publishes code.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPatchVotingStore } from './api.js';
import { validatePatchImpact } from './impact.js';
import { approvedPatchCandidates } from './candidates.js';

function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
export function verifyRunArtifact(bytes, run, evidence) {
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== run.evidenceSha256) throw new Error('Recorded run SHA-256 does not match the provided artifact.');
  let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('Recorded run artifact is not valid JSON.'); }
  if (parsed.schemaVersion !== 'hbl.sim-run.v1' ||
      parsed.seed !== evidence.seed || parsed.scenarioId !== evidence.scenarioId ||
      parsed.startingStateId !== evidence.startingStateId ||
      parsed.runId !== run.runId || parsed.modelVersion !== run.modelVersion ||
      parsed.rulesVersion !== run.rulesVersion ||
      !equal(parsed.metrics, run.metrics)) {
    throw new Error('Recorded run artifact does not match the claimed model, seed, state, or metrics.');
  }
}
export async function importPatchImpact({candidateId, evidencePath, beforePath, afterPath, dbPath} = {}) {
  if (!approvedPatchCandidates.some(x => x.id === candidateId)) throw new Error('Only curated patch IDs may receive impact evidence.');
  if (!evidencePath || !beforePath || !afterPath) throw new Error('Supply impact.json, before.json and after.json.');
  const readSmall = async path => {
    const bytes = await readFile(path);
    if (bytes.length > 100000) throw new Error('Evidence artifact is too large.');
    return bytes;
  };
  const evidence = validatePatchImpact(JSON.parse((await readSmall(evidencePath)).toString('utf8')), candidateId);
  verifyRunArtifact(await readSmall(beforePath), evidence.before, evidence);
  verifyRunArtifact(await readSmall(afterPath), evidence.after, evidence);
  const store = createPatchVotingStore({ ...(dbPath ? { dbPath } : {}) });
  try { store.setImpact(candidateId, evidence); }
  finally { store.close(); }
  return { candidateId, metrics: evidence.metrics.length, seed: evidence.seed, recordedAt: evidence.recordedAt };
}
if (import.meta.main) {
  const [candidateId, evidencePath, beforePath, afterPath] = process.argv.slice(2);
  try { console.log(JSON.stringify(await importPatchImpact({ candidateId, evidencePath, beforePath, afterPath }))); }
  catch (e) { console.error('Patch impact import failed:', e.message); process.exitCode = 1; }
}
