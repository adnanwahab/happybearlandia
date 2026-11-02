/** Internal, local diagnostics. No telemetry leaves the browser.
 * Studio may import mountDiagnostics(container), then update its results object.
 * API failures can be supplied as results.apiErrors (array of messages).
 */
export function mountDiagnostics(container) {
  if (!container?.ownerDocument) throw new TypeError('Diagnostics require a DOM container');
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const root = doc.createElement('details');
  root.className = 'decision-diagnostics';
  const summary = doc.createElement('summary');
  summary.textContent = 'Internal diagnostics';
  const description = doc.createElement('p');
  description.textContent = 'Local session only. Browser errors are captured while this panel is mounted. No telemetry is sent.';
  const values = doc.createElement('dl');
  const errors = doc.createElement('pre');
  errors.style.whiteSpace = 'pre-wrap';
  errors.setAttribute('aria-label', 'Diagnostic errors');
  root.append(summary, description, values, errors);
  container.append(root);
  let results = {}, destroyed = false;
  const browserErrors = [];
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  function render() {
    if (destroyed) return;
    const experiment = results.experiment || {};
    const progress = experiment.progress || {};
    const runs = Array.isArray(results.runs) ? results.runs : [];
    const successful = progress.successful ?? runs.filter(run => run.status === 'completed').length;
    const failed = progress.failed ?? runs.filter(run => run.status === 'failed').length;
    const elapsed = finite(progress.elapsedMs);
    const durations = runs.map(run => Date.parse(run.completedAt) - Date.parse(run.startedAt)).filter(value => Number.isFinite(value) && value >= 0);
    const memory = win?.performance?.memory?.usedJSHeapSize;
    const entries = {
      'Experiment': experiment.id || 'No experiment',
      'Status': experiment.status || 'idle',
      'Model version': experiment.modelVersion || results.model?.version || 'unavailable',
      'Completed / total': `${progress.completed ?? runs.length} / ${progress.total ?? '—'}`,
      'Successful / failed': `${successful} / ${failed}`,
      'Elapsed seconds': (elapsed / 1000).toFixed(2),
      'Runs per second': elapsed > 0 ? ((finite(successful) + finite(failed)) * 1000 / elapsed).toFixed(1) : '—',
      'Mean stored run duration (ms)': durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : '—',
      'Browser heap (MiB)': Number.isFinite(memory) ? (memory / 1048576).toFixed(1) : 'unavailable in this browser',
      'Browser errors': browserErrors.length,
      'API errors supplied by client': Array.isArray(results.apiErrors) ? results.apiErrors.length : 0,
    };
    values.replaceChildren();
    for (const [key, value] of Object.entries(entries)) {
      const term = doc.createElement('dt'), detail = doc.createElement('dd');
      term.textContent = key;
      detail.textContent = String(value);
      values.append(term, detail);
    }
    errors.textContent = [...browserErrors, ...(Array.isArray(results.apiErrors) ? results.apiErrors.map(String) : [])].join('\n') || 'No captured errors.';
  }
  const record = message => { browserErrors.push(String(message).slice(0, 2000)); if (browserErrors.length > 50) browserErrors.shift(); render(); };
  const onError = event => record(event.message || event.error?.message || 'Browser error');
  const onRejection = event => record(event.reason?.message || event.reason || 'Unhandled promise rejection');
  win?.addEventListener('error', onError);
  win?.addEventListener('unhandledrejection', onRejection);
  render();
  return {
    update(next = {}) { results = next || {}; render(); },
    destroy() { destroyed = true; win?.removeEventListener('error', onError); win?.removeEventListener('unhandledrejection', onRejection); root.remove(); },
  };
}
