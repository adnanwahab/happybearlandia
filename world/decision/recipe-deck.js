// Presentation only. This order never enters simulation inputs.
export function createCardOrder(ids) {
  let order = [...ids], past = [], future = [];
  return {
    get ids() { return [...order]; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    move(id, delta) {
      const from = order.indexOf(id), to = from + delta;
      if (![-1, 1].includes(delta) || from < 0 || to < 0 || to >= order.length) return false;
      past.push([...order]); if (past.length > 50) past.shift(); future = [];
      [order[from], order[to]] = [order[to], order[from]]; return true;
    },
    undo() { if (!past.length) return false; future.push(order); order = past.pop(); return true; },
    redo() { if (!future.length) return false; past.push(order); order = future.pop(); return true; },
  };
}
export function mountRecipeDeck(container, histories, scenarioId, readonly) {
  const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
  const refreshers = [];
  for (const group of container.querySelectorAll('[data-control-group]')) {
    const cards = [...group.querySelectorAll('[data-parameter-id]')];
    const key = JSON.stringify([scenarioId, group.dataset.controlGroup]);
    if (!histories.has(key)) histories.set(key, createCardOrder(cards.map(c => c.dataset.parameterId)));
    const history = histories.get(key), toolbar = node('div', ''); toolbar.className = 'recipe-card-actions';
    const live = node('span', ''); live.setAttribute('role', 'status');
    const controls = [];
    const button = (label, action) => { const b = node('button', label); b.type = 'button'; b.addEventListener('click', action); return b; };
    const refresh = () => {
      history.ids.forEach(id => { const card = cards.find(c => c.dataset.parameterId === id); if (card) group.append(card); });
      undo.disabled = readonly() || !history.canUndo; redo.disabled = readonly() || !history.canRedo;
      for (const {b, id, delta} of controls) { const i = history.ids.indexOf(id); b.disabled = readonly() || i + delta < 0 || i + delta >= cards.length; }
    };
    const undo = button('Undo card move', () => { history.undo(); refresh(); live.textContent = 'Card move undone. Model inputs unchanged.'; });
    const redo = button('Redo card move', () => { history.redo(); refresh(); live.textContent = 'Card move redone. Model inputs unchanged.'; });
    toolbar.append(undo, redo, live); group.insertBefore(toolbar, cards[0] || null);
    for (const card of cards) {
      const id = card.dataset.parameterId, label = card.querySelector('label').textContent;
      const actions = node('div', ''); actions.className = 'recipe-card-actions';
      for (const [delta, direction] of [[-1, 'up'], [1, 'down']]) {
        const b = button(`Move ${direction}`, () => {
          history.move(id, delta); refresh();
          (b.disabled ? actions.querySelector('button:not(:disabled)') : b)?.focus();
          live.textContent = `${label} moved ${direction}. Display order only; model inputs unchanged.`;
        });
        b.setAttribute('aria-label', `Move ${label} ${direction}`); controls.push({b, id, delta}); actions.append(b);
      }
      card.prepend(actions);
    }
    refreshers.push(refresh); refresh();
  }
  return () => refreshers.forEach(refresh => refresh());
}
