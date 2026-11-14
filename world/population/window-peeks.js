// Presentation only. A sampled resident supports their own activity, never an
// inferred whole-household count, real address, or furnished interior.
export function windowPeeks(frame, view, radius = 60) {
  if (frame?.schemaVersion !== 'population-snapshot.v1' || !Number.isInteger(frame.tick) ||
      !Number.isFinite(frame.minute) || !Number.isFinite(view?.x) || !Number.isFinite(view?.z)) return [];
  const households = new Set((frame.households || []).map(row => row.id));
  const seen = new Set();
  return (frame.visibleAgents || []).filter(row => {
    if (row.synthetic !== true || !households.has(row.householdId) || !row.homeId ||
        row.locationId !== row.homeId || row.currentActivity !== 'HOME' ||
        !Number.isFinite(row.x) || !Number.isFinite(row.z) ||
        Math.hypot(row.x - view.x, row.z - view.z) > radius || seen.has(row.householdId)) return false;
    seen.add(row.householdId); return true;
  }).slice(0, 3).map(row => Object.freeze({householdId: row.householdId,
    tick: frame.tick, minute: frame.minute, activity: row.currentActivity,
    // Whitelist fields: no names, finances, journals, or user-provided text.
    label: 'A sampled resident is at home'}));
}

export function mountWindowPeeks({container, document: doc = document}) {
  const root = doc.createElement('section'); root.className = 'lc-window-peeks';
  root.setAttribute('aria-label', 'Synthetic home window peeks');
  const note = doc.createElement('p');
  note.textContent = 'Cosmetic window cards · synthetic sampled activity. Unsupported interiors stay opaque.';
  const list = doc.createElement('div'), detail = doc.createElement('p');
  detail.setAttribute('role', 'status'); root.append(note, list, detail); container.append(root);
  let key = '', disposed = false;
  return {
    update(frame, view, active) {
      if (disposed) return;
      const rows = active ? windowPeeks(frame, view) : [];
      const next = JSON.stringify([frame?.runtime?.id, frame?.runtime?.revision, frame?.modelVersion, rows]); root.hidden = !active;
      if (next === key) return;
      const focusedIndex = [...list.children].indexOf(doc.activeElement);
      key = next; detail.textContent = ''; list.replaceChildren();
      if (!rows.length) { list.textContent = 'Opaque windows · no matched home activity nearby.'; return; }
      for (const row of rows) {
        const button = doc.createElement('button'); button.type = 'button';
        button.textContent = `▣ ${row.label} · tick ${row.tick}`;
        button.onclick = () => {
          if (disposed || !button.isConnected) return;
          detail.textContent = `Synthetic household ${row.householdId} · tick ${row.tick} · minute ${row.minute}. ${row.label}. Snapshot inspection only; no room or furniture is inferred.`;
        };
        list.append(button);
      }
      if (focusedIndex >= 0) list.children[Math.min(focusedIndex, list.children.length - 1)]?.focus({preventScroll:true});
    },
    destroy() { disposed = true; root.remove(); }
  };
}
