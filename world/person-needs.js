/** UI for actual simulation meters. No timers, need generation or wall-clock decay. */
export const PERSON_NEEDS = Object.freeze([
  { id: 'hunger', label: 'Food', icon: '◕', hint: 'Eating restores food satisfaction.' },
  { id: 'energy', label: 'Energy', icon: '☾', hint: 'Sleep and rest restore energy.' },
  { id: 'fun', label: 'Fun', icon: '★', hint: 'Recreation and enjoyable activities restore fun.' },
  { id: 'social', label: 'Connection', icon: '●', hint: 'Social activities restore connection.' },
]);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function personNeedRows(person) {
  return PERSON_NEEDS.map(definition => {
    const raw = person?.needs?.[definition.id];
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
    const rate = person?.needRates?.[definition.id];
    const knownRate = Number.isFinite(rate) ? ((value === 100 && rate > 0) || (value === 0 && rate < 0) ? 0 : rate) : null;
    return { ...definition, value, rate: knownRate,
      trend: knownRate === null ? 'unreported' : knownRate > 0.0001 && value < 100 ? 'rising' : knownRate < -0.0001 && value > 0 ? 'falling' : 'steady',
      level: value === null ? 'unavailable' : value < 25 ? 'low' : value < 55 ? 'medium' : 'high' };
  });
}
export function personNeedsMarkup(person, { paused = false } = {}) {
  const activity = person?.needActivity || person?.doing || person?.currentActivity || person?.activity || 'Current activity';
  const rows = personNeedRows(person);
  return `<section class="person-needs" data-person-needs aria-label="Person needs"><div class="person-needs-heading"><strong>Needs</strong><span>100 = satisfied</span></div><p class="person-needs-activity">${escape(activity)}${paused ? ' · paused' : ''}</p>${rows.map(row => {
    const trend = paused ? 'steady' : row.trend;
    const symbol = trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '—';
    const caption = paused ? 'Paused · needs hold steady' : row.rate === null ? row.hint : `${trend === 'rising' ? 'Restoring' : trend === 'falling' ? 'Using' : 'Steady'} · ${Math.abs(row.rate).toFixed(2)} points per modeled minute`;
    return `<div class="person-need ${row.level}" data-need="${row.id}" data-trend="${trend}" title="${escape(caption)}"><div class="person-need-label"><span aria-hidden="true">${row.icon}</span><span>${row.label}</span><output data-need-value="${row.id}">${row.value === null ? '—' : Math.round(row.value)}</output><span class="person-need-trend" aria-label="${escape(caption)}">${symbol}</span></div><div class="person-need-track" role="meter" aria-label="${row.label}" aria-valuemin="0" aria-valuemax="100" ${row.value === null ? 'aria-valuetext="Not modeled"' : `aria-valuenow="${Math.round(row.value)}"`}><i style="width:${row.value ?? 0}%"></i></div></div>`;
  }).join('')}<p class="person-needs-note">Modeled daily needs · activities restore them as simulation time advances.</p></section>`;
}
export function mountPersonNeeds({ container, person = null, paused = false } = {}) {
  if (!container?.ownerDocument) throw new TypeError('Person needs require a container.');
  const doc = container.ownerDocument, root = doc.createElement('div'), sheet = doc.createElement('link');
  sheet.rel = 'stylesheet'; sheet.href = new URL('./person-needs.css', import.meta.url).href;
  container.append(sheet, root);
  let destroyed = false, previous = '';
  function update(next = person, options = {}) {
    if (destroyed) return;
    person = next;
    const markup = personNeedsMarkup(next, { paused: options.paused ?? paused });
    if (markup !== previous) { root.innerHTML = markup; previous = markup; }
  }
  update(person, { paused });
  return { update, destroy() { destroyed = true; root.remove(); sheet.remove(); } };
}
