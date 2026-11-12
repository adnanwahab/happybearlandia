import { withRecoveryDeadline } from "./recovery-deadline.js";
/** Orchestrates existing scene/worker operations; owns no simulation or model mapping.
 * Hooks receive {runId, signal, reducedMotion, onProgress, markWorkerReady}.
 * Async hooks must check signal before mutating scene/UI after an await.
 * onProgress accepts worker observations only, never an estimated timer.
 */
function freezeResult(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeResult(child);
    Object.freeze(value);
  }
  return value;
}

export function createQuickDemoController({
  waitForReady = () => {}, observeResident = () => null, runComparison, revealComparison = () => {},
  onState = () => {}, reducedMotion = () => false,
  now = () => performance.now(), operationTimeoutMs = 120000,
} = {}) {
  if (typeof runComparison !== 'function') throw new TypeError('runComparison is required');
  let serial = 0, active = null, replayInputs, hasReplayInputs = false, disposed = false;
  let state = { status: 'idle', runId: null, progress: null, result: null, error: null, timings: {} };
  const snapshot = () => structuredClone(state);
  const current = run => active === run && !run.abort.signal.aborted && !disposed;
  function emit(run, patch) {
    if (!current(run)) return;
    state = { ...state, ...patch, timings: { ...run.timings } };
    onState(snapshot());
  }
  function mark(run, key) {
    if (current(run) && run.timings[key] == null) run.timings[key] = Math.max(0, now() - run.started);
  }
  // Abort settles the public run even if an injected worker ignores cancellation.
  function wait(run, operation) {
    return withRecoveryDeadline(() => operation, {
      signal: run.abort.signal, timeoutMs: operationTimeoutMs,
      message: 'Comparison timed out. Retry comparison or continue exploring the loaded city. No completed run was produced.',
    });
  }
  function stop(reason = 'stopped') {
    if (!active) return snapshot();
    const run = active;
    mark(run, 'totalMs');
    state = { ...state, status: 'stopped', reason, timings: { ...run.timings } };
    run.stoppedState = snapshot();
    active = null;
    run.abort.abort(reason);
    onState(snapshot());
    return snapshot();
  }
  async function start(inputs, { signal } = {}) {
    if (disposed) throw new Error('Quick demo controller is disposed');
    // Capture before cancelling so malformed inputs do not destroy a working run.
    const captured = structuredClone(inputs);
    stop('replaced');
    replayInputs = structuredClone(captured);
    hasReplayInputs = true;
    const run = { id: ++serial, abort: new AbortController(), started: now(), timings: { readinessMs: null, observationMs: null, workerStartupMs: null, computationMs: null, revealMs: null, totalMs: null } };
    active = run;
    state = { status: 'waiting', runId: run.id, progress: null, result: null, error: null, timings: {} };
    const externalAbort = () => { if (current(run)) stop('aborted'); };
    signal?.addEventListener('abort', externalAbort, { once: true });
    const context = {
      runId: run.id, signal: run.abort.signal, inputs: structuredClone(captured),
      reducedMotion: false,
      markWorkerReady() { mark(run, 'workerReadyMs'); emit(run, {}); },
      onProgress(progress) {
        if (!current(run)) return;
        // Unknown fractions stay unknown; zero is a genuine observation.
        const fraction = progress?.frac ?? progress?.fraction;
        for (const key of ['workerStartupMs', 'computationMs']) {
          if (Number.isFinite(progress?.[key]) && progress[key] >= 0) run.timings[key] = progress[key];
        }
        emit(run, { status: 'computing', progress: {
          stage: typeof progress?.stage === 'string' ? progress.stage : null,
          fraction: Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 ? fraction : null,
        } });
      },
    };
    try {
      context.reducedMotion = typeof reducedMotion === 'function' ? !!reducedMotion() : !!reducedMotion;
      if (signal?.aborted) { externalAbort(); return snapshot(); }
      emit(run, {});
      if (!current(run)) return snapshot();
      await wait(run, Promise.resolve().then(() => current(run) ? waitForReady(context) : undefined));
      if (!current(run)) return snapshot();
      mark(run, 'readinessMs');
      emit(run, { status: 'observing' });
      // Both start without caption delays or waiting for the worker.
      const resident = wait(run, Promise.resolve().then(() => {
        if (current(run)) return observeResident(context);
      })).then(observation => {
        mark(run, 'observationMs');
        if (observation != null) mark(run, 'residentFeedbackMs');
        emit(run, { observation: observation ?? null });
        return observation;
      });
      mark(run, 'workerStartMs');
      const comparison = wait(run, Promise.resolve().then(() => {
        if (current(run)) return runComparison(context);
      })).then(result => { mark(run, 'computationCompleteMs'); return freezeResult(structuredClone(result ?? null)); });
      emit(run, { status: 'computing' });
      const [observation, result] = await Promise.all([resident, comparison]);
      if (!current(run)) return snapshot();
      mark(run, 'revealStartMs');
      emit(run, { status: 'revealing', result: result ?? null });
      if (!current(run)) return snapshot();
      await wait(run, revealComparison(result ?? null, { ...context, observation }));
      if (!current(run)) return snapshot();
      mark(run, 'revealCompleteMs');
      mark(run, 'totalMs');
      if (run.timings.workerReadyMs != null) run.timings.workerStartupMs = run.timings.workerReadyMs - run.timings.workerStartMs;
      if (run.timings.workerReadyMs != null) run.timings.computationMs = run.timings.computationCompleteMs - run.timings.workerReadyMs;
      run.timings.revealMs = run.timings.revealCompleteMs - run.timings.revealStartMs;
      emit(run, { status: 'completed' });
      active = null;
      return snapshot();
    } catch (error) {
      if (!current(run)) return run.stoppedState ?? snapshot();
      mark(run, 'totalMs');
      emit(run, { status: 'error', error: String(error?.message || error) });
      active = null;
      run.abort.abort('error');
      return snapshot();
    } finally {
      signal?.removeEventListener('abort', externalAbort);
    }
  }
  return {
    start, stop, getState: snapshot,
    replay(options) {
      if (disposed) throw new Error('Quick demo controller is disposed');
      if (!hasReplayInputs) throw new Error('No demo inputs to replay');
      return start(structuredClone(replayInputs), options);
    },
    dispose() { if (disposed) return; stop('disposed'); disposed = true; },
  };
}
