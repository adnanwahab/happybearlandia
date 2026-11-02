/** Optional Studio integration: a real local pilot brief export, no fake submission.
 * mountPilotRequest(container, { getContext: () => ({decision, modelId}) })
 * returns {destroy()}. All fields stay in this browser until downloaded.
 */
export function mountPilotRequest(container, { getContext = () => ({}) } = {}) {
  const doc = container.ownerDocument;
  const section = doc.createElement('details');
  section.className = 'decision-pilot-request';
  section.innerHTML = `<summary>Request a pilot — prepare a brief</summary>
    <p>Define one decision and the alternatives you want to test. Download a local brief to share with your existing project contact. Nothing is submitted or sent automatically.</p>
    <form><label>Organization or team <input name="organization" maxlength="200" required></label>
    <label>Decision to investigate <textarea name="decision" maxlength="10000" required></textarea></label>
    <label>Alternatives <textarea name="alternatives" maxlength="5000" required placeholder="Current policy, proposal, alternative, stress case"></textarea></label>
    <label>Available evidence and data <textarea name="evidence" maxlength="5000" placeholder="Sources, dates, ownership, and known gaps"></textarea></label>
    <label>Desired decision date <input name="decisionDate" type="date"></label>
    <button type="submit">Download pilot brief</button><p role="status" aria-live="polite"></p></form>`;
  container.append(section);
  const form = section.querySelector('form'), status = section.querySelector('[role="status"]');
  const onToggle = () => {
    if (section.open && !form.elements.decision.value) form.elements.decision.value = String(getContext()?.decision || '');
  };
  const onSubmit = event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(new doc.defaultView.FormData(form));
    const payload = { schemaVersion: 'decision-pilot-brief.v1', createdAt: new Date().toISOString(), ...fields, context: getContext(), note: 'Prepared locally; not submitted. Model outputs are illustrative until evaluated against appropriate evidence.' };
    const url = doc.defaultView.URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = doc.createElement('a');
    link.href = url; link.download = 'hbl-pilot-brief.json'; link.click();
    setTimeout(() => doc.defaultView.URL.revokeObjectURL(url), 1000);
    recordLocalDemoEvent('pilot-brief-exported', {}, doc.defaultView);
    status.textContent = 'Pilot brief downloaded locally. Share it through your existing contact channel when ready.';
  };
  section.addEventListener('toggle', onToggle);
  form.addEventListener('submit', onSubmit);
  return { destroy() { section.removeEventListener('toggle', onToggle); form.removeEventListener('submit', onSubmit); section.remove(); } };
}

// Optional local-only demo analytics. No network, identifiers, prompts, contact
// fields or organization names. The user can export/clear these events.
const LOCAL_EVENT_KEY = 'hbl.local-demo-activity.v1';
const LOCAL_EVENT_TYPES = new Set(['tour-started','tour-step','tour-completed','stress-sequence-started','stress-sequence-completed','demo-saved-loaded','demo-fresh-requested','demo-manifest-exported','pilot-brief-exported']);
export function getLocalDemoActivity(win = globalThis.window) {
  try { const rows = JSON.parse(win?.localStorage?.getItem(LOCAL_EVENT_KEY) || '[]'); return Array.isArray(rows) ? rows.slice(-200) : []; } catch { return []; }
}
export function recordLocalDemoEvent(type, detail = {}, win = globalThis.window) {
  if (!LOCAL_EVENT_TYPES.has(type)) return false;
  const record = {type,at:new Date().toISOString()};
  for (const key of ['step','runs','scenarioCount']) if (Number.isInteger(detail[key]) && detail[key] >= 0 && detail[key] <= 100000) record[key] = detail[key];
  if (typeof detail.modelVersion === 'string' && /^[0-9.]{1,24}$/.test(detail.modelVersion)) record.modelVersion = detail.modelVersion;
  try { win?.localStorage?.setItem(LOCAL_EVENT_KEY, JSON.stringify([...getLocalDemoActivity(win),record].slice(-200))); return Boolean(win?.localStorage); } catch { return false; }
}
export function clearLocalDemoActivity(win = globalThis.window) { try { win?.localStorage?.removeItem(LOCAL_EVENT_KEY); } catch {} }
