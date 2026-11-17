import { createSurveyEligibility, validateSurvey } from './session-survey-contract.js';
export function mountSessionSurvey(container, { fetchImpl = globalThis.fetch } = {}) {
  const eligibility = createSurveyEligibility();
  const panel = container.ownerDocument.createElement('details');
  panel.hidden = true;
  panel.dataset.testid = 'session-survey';
  panel.innerHTML = `<summary>Optional session feedback</summary><form>
    <p>Keep playing or skip. Both questions are optional. Answers are saved privately for product review; no account or world identifiers are sent. Server access logs may apply.</p>
    <label>Was this session clear and fun? <select name="rating"><option value="">Skip question</option><option value="clear-and-fun">Clear and fun</option><option value="clear-not-fun">Clear, less fun</option><option value="fun-not-clear">Fun, less clear</option><option value="neither">Neither yet</option></select></label>
    <label>One suggestion (optional, 500 characters)<textarea name="suggestion" maxlength="500" rows="3"></textarea></label>
    <p>Please omit names, contact details, health information and other personal or sensitive information. Common contact details and links are rejected; this cannot detect all personal information.</p>
    <label><input name="consent" type="checkbox"> I agree to send these answers for product feedback.</label>
    <button type="submit" disabled>Send session feedback</button><button type="button" data-skip>Skip feedback</button>
    <p role="status" aria-live="polite"></p></form>`;
  const form = panel.querySelector('form'), { consent, rating, suggestion } = form.elements;
  const send = form.querySelector('[type=submit]'), status = form.querySelector('[role=status]');
  let pending = false, active;
  const sync = () => { send.disabled = pending || !consent.checked; };
  consent.addEventListener('change', sync);
  form.querySelector('[data-skip]').onclick = () => { active?.abort(); form.reset(); panel.hidden = true; status.textContent = ''; };
  form.onsubmit = async event => {
    event.preventDefault();
    if (pending || panel.hidden) return;
    let data;
    try { data = validateSurvey({ version: 1, consent: consent.checked, rating: rating.value, suggestion: suggestion.value }); }
    catch (error) { status.textContent = error.message; return; }
    pending = true; sync();
    const controller = active = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    status.textContent = 'Sending… You can keep playing.';
    try {
      const response = await fetchImpl('/api/session-survey', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal });
      if (!response.ok) throw Error('unavailable');
      if (!controller.signal.aborted) { form.reset(); status.textContent = 'Thank you. Your feedback was saved.'; }
    } catch {
      if (!panel.hidden) status.textContent = 'Could not confirm submission. Keep playing or retry; a retry may send twice.';
    } finally { clearTimeout(timeout); pending = false; sync(); }
  };
  container.append(panel);
  return { replayStarted: eligibility.replayStarted, update(state) { if (eligibility.observe(state)) panel.hidden = false; }, dispose() { active?.abort(); panel.remove(); } };
}
