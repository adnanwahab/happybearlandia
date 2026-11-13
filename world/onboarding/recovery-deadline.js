/** Settle even when an operation ignores abort. The caller guards late mutations. */
export function withRecoveryDeadline(operation, { signal, timeoutMs, onTimeout, message }) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Operation stopped', 'AbortError')); };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error(message));
      onTimeout?.();
    }, timeoutMs);
    Promise.resolve().then(() => {
      if (signal?.aborted) throw new DOMException('Operation stopped', 'AbortError');
      return operation();
    }).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}
