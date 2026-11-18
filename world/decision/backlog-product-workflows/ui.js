function elStyle(textarea) { textarea.style.cssText = 'display:block;box-sizing:border-box;width:100%;min-height:90px'; }
/** Explicit user-driven local workflows. No automatic telemetry or client owner fields. */
export function mountProductWorkflows(container, { endpoint = '/api/product-workflows', headers = {}, fetch: transport = globalThis.fetch, onExport = () => {} } = {}) {
  const url = new URL(endpoint, location.href);
  if (url.origin !== location.origin) throw new Error('Workflow endpoint must be same-origin');
  const root = document.createElement('section');
  root.setAttribute('aria-label', 'Local product workflows');
  root.innerHTML = `<h2>Local product workflows</h2><p>Optional records stay on this server for up to 30 days. Nothing is submitted to an external service.</p>
<label><input type="checkbox" data-consent> I consent to local storage</label>
<label>Pilot brief <textarea data-brief maxlength="4000"></textarea></label>
<button data-review>Review pilot brief</button><pre data-preview></pre>
<label><input type="checkbox" data-reviewed disabled> I reviewed this exact brief</label>
<button data-save disabled>Store pilot locally</button>
<label>Product event <select data-event><option value="studio_opened">Studio opened</option><option value="comparison_saved">Comparison saved</option><option value="brief_exported">Brief exported</option></select></label>
<label><input type="checkbox" data-event-review> I reviewed the selected event</label><button data-send disabled>Store selected event locally</button>
<button data-export>Export my local records</button><button data-delete>Delete my local records</button>
<pre data-result role="status" aria-live="polite"></pre>`;
  root.style.cssText = 'display:grid;gap:12px;max-width:680px;padding:16px;font:16px/1.5 system-ui';
  for (const label of root.querySelectorAll('label')) label.style.display = 'block';
  for (const pre of root.querySelectorAll('pre')) pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:0';
  elStyle(root.querySelector('textarea'));
  container.append(root);
  const el = name => root.querySelector(`[data-${name}]`);
  let disposed = false, busy = false, reviewedBrief = null;
  let pilotKey = crypto.randomUUID(), eventKey = crypto.randomUUID();
  const requests = new Set();
  const sync = () => {
    el('save').disabled = busy || !el('consent').checked || !el('reviewed').checked || reviewedBrief !== el('brief').value.trim();
    el('send').disabled = busy || !el('consent').checked || !el('event-review').checked;
    for (const name of ['export', 'delete', 'review']) el(name).disabled = busy;
  };
  const resetReview = () => { reviewedBrief = null; el('reviewed').checked = false; el('reviewed').disabled = true; el('preview').textContent = ''; pilotKey = crypto.randomUUID(); sync(); };
  el('brief').oninput = resetReview;
  el('review').onclick = () => {
    const value = el('brief').value.trim();
    if (!value) { el('result').textContent = 'Enter a pilot brief before review.'; return; }
    reviewedBrief = value; el('preview').textContent = `Review exact local pilot brief:\n${value}`; el('reviewed').disabled = false; sync();
  };
  el('event').onchange = () => { eventKey = crypto.randomUUID(); el('event-review').checked = false; sync(); };
  el('consent').onchange = () => { if (!el('consent').checked) { el('reviewed').checked = false; el('event-review').checked = false; } sync(); };
  el('reviewed').onchange = sync; el('event-review').onchange = sync;
  async function call(method, payload) {
    if (busy || disposed) return;
    busy = true; sync();
    const controller = new AbortController(); requests.add(controller);
    try {
      const response = await transport(url.href, { method, credentials: 'same-origin', headers: { ...headers, 'content-type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined, signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
      if (disposed) return;
      if (method === 'POST') {
        if (body.status !== 'stored-locally' || body.externalSubmission !== false) throw new Error('Invalid local receipt');
        el('result').textContent = `Stored locally; not submitted externally. Receipt ${body.id}`;
      } else if (method === 'GET') { el('result').textContent = JSON.stringify(body, null, 2); onExport(body); }
      else { el('result').textContent = `Deleted ${body.deleted} local records.`; pilotKey = crypto.randomUUID(); eventKey = crypto.randomUUID(); el('consent').checked = false; el('event-review').checked = false; resetReview(); }
    } catch (error) { if (!disposed) el('result').textContent = `Local storage failed: ${error.message}. Your draft is retained; retry when available.`; }
    finally { requests.delete(controller); busy = false; if (!disposed) sync(); }
  }
  el('save').onclick = () => call('POST', { key: pilotKey, kind: 'pilot', brief: reviewedBrief, consent: el('consent').checked, reviewed: el('reviewed').checked });
  el('send').onclick = () => call('POST', { key: eventKey, kind: 'event', event: el('event').value, consent: el('consent').checked, reviewed: el('event-review').checked });
  el('export').onclick = () => call('GET'); el('delete').onclick = () => call('DELETE');
  sync();
  return { dispose() { disposed = true; for (const request of requests) request.abort(); root.remove(); } };
}
