import { MONTHS, assertMonth } from './contracts.js';

/** Persisted City comparisons require complete, ordered, identified snapshots.
 * Pure diff helpers may still describe explicitly missing, unpersisted data. */
export function assertHistoryIntegrity(history) {
  if (typeof history?.experimentId !== 'string' || !history.experimentId) throw new Error('Missing comparison experiment identity');
  for (const arm of ['baseline','plan']) {
    const snapshots = history[arm];
    if (!Array.isArray(snapshots) || snapshots.length !== MONTHS + 1) throw new Error('Missing comparison frames');
    for (let month = 0; month <= MONTHS; month++) {
      const snapshot = snapshots[month], identity = snapshot?.identity;
      if (!snapshot || snapshot.month !== month || snapshot.state?.month !== month) throw new Error('Missing or non-monotonic comparison month');
      if (snapshot.state.seed !== history.seed || snapshot.state.version !== history.modelVersion) throw new Error('Comparison seed/model mismatch');
      if (!identity || identity.experimentId !== history.experimentId || identity.scenarioId !== arm || identity.runIndex !== 0 || identity.runId !== `${arm}-0`) throw new Error('Comparison run identity mismatch');
    }
  }
  return history;
}

export function assertFrameIntegrity(frame, history) {
  assertMonth(frame?.month);
  for (const arm of ['baseline','plan']) {
    const snapshot = frame[arm];
    if (snapshot && (snapshot.month !== frame.month || snapshot.state?.month !== frame.month)) throw new Error('Snapshot month does not match frame');
  }
  if (history) {
    for (const arm of ['baseline','plan']) {
      const snapshot = frame[arm];
      if (!snapshot || snapshot.identity?.experimentId !== history.experimentId || snapshot.state?.seed !== history.seed || snapshot.state?.version !== history.modelVersion) throw new Error('Frame does not match renderer history');
    }
  }
  const a = frame.baseline, b = frame.plan;
  if (!a || !b) return;
  if (a.state.seed !== b.state.seed || a.state.version !== b.state.version) throw new Error('Comparison seed/model mismatch');
  if (a.identity || b.identity) {
    for (const [arm, snapshot] of [['baseline',a],['plan',b]]) {
      const identity = snapshot.identity;
      if (!identity || !identity.experimentId || identity.experimentId !== a.identity?.experimentId || identity.scenarioId !== arm || identity.runIndex !== 0 || identity.runId !== `${arm}-0`) throw new Error('Comparison run identity mismatch');
    }
  }
}
