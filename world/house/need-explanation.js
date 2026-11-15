/** Read-only explanation of inspected Population needs. Rates are not past deltas. */
export function houseNeedExplanation(person, key, minute) {
  const value = person?.needs?.[key], rate = person?.needRates?.[key];
  return {
    personId: person?.id ?? person?.personId ?? null,
    minute: Number.isFinite(minute) ? minute : null,
    value: Number.isFinite(value) ? value : null,
    rate: Number.isFinite(rate) ? rate : null,
    activity: person?.needActivity ?? null,
    source: person?.needsSource ?? 'Inspected Population needRates',
    history: 'Unknown: retained history does not record an exact need delta and its cause. Current rates and completed activities do not establish a past change.',
  };
}
export function mountNeedExplanation(container, {person, key, label, minute, onRequests} = {}) {
  const doc = container.ownerDocument, info = houseNeedExplanation(person, key, minute);
  const add = (tag, text, parent = container) => { const node = doc.createElement(tag); node.textContent = text; parent.append(node); return node; };
  add('p', 'Synthetic modeled need · not measured wellbeing or an internal emotion.');
  add('p', info.history);
  add('p', info.minute === null ? 'Population tick: unknown.' : 'Population clock: minute '+info.minute+' (modeled minutes).');
  const source = add('details', '');
  source.id = 'house-need-source-'+key;
  add('summary', 'Current inspection source', source);
  add('p', 'Resident '+(info.personId ?? 'unknown')+' · needs.'+key+' = '+(info.value ?? 'unknown'), source);
  add('p', 'needRates.'+key+' = '+(info.rate === null ? 'unknown' : info.rate+' points per modeled minute')+' · activity: '+(info.activity ?? 'unknown'), source);
  add('p', info.source, source);
  const link = add('a', 'Inspect current rate source'); link.href = '#'+source.id;
  link.onclick = () => {source.open = true; source.querySelector('summary').focus();};
  const request = add('button', 'Browse actions for '+label); request.type = 'button'; request.disabled = !onRequests; request.onclick = () => onRequests?.();
  add('p', 'Requests use current model availability. Opening this card or browsing actions does not change needs.');
  return info;
}
