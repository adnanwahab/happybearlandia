// Presentation only: never reads simulation state, query parameters or identities.
export function mountPlayerFeedback(container, { fetchImpl = globalThis.fetch } = {}) {
  const panel = document.createElement('details');
  panel.id = 'playerFeedback';
  panel.innerHTML = `<summary>Feedback (optional)</summary><form>
    <p id="reactionPrivacy">Send only a reaction and the selected World feature as anonymous counts. No name, account, location, URL, saved world, seed, or session history is included. Ordinary server access logs may still apply. Counts cannot be individually withdrawn after sending. Clear removes local choices only.</p>
    <label>World feature <select name="moment"><option value="exploring">Exploring the world</option><option value="choosing">Choosing a change</option><option value="comparing">Comparing futures</option><option value="inspecting">Inspecting an outcome</option><option value="sharing">Sharing a future</option></select></label>
    <label class="reaction-consent"><input type="checkbox" name="consent" aria-describedby="reactionPrivacy"> I agree to send anonymous counts for these choices.</label>
    <div class="row"><button type="submit" name="kind" value="favorite" disabled>Wow</button><button type="submit" name="kind" value="confusing" disabled>Confusing</button></div>
    <div class="row"><button type="button" data-clear>Clear local feedback</button><button type="button" data-dismiss>Continue without sending</button></div>
    <p role="status" aria-live="polite"></p></form>`;
  const form = panel.querySelector('form'), consent = form.elements.consent;
  const reactions = [...form.querySelectorAll('[type=submit]')];
  const status = form.querySelector('[role=status]'), summary = panel.querySelector('summary');
  let pending = false, controller;
  const update = () => { for (const button of reactions) button.disabled = pending || !consent.checked; };
  const clear = () => {
    controller?.abort(); controller = undefined; pending = false;
    consent.checked = false; form.elements.moment.value = 'exploring'; update();
  };
  consent.onchange = update;
  form.querySelector('[data-clear]').onclick = () => {
    clear(); status.textContent = 'Local choices cleared. Previously sent anonymous counts cannot be individually withdrawn.';
  };
  form.querySelector('[data-dismiss]').onclick = () => {
    clear(); status.textContent = ''; panel.open = false; summary.focus();
  };
  // Native disclosure never opens automatically; no timers, reminders or session prompt.
  panel.addEventListener('toggle', () => { if (!panel.open) { clear(); status.textContent = ''; } });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.open) {
      event.preventDefault(); event.stopPropagation();
      form.querySelector('[data-dismiss]').click();
    }
  });
  form.onsubmit = async event => {
    event.preventDefault();
    const kind = event.submitter?.value;
    if (!consent.checked || pending || !['favorite', 'confusing'].includes(kind)) return;
    pending = true; update();
    const active = controller = new AbortController();
    const timeout = setTimeout(() => active.abort(), 8000);
    status.textContent = 'Sending… You can keep playing.';
    try {
      const response = await fetchImpl('/api/player-feedback', {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' }, signal: active.signal,
        body: JSON.stringify({ version: 1, consent: true, kind, moment: form.elements.moment.value }),
      });
      if (!response.ok) throw new Error('unavailable');
      if (controller === active && !active.signal.aborted) {
        consent.checked = false; status.textContent = 'Thank you. Your choices were counted privately.';
      }
    } catch {
      if (controller === active && panel.open) status.textContent = 'Feedback could not be confirmed. You can keep playing. Retrying may count twice.';
    } finally {
      clearTimeout(timeout);
      if (controller === active) { pending = false; controller = undefined; update(); }
    }
  };
  container.append(panel);
  return panel;
}
const host = typeof document !== 'undefined' && document.querySelector('[data-player-feedback]');
if (host) mountPlayerFeedback(host);
