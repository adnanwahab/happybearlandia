/** Accessibility enhancements; panel visibility and Escape belong to panelManager. */
export function focusableControls(panel) {
  if (!panel || panel.hidden || panel.style?.display === 'none') return [];
  return [...panel.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
    .filter(node => !node.disabled && node.tabIndex >= 0 && !node.closest('[hidden],[inert]') && node.getClientRects().length > 0);
}

export function mountWorldAccessibility({ document, panelManager, getActivePanel, onDismiss } = {}) {
  const live = document.createElement('div');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  Object.assign(live.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' });
  document.body.append(live);
  let disposed = false;
  const active = () => getActivePanel?.() || null;
  const keydown = event => {
    const panel = active();
    if (!panel || panel.hidden || panel.style.display === 'none') return;
    // A manager already owns dismissal. Standalone consumers can supply onDismiss.
    if (event.key === 'Escape' && !panelManager && onDismiss) {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== 'Tab' || panel.getAttribute('aria-modal') !== 'true') return;
    const controls = focusableControls(panel);
    if (!controls.length) { event.preventDefault(); panel.focus(); return; }
    const first = controls[0], last = controls.at(-1);
    if (!panel.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };
  document.addEventListener('keydown', keydown);
  return {
    announce(text) { if (!disposed) live.textContent = String(text ?? ''); },
    dispose() { if (disposed) return; disposed = true; document.removeEventListener('keydown', keydown); live.remove(); },
  };
}

/** Subscribe to preference changes instead of capturing a startup-only value. */
export function observeReducedMotion(window, onChange) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const change = () => onChange(query.matches);
  change();
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
