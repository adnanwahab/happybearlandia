/* Cross-document enhancement only: native links own URLs, loading and history. */
(() => {
  if (window.top !== window) return;
  const key = 'hbl-portal-v1';
  const reduced = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches || JSON.parse(localStorage.getItem('hbl-media-v1') || '{}').motion === 'reduce'; }
    catch { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  };
  const clear = () => document.querySelectorAll('[data-portal-active]').forEach(el => {
    el.style.viewTransitionName = ''; delete el.dataset.portalActive;
  });
  const mark = (el, id) => {
    if (!el || reduced() || !CSS.supports('view-transition-name', 'hbl-portal')) return;
    el.dataset.portalActive = id;
    el.style.viewTransitionName = `hbl-portal-${id}`;
  };
  // This script is parser-blocking in the head so native lifecycle listeners
  // exist before the first rendering opportunity. Arrival targets need the DOM.
  const markArrival = () => {
    let arrival;
    try { arrival = JSON.parse(sessionStorage.getItem(key)); } catch {}
    const here = location.pathname + location.search + location.hash;
    const arriving = arrival?.to === here && Date.now() - arrival.time < 30000;
    if (arriving) {
      mark(document.querySelector('#view, #app, main'), arrival.id);
      try { sessionStorage.removeItem(key); } catch {}
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markArrival, {once: true});
  else markArrival();
  // Disable even root animation for both OS and the existing local motion override.
  if (reduced()) {
    document.documentElement.classList.add('portal-reduced');
    const style = document.createElement('style');
    style.textContent = '@view-transition { navigation: none; }';
    document.head.append(style);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-portal-id]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || link.download || link.target && link.target !== '_self') return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    clear();
    const id = link.dataset.portalId;
    if (!/^[a-z0-9-]+$/.test(id)) return;
    mark(link.closest('[data-experience-id]')?.querySelector('.gallery-viewport') || link, id);
    try {
      sessionStorage.setItem(key, JSON.stringify({id, to: url.pathname + url.search + url.hash, time: Date.now()}));
      history.replaceState({...history.state, hblPortal: id}, '');
    } catch {} // Storage restrictions must never block navigation.
  });
  addEventListener('pageswap', event => {
    // A destination may deliberately omit transition opt-in (for example a
    // minimal viewer). Native capture cancellation must not reject unobserved.
    event.viewTransition?.ready.catch(() => {});
    event.viewTransition?.finished.catch(() => {});
  });
  addEventListener('pagereveal', event => {
    // A renderer-capability redirect can abort a cross-document capture.
    // Observe ready as well as finished so cancellation never leaks a rejection.
    event.viewTransition?.ready.catch(() => {});
    if (reduced()) event.viewTransition?.skipTransition();
    if (event.viewTransition) event.viewTransition.finished.then(clear, clear);
    else clear();
  });
  addEventListener('pageshow', event => { if (event.persisted || !('onpagereveal' in window)) clear(); });
})();
