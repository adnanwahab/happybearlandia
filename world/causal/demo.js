import { canonicalId } from '../../shared/causality/index.js';

export const demoRunId = canonicalId('run', 'hbl', 'world-only-2911');
export const demoLastMonth = 20;

export function demoCheckpointId(runId, month) {
  return canonicalId('checkpoint', 'world-city', `${runId}/${month}`);
}

export function cityEntityId(worldId, kind, localId) {
  return canonicalId(kind, 'world-city', `${worldId}/${localId}`);
}
