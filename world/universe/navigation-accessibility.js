/* Native document navigation: deliberately independent of animation APIs. */
(() => {
  if (window.top !== window || window.hblNavigationAccessibility) return;
  window.hblNavigationAccessibility = true;
  const visible = el => el && !el.closest('[hidden], [inert], [aria-hidden="true"]') && el.getClientRects().length > 0;
  let handled = false;
  let arrivalHeading = null, focusMoved = false;
  document.addEventListener('focusin', event => {
    if (arrivalHeading && event.target !== arrivalHeading) focusMoved = true;
  });
  const style = document.createElement('style');
  style.textContent = '[data-navigation-focus]:focus{outline:3px solid #c5f286;outline-offset:4px}.hbl-navigation-heading{position:relative;z-index:100;margin:0;padding:8px;font:700 18px system-ui;background:#101d2f;color:#edf3fa}.hbl-navigation-status{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.hbl-navigation-exit{display:block;position:relative;z-index:100;font:14px system-ui;padding:8px;background:#101d2f;color:#edf3fa}';
  document.head.append(style);
  const status = document.createElement('div');
  status.className = 'hbl-navigation-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  const exit = document.createElement('a');
  exit.className = 'hbl-navigation-exit';
  exit.href = '/routes';
  exit.textContent = 'All workspaces — back to directory';
  document.body.prepend(exit);
  document.body.append(status);
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return;
    const peers = [...document.querySelectorAll('a[href]')].filter(el => el.href === link.href);
    const marker = {href: link.href, index: peers.indexOf(link), portalId: link.dataset.portalId};
    try { history.replaceState({...history.state, hblNavigationFocus: marker}, ''); } catch {}
  });
  const restore = event => {
    if (handled) return;
    handled = true;
    const back = event.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
    const marker = back && history.state?.hblNavigationFocus;
    let target = marker && [...document.querySelectorAll('a[href]')].filter(el => el.href === marker.href)[marker.index];
    if (!visible(target)) target = null;
    if (!target && marker?.portalId) {
      const portals = [...document.querySelectorAll('a[data-portal-id]')].filter(el => el.dataset.portalId === marker.portalId);
      if (portals.length === 1 && visible(portals[0])) target = portals[0];
    }
    const restored = Boolean(target);
    target ||= [...document.querySelectorAll('h1, [role="heading"][aria-level="1"]')].find(visible);
    if (!target) {
      target = document.createElement('h1');
      target.className = 'hbl-navigation-heading';
      target.textContent = document.title || 'HappyBearLandia workspace';
      exit.after(target);
    }
    target.tabIndex = target.matches('a[href],button,input,select,textarea') ? target.tabIndex : -1;
    document.querySelectorAll('[data-navigation-focus]').forEach(el => el.removeAttribute('data-navigation-focus'));
    target.dataset.navigationFocus = restored ? 'restored' : 'heading';
    arrivalHeading = restored ? null : target;
    focusMoved = false;
    target.focus({preventScroll: true});
    target.scrollIntoView({behavior: 'instant', block: 'nearest'});
    status.dataset.destination = document.title;
    status.dataset.restoredFocus = String(restored);
    // Focus exposes the heading/opener name; avoid repeating it in the live region.
    status.textContent = restored ? 'Destination ready. Previous focus restored.' : 'Destination ready. Focus at page heading.';
  };
  // Async applications announce their first real DOM after replacing a boot
  // screen. Recover only our detached arrival heading, never a user's focus.
  addEventListener('hbl:document-ready', () => {
    const recover = arrivalHeading && !arrivalHeading.isConnected && !focusMoved && document.activeElement === document.body;
    arrivalHeading = null;
    if (recover) { handled = false; restore({persisted: false}); }
  });
  addEventListener('pageshow', restore);
  addEventListener('pagehide', () => { handled = false; status.textContent = ''; });
})();
