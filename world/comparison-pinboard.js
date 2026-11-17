/** Presentation-only, capture-time records. Never steps or mutates a model. */
const schemas = {
  building: [['area', 'Footprint area', 'm²'], ['height', 'Scene height (illustrative)', 'm'], ['levels', 'Supplied levels', 'levels']],
  person: [['age', 'Age', 'years'], ['energy', 'Energy', 'points / 100'], ['social', 'Social', 'points / 100'], ['fun', 'Fun', 'points / 100']],
};
export function spatialRecord(town, world, type, id) {
  const row = (type === 'building' ? town.buildings : type === 'person' ? world.people : [])?.find(row => String(row.id) === String(id));
  if (!row) return null;
  const provenance = world.getActivitySnapshot?.() ?? {};
  return {type, id: String(row.id), name: row.name ?? String(row.id), authority: 'legacy-world',
    modelVersion: world.modelVersion, runId: provenance.runId ?? null, seed: provenance.seed ?? null, townSeed: town.seedKey, minute: world.t,
    source: type === 'building' ? `${town.source ?? 'unknown'} footprint; synthetic scene attributes` : 'Synthetic resident',
    fields: Object.fromEntries(schemas[type].map(([key]) => [key, (type === 'person' && key !== 'age' ? row.needs?.[key] : row[key]) ?? null]))};
}
export function comparisonRows(a, b) {
  if (!a || !b) return {limitation: 'Select two objects to compare.', rows: []};
  if (a.type !== b.type || a.authority !== b.authority) return {limitation: 'Different entity types or model authorities: fields cannot be compared. Clear a pin and choose the same type.', rows: []};
  return {limitation: 'Capture-time values; clocks may differ. This is not a causal or matched-run comparison.',
    rows: (schemas[a.type] ?? []).map(([key, label, unit]) => ({label, unit, values: [a.fields[key], b.fields[key]].map(value => Number.isFinite(value) ? value : null)}))};
}
export function createPinboard() {
  let pins = [null, null], active = false;
  return {
    isActive: () => active,
    state: () => ({pins: structuredClone(pins), active}),
    start() { active = true; },
    stop() { active = false; },
    capture(record) {
      if (!active || !record || !schemas[record.type]) return false;
      if (pins.some(pin => pin && pin.id === record.id && pin.type === record.type && pin.authority === record.authority)) return false;
      const slot = pins.findIndex(pin => !pin);
      if (slot < 0) return false;
      pins[slot] = structuredClone(record);
      if (pins.every(Boolean)) active = false;
      return true;
    },
    clear(slot) { if (slot === 0 || slot === 1) pins[slot] = null; active = false; },
  };
}
export function mountComparisonPinboard(host, {resolve, available = () => true} = {}) {
  if (!host) return {observe() {}};
  const doc = host.ownerDocument, board = createPinboard();
  const anchor = doc.createComment('comparison pinboard home'); host.before(anchor);
  host.innerHTML = `<details data-comparison-pinboard><summary>Compare two objects</summary>
    <p>Pin two scene selections, or enter their exact source IDs. Values are captured independently; simulation keeps running.</p>
    <button type="button" data-capture>Start pinning</button>
    <form><label>Entity type <select name="type"><option value="building">Building</option><option value="person">Resident</option></select></label>
    <label>Source ID <input type="text" name="id" required autocomplete="off" maxlength="256"></label><button>Pin ID</button></form>
    <p role="status" aria-live="polite" data-pin-status></p><div data-pins></div><div data-fields></div></details>`;
  const button = host.querySelector('[data-capture]'), status = host.querySelector('[data-pin-status]');
  const render = (message = '') => {
    const {pins, active} = board.state();
    const focused = host.contains?.(doc.activeElement) ? doc.activeElement : null;
    const floating = active || pins.some(Boolean);
    if (floating && host.parentNode !== doc.body) doc.body.append(host);
    else if (!floating && host.parentNode !== anchor.parentNode) anchor.parentNode.insertBefore(host, anchor.nextSibling);
    host.classList.toggle('has-pins', floating);
    host.querySelector('summary').textContent = 'Compare two objects' + pins.map((pin,i)=>pin ? ` · ${i===0?'A':'B'}: ${pin.id}` : '').join('');
    button.textContent = active ? 'Stop pinning' : 'Start pinning'; button.setAttribute('aria-pressed', String(active));
    button.disabled = pins.every(Boolean);
    status.textContent = message || (active ? 'Select the next object in the scene.' : pins.every(Boolean) ? 'Two pins kept. Normal selection restored.' : 'No capture active. Normal selection available.');
    const cards = host.querySelector('[data-pins]'); cards.replaceChildren();
    pins.forEach((pin, i) => {
      const card = doc.createElement('section'), title = doc.createElement('p');
      title.textContent = `${i === 0 ? 'A' : 'B'}: ${pin ? `${pin.type} ${pin.id} · ${pin.name}` : 'Empty'}`; card.append(title);
      if (pin) {
        const meta = doc.createElement('p'); meta.textContent = `${pin.source} · ${pin.authority} · run ${pin.runId ?? 'unavailable'} · model ${pin.modelVersion ?? 'unavailable'} · seed ${pin.seed ?? 'unavailable'} · town seed ${pin.townSeed ?? 'unavailable'} · minute ${pin.minute ?? 'unavailable'}`; card.append(meta);
        const clear = doc.createElement('button'); clear.type = 'button'; clear.textContent = `Clear ${i === 0 ? 'A' : 'B'}`;
        clear.onclick = () => { board.clear(i); render(); button.focus(); }; card.append(clear);
      }
      cards.append(card);
    });
    const fields = host.querySelector('[data-fields]'); fields.replaceChildren();
    const result = comparisonRows(...pins), note = doc.createElement('p'); note.textContent = result.limitation; fields.append(note);
    if (result.rows.length) {
      const table = doc.createElement('table'), caption = doc.createElement('caption'); caption.textContent = 'Matched fields (Unavailable means missing, never zero)'; table.append(caption);
      const head = doc.createElement('thead'); head.innerHTML = '<tr><th scope="col">Field / unit</th><th scope="col">A</th><th scope="col">B</th></tr>'; table.append(head);
      const body = doc.createElement('tbody');
      for (const row of result.rows) { const tr = doc.createElement('tr'), label = doc.createElement('th'); label.scope = 'row'; label.textContent = `${row.label} (${row.unit})`; tr.append(label);
        for (const value of row.values) { const td = doc.createElement('td'); td.textContent = value === null ? 'Unavailable' : String(Math.round(value * 100) / 100); tr.append(td); } body.append(tr); }
      table.append(body); fields.append(table);
    }
    if (focused?.isConnected) focused.focus({preventScroll:true});
  };
  function observe(type, id) {
    if (!board.isActive()) return;
    if (!available()) { render('Unavailable for the active model. Legacy and Population identities are not mapped.'); return; }
    const record = resolve(type, id);
    if (!record) { render('Object unavailable or unsupported. Existing pins retained.'); return; }
    render(board.capture(record) ? '' : 'Already pinned. Choose a different source ID.');
  }
  button.onclick = () => { if (board.state().active) board.stop(); else board.start(); render(); };
  host.querySelector('form').onsubmit = event => { event.preventDefault(); const form = event.currentTarget;
    if (board.state().pins.every(Boolean)) { render('Both slots are full. Clear a pin first.'); return; }
    board.start(); observe(form.elements.type.value, form.elements.id.value.trim()); };
  render(); return {observe};
}
