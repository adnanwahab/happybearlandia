/**
 * One disposable City worker per operation. Deadlines remain wall-clock limits;
 * request cancellation only applies when the caller explicitly passes a signal.
 * createWorker is an injectable worker boundary for lifecycle regression tests.
 */
export function workerCall(file, data, timeout = 60000, {signal, createWorker = url => new Worker(url)} = {}) {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(timeout) || timeout < 0) { reject(new RangeError('Finite nonnegative worker timeout required')); return; }
    if (signal?.aborted) { reject(new DOMException('Operation aborted', 'AbortError')); return; }
    let worker, timer, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (worker) {
        worker.onmessage = worker.onerror = null;
        try { worker.terminate(); } catch (cleanupError) { error ||= cleanupError; }
      }
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(new DOMException('Operation aborted', 'AbortError'));
    try {
      worker = createWorker(new URL(file, import.meta.url).href);
      timer = setTimeout(() => finish(new Error('Operation time limit exceeded')), timeout);
      signal?.addEventListener('abort', abort, {once: true});
      worker.onmessage = ({data}) => {
        if (!data || !Object.hasOwn(data, 'result') && !Object.hasOwn(data, 'error')) { finish(new Error('Invalid City worker response')); return; }
        finish(data.error ? new Error(data.error) : null, data.result);
      };
      worker.onerror = event => { event.preventDefault?.(); finish(new Error(event.message || 'Worker failed')); };
      // The signal can abort during worker construction before its listener exists.
      if (signal?.aborted) abort();
      else worker.postMessage(data);
    } catch (error) { finish(error); }
  });
}
