/** Presentation-only thresholds: no velocity fling and at most one sibling. */
export function swipeStep(dx, dy, width) {
  return Math.abs(dx) >= Math.max(48, Math.min(100, width * .2)) && Math.abs(dx) > Math.abs(dy) * 1.25 ? (dx < 0 ? 1 : -1) : 0;
}

export function mountPreviewSwipe(rail, {getIndex, go, reduced}) {
  let drag = null, suppressUntil = 0;
  function finish(event, cancel = false) {
    if (!drag || event.pointerId !== drag.id) return;
    const previous = drag;
    drag = null;
    rail.classList.remove('is-dragging');
    previous.card.style.removeProperty('--drag-x');
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    if (previous.horizontal) {
      suppressUntil = performance.now() + 500;
      go(previous.index + (cancel ? 0 : swipeStep(previous.dx, previous.dy, previous.width)));
    }
  }
  rail.addEventListener('pointerdown', event => {
    if (drag) { finish({pointerId: drag.id}, true); return; }
    const card = event.target.closest('.gallery-card');
    if (!event.isPrimary || event.button !== 0 || !card || event.target.closest('a,button,input,select,textarea') || card.classList.contains('is-interactive')) return;
    drag = {id:event.pointerId, card, x:event.clientX, y:event.clientY, dx:0, dy:0, index:getIndex(), width:card.offsetWidth, horizontal:false};
  });
  rail.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dx = event.clientX - drag.x; drag.dy = event.clientY - drag.y;
    if (!drag.horizontal) {
      if (Math.abs(drag.dy) > 10 && Math.abs(drag.dy) >= Math.abs(drag.dx)) { finish(event, true); return; }
      if (Math.abs(drag.dx) < 10 || Math.abs(drag.dx) <= Math.abs(drag.dy) * 1.25) return;
      drag.horizontal = true;
      rail.setPointerCapture(event.pointerId);
      rail.classList.add('is-dragging');
    }
    if (!reduced()) drag.card.style.setProperty('--drag-x', `${Math.max(-100, Math.min(100, drag.dx * .45))}px`);
  });
  rail.addEventListener('pointerup', event => finish(event));
  rail.addEventListener('pointercancel', event => finish(event, true));
  rail.addEventListener('lostpointercapture', event => finish(event, true));
  rail.addEventListener('click', event => {
    if (performance.now() < suppressUntil && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  return () => { if (drag) finish({pointerId:drag.id}, true); };
}
