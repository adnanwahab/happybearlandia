// Local test evidence only. Never capture DOM, request bodies, cookies or storage.
export function redact(value) {
  return String(value ?? '')
    .replace(/https?:\/\/[^\s)"'<>]+/gi, raw => {
      try { const url = new URL(raw); return `${url.origin}/[redacted-path]`; }
      catch { return '[redacted-url]'; }
    })
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted-email]')
    .replace(/(?:Bearer\s+)[\w.\-]+/gi, 'Bearer [redacted]')
    .replace(/((?:token|password|secret|authorization|cookie|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[^\s/:\\]+/gi, '[redacted-home]')
    .replace(/\+?\d[\d ().-]{7,}\d/g, '[redacted-number]')
    .slice(0, 2000);
}

export function collectBrowserEvidence(page, { limit = 100 } = {}) {
  const events = [];
  const listeners = [];
  let dropped = 0;
  function record(kind, message) {
    if (events.length >= limit) { dropped++; return; }
    events.push({ kind, message: redact(message) });
  }
  function on(name, handler) { page.on(name, handler); listeners.push([name, handler]); }
  // Playwright pageerror includes uncaught exceptions and unhandled rejections.
  on('pageerror', error => record('exception', error.message));
  on('console', message => { if (message.type() === 'error') record('console', message.text()); });
  on('requestfailed', request => record('requestfailed', `${request.url()}: ${request.failure()?.errorText}`));
  on('response', response => { if (response.status() >= 400) record('http', `${response.status()} ${response.url()}`); });
  return {
    events, record,
    async attach(testInfo) {
      const artifact = { version: 1, status: testInfo.status ?? 'unknown',
        page: redact(page.url()), events, dropped };
      await testInfo.attach('browser-errors', { body: JSON.stringify(artifact, null, 2), contentType: 'application/json' });
    },
    dispose() { for (const [name, handler] of listeners) page.off(name, handler); },
  };
}
