/** Browser component; the host owns placement and calls update after source/time changes.
 * All checkpoint requests use existing local capability and approval boundaries.
 */
export function mount(container, { getContext, fetch: request = globalThis.fetch.bind(globalThis) }) {
  if (!container || typeof getContext !== 'function') throw new Error('Checkpoint container and source context required');
  const doc = container.ownerDocument;
  const section = doc.createElement('section'); section.dataset.housingCheckpoints = ''; section.setAttribute('aria-label', 'Housing checkpoints');
  const node = (tag, text, parent = section) => { const el = doc.createElement(tag); if (text) el.textContent = text; parent.append(el); return el; };
  const style = node('style'); style.textContent = '[data-housing-checkpoints]{padding:16px;border:1px solid #506573;border-radius:12px;margin:16px 0;max-width:900px}[data-housing-checkpoints] label{display:block;margin:10px 0}[data-housing-checkpoints] input,[data-housing-checkpoints] textarea{display:block;box-sizing:border-box;width:100%;max-width:100%;padding:8px;background:#10222b;color:#eef7fa;border:1px solid #58717d;border-radius:5px}[data-housing-checkpoints] button{margin:4px;padding:8px;cursor:pointer}[data-housing-checkpoints] button:disabled{opacity:.5;cursor:default}[data-housing-checkpoints] pre{max-height:300px;overflow:auto;font-size:12px}';
  node('h3', 'Save and branch this housing future');
  node('p', 'Synthetic housing model only. Save an exact completed month, restore a receipt, or review a forward intervention. Parents remain immutable.');
  const source = node('p');
  const field = (label, tag = 'input') => { const wrapper = node('label', label + ' '); const el = node(tag, '', wrapper); return el; };
  const receipt = field('Checkpoint receipt (JSON)', 'textarea'); receipt.rows = 3; receipt.maxLength = 2048;
  const target = field('Target completed month'); target.type = 'number'; target.min = '0'; target.step = '1';
  const operations = field('Forward operations (JSON array)', 'textarea'); operations.rows = 4; operations.maxLength = 12000; operations.value = '[]';
  const actions = node('div');
  const button = text => { const el = node('button', text, actions); el.type = 'button'; return el; };
  const save = button('Save selected month'), load = button('Load receipt'), resume = button('Resume to target'), preview = button('Review fork'), approve = button('Approve exact fork'), cancel = button('Cancel request');
  const status = node('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const provenance = node('pre'); provenance.style.whiteSpace = 'pre-wrap'; provenance.style.overflowWrap = 'anywhere';
  container.append(section);
  let destroyed = false, generation = 0, controller = null, pending = null, bound = '', retained = null;
  const context = () => { const value = getContext() || {}; return { experimentId: value.experimentId, runId: value.runId, month: value.month, years: value.years }; };
  const key = value => JSON.stringify(value);
  const valid = value => /^[A-Za-z0-9_-]{1,128}$/.test(value.experimentId || '') && /^[A-Za-z0-9_-]{1,128}$/.test(value.runId || '') && Number.isInteger(value.month) && Number.isInteger(value.years) && value.month >= 0 && value.month <= value.years * 12;
  const scope = value => ({ experimentId: value.experimentId, runId: value.runId });
  function buttons() {
    const unavailable = destroyed || !valid(context());
    for (const el of [save, load, resume, preview]) el.disabled = unavailable || Boolean(controller);
    approve.disabled = unavailable || Boolean(controller) || !pending;
    cancel.disabled = !controller;
    target.disabled = unavailable; operations.disabled = unavailable; receipt.disabled = unavailable;
  }
  function invalidate(message) { generation++; controller?.abort(); controller = null; pending = null; if (message) status.textContent = message; buttons(); }
  function update() {
    if (destroyed) return;
    const value = context(), next = key(value);
    if (next !== bound) {
      bound = next; retained = null; receipt.value = ''; provenance.textContent = '';
      target.value = valid(value) ? String(Math.min(value.month + 24, value.years * 12)) : '';
      target.max = String(value.years * 12 || 0);
      invalidate(valid(value) ? 'Save the selected month or paste a receipt for this source.' : 'Select a completed housing 1.2.0 future first.');
    }
    source.textContent = valid(value) ? `Source ${value.experimentId} / ${value.runId} · selected month ${value.month} · horizon ${value.years * 12} months` : 'No supported selected future.';
    buttons();
  }
  function readReceipt() {
    const value = JSON.parse(receipt.value);
    if (!value || !/^housing:sha256:[a-f0-9]{64}$/.test(value.id) || !/^sha256:[a-f0-9]{64}$/.test(value.digest)) throw new Error('Paste the saved checkpoint receipt containing id and digest.');
    return { id: value.id, digest: value.digest };
  }
  function readTarget(value) { const month = Number(target.value); if (target.value === '' || !Number.isInteger(month) || month < 0 || month > value.years * 12) throw new Error('Enter a whole target month within this run’s horizon.'); return month; }
  function forkPayload(value) {
    const edits = JSON.parse(operations.value); if (!Array.isArray(edits) || edits.length > 32) throw new Error('Enter a JSON array with at most 32 supported operations.');
    return { ...scope(value), action: 'fork', checkpoint: readReceipt(), month: readTarget(value), operations: edits };
  }
  async function json(path, payload, signal) {
    const response = await request(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal });
    const body = await response.json();
    if (!response.ok) throw new Error(`${body.error || 'Checkpoint request failed'}${body.detail ? ': ' + body.detail : ''} (${response.status}). Check the source, receipt and local capability; retry after other work finishes.`);
    return body;
  }
  function show(value) {
    const checkpoint = value.checkpoint;
    if (!checkpoint?.id || !checkpoint.digest) throw new Error('The server did not return a checkpoint receipt.');
    retained = checkpoint;
    receipt.value = JSON.stringify({ id: checkpoint.id, digest: checkpoint.digest });
    provenance.textContent = JSON.stringify({ checkpoint: checkpoint.id, digest: checkpoint.digest, modelVersion: checkpoint.modelVersion, engineVersion: checkpoint.engineVersion, rulesVersion: checkpoint.rulesVersion, recipeVersion: checkpoint.recipeVersion, seed: checkpoint.recipe?.seed, month: checkpoint.state?.month, recipeDigest: checkpoint.recipeDigest, parentDigest: checkpoint.parentDigest, lineage: checkpoint.lineage, expiresAt: value.expiresAt, source: 'modeled synthetic housing; not empirical calibration' }, null, 2);
    status.textContent = `Checkpoint available at month ${checkpoint.state?.month}. Copy the receipt to reopen it in this local browser capability. Retention expires ${new Date(value.expiresAt).toISOString()}.`;
  }
  async function run(action) {
    update(); if (controller || !valid(context()) || destroyed) return;
    const value = context(), sourceKey = bound, token = ++generation;
    const abort = new AbortController(); controller = abort; buttons();
    try {
      let payload;
      if (action === 'approve') {
        if (!pending || pending.sourceKey !== sourceKey || pending.form !== key(forkPayload(value))) throw new Error('Fields or selected future changed. Review the fork again.');
        payload = { ...pending.payload, approval: true, previewHash: pending.hash }; pending = null;
      } else if (action === 'fork') payload = forkPayload(value);
      else payload = { ...scope(value), action, ...(action === 'start' ? { month: value.month } : { checkpoint: readReceipt() }), ...(action === 'resume' ? { month: readTarget(value) } : {}) };
      await json('/api/local-capability', {}, abort.signal);
      const result = await json('/api/decision-checkpoints', payload, abort.signal);
      if (destroyed || token !== generation || sourceKey !== key(context())) { if (!destroyed) update(); return; }
      if (result.requiresApproval) {
        if (typeof result.previewHash !== 'string' || !result.previewHash) throw new Error('The server did not return an approval hash.');
        pending = { sourceKey, form: key(payload), payload, hash: result.previewHash };
        provenance.textContent = JSON.stringify({ parent: payload.checkpoint, targetMonth: payload.month, operations: payload.operations, previewHash: result.previewHash }, null, 2);
        status.textContent = 'Review these exact operations and target month. Approve exact fork to create a child; no branch has been saved.';
      } else { pending = null; show(result); }
    } catch (error) { if (!destroyed && token === generation && error.name !== 'AbortError') { pending = null; status.textContent = error.message; } }
    finally { if (token === generation) controller = null; buttons(); }
  }
  save.onclick = () => run('start'); load.onclick = () => run('load'); resume.onclick = () => run('resume'); preview.onclick = () => run('fork'); approve.onclick = () => run('approve');
  cancel.onclick = () => invalidate('Request cancelled locally. An accepted server write may already have completed; load its receipt before retrying.');
  for (const input of [target, operations, receipt]) input.addEventListener('input', () => invalidate('Fields changed. Review a new fork before approval.'));
  update();
  return { update, getReceipt: () => retained ? { id: retained.id, digest: retained.digest } : null, destroy() { if (destroyed) return; destroyed = true; invalidate(); section.remove(); } };
}
