const active = new Set(['queued', 'starting', 'running', 'retrying']);
const labels = {
  queued: 'Queued · waiting for another simulation to finish.',
  starting: 'Starting · preparing the simulation town.',
  running: 'Running · simulating futures.',
  completed: 'Completed · recorded results are ready.',
  failed: 'Failed · the simulation could not finish.',
  canceled: 'Canceled · no completed result was published.',
  retrying: 'Retrying · waiting to restart the same inputs.',
};

// Only backend snapshots choose a lifecycle state. Transport failures are separate.
export function showRunLifecycle(job, { status, run, cancel, retry, progress }) {
  const state = job.lifecycle || ({ done: 'completed', error: 'failed' })[job.status] || job.status;
  const known = Object.hasOwn(labels, state);
  status.textContent = known ? labels[state] : 'Run status unavailable.';
  if (state === 'running') status.textContent += ` ${job.progress?.step || 0}/${job.progress?.totalSteps || '?'} world-years`;
  if (state === 'failed' && job.error) status.textContent += ` ${job.error}`;
  status.dataset.state = known ? state : 'unknown';
  run.disabled = active.has(state) || !known;
  cancel.hidden = !active.has(state);
  retry.hidden = !['failed', 'canceled'].includes(state);
  progress.hidden = !active.has(state);
  return !active.has(state) && known;
}
