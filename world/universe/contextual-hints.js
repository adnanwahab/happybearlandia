/** Presentation only: discover live controls on request; never invoke their actions. */
export function availableHintActions(root, excluded) {
  return [...root.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href]')].filter(control =>
    !excluded.contains(control) && !control.closest('nav, [hidden], [inert], [aria-hidden="true"], [data-hbl-hints]') &&
    !control.matches(':disabled, [aria-disabled="true"]') && control.getClientRects().length &&
    root.defaultView.getComputedStyle(control).visibility === 'visible' && hintLabel(control)
  ).sort((a, b) => Number(a.tagName === 'A') - Number(b.tagName === 'A'));
}
function hintLabel(control) {
  return (control.getAttribute('aria-label') || control.labels?.[0]?.textContent || control.textContent || control.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 160);
}
export function mountContextualHints(container, { workspaceId, root = container.ownerDocument } = {}) {
  const existing = root.querySelector('[data-hbl-hints]');
  if (existing) return { dispose() {} };
  const doc = container.ownerDocument, key = `hbl-hints:v1:${workspaceId}`;
  const host = doc.createElement('section'); host.dataset.hblHints = ''; host.setAttribute('aria-label', 'Contextual hints');
  host.style.cssText = 'font:14px/1.5 system-ui;max-width:320px;padding:8px;color:inherit';
  const button = (label, fn) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'font:inherit;min-height:44px;padding:8px;margin:2px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;cursor:pointer'; b.addEventListener('click', fn); return b; };
  const panel = doc.createElement('div'); panel.id = 'hbl-contextual-hint'; panel.hidden = true;
  const message = doc.createElement('p'); message.setAttribute('role', 'status');
  let target;
  const show = button('Show Me a hint', () => {
    target = availableHintActions(root, host)[0];
    message.textContent = target ? `Try “${hintLabel(target)}”. Show the control, then choose it yourself.` : 'No available actions here yet. Close this hint and try again when the workspace is ready.';
    focus.hidden = !target; panel.hidden = false; show.setAttribute('aria-expanded', 'true');
  });
  show.setAttribute('aria-expanded', 'false'); show.setAttribute('aria-controls', panel.id);
  const close = () => { panel.hidden = true; show.setAttribute('aria-expanded', 'false'); show.focus(); };
  const focus = button('Show the control', () => {
    if (!target || !availableHintActions(root, host).includes(target)) {
      target = null; message.textContent = 'That action is no longer available. Close this hint and ask again.'; focus.hidden = true; return;
    }
    close(); target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  const dismiss = button('Dismiss hints for this workspace', () => {
    try { doc.defaultView.localStorage.setItem(key, 'dismissed'); } catch { /* Session dismissal still works without storage. */ }
    close(); show.textContent = 'Show Me a hint (dismissed)';
  });
  try { if (doc.defaultView.localStorage.getItem(key) === 'dismissed') show.textContent = 'Show Me a hint (dismissed)'; } catch {}
  panel.append(message, focus, button('Close hint', close), dismiss); host.append(show, panel); container.append(host);
  host.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.stopPropagation(); close(); } });
  return { dispose() { host.remove(); } };
}
