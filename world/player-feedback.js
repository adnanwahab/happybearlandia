export function mountPlayerFeedback(container, { fetchImpl = globalThis.fetch } = {}) {
  const panel = document.createElement('details');
  panel.id = 'playerFeedback';
  panel.innerHTML = `<summary>Share optional feedback</summary><form>
    <p>Only these choices are counted privately. No name, account, location, saved world, or written message is collected. Ordinary server access logs may still apply.</p>
    <label>Feedback type <select name="kind"><option value="confusing">A confusing step</option><option value="favorite">A favorite moment</option></select></label>
    <label>Moment <select name="moment"><option value="exploring">Exploring the world</option><option value="choosing">Choosing a change</option><option value="comparing">Comparing futures</option><option value="inspecting">Inspecting an outcome</option><option value="sharing">Sharing a future</option></select></label>
    <label><input type="checkbox" name="consent"> I agree to send these choices as private feedback.</label>
    <button type="submit" disabled>Send feedback</button><button type="button" data-dismiss>Continue without sending</button>
    <p role="status" aria-live="polite"></p></form>`;
  const form = panel.querySelector('form'), consent = form.elements.consent;
  const send = form.querySelector('[type=submit]'), status = form.querySelector('[role=status]');
  let pending = false, controller;
  consent.onchange = () => { send.disabled = pending || !consent.checked; };
  form.querySelector('[data-dismiss]').onclick = () => {
    controller?.abort(); consent.checked = false; send.disabled = true; status.textContent = ''; panel.open = false;
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (!consent.checked || pending) return;
    pending = true; send.disabled = true;
    const active = controller = new AbortController();
    const timeout = setTimeout(() => active.abort(), 8000);
    status.textContent = 'Sending… You can keep playing.';
    try {
      const response = await fetchImpl('/api/player-feedback', {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' }, signal: active.signal,
        body: JSON.stringify({ version: 1, consent: true, kind: form.elements.kind.value, moment: form.elements.moment.value }),
      });
      if (!response.ok) throw new Error('unavailable');
      if (!active.signal.aborted) { consent.checked = false; status.textContent = 'Thank you. Your choices were counted privately.'; }
    } catch {
      if (panel.open) status.textContent = 'Feedback could not be confirmed. You can try again or keep playing. Retrying may count twice.';
    } finally { clearTimeout(timeout); pending = false; send.disabled = !consent.checked; }
  };
  container.append(panel);
  return panel;
}
const host = typeof document !== 'undefined' && document.querySelector('[data-player-feedback]');
if (host) mountPlayerFeedback(host);
