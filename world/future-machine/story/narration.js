/** Describe the same exact A/B records as the inspector, without inferring causes. */
export function describeModelChange(frame, diff, {collection, id} = {}) {
  const context = `Month ${frame?.month ?? 'unavailable'}: ${collection} ${id}.`;
  if (!frame?.baseline || !frame?.plan || !diff?.available) return `${context} Paired comparison unavailable.`;
  const row = diff.entities.find(row => row.collection === collection && row.id === id);
  if (!row) return `${context} No recorded difference between without plan and with plan.`;
  if (row.kind === 'added') return `${context} Present only with plan; absent without plan. This is an inventory difference.`;
  if (row.kind === 'removed') return `${context} Present only without plan; absent with plan. This is an inventory difference.`;
  const value = (record, field) => {
    if (!record || !Object.hasOwn(record, field) || record[field] === undefined) return 'unavailable';
    const v = record[field];
    if (v === null) return 'null';
    if (typeof v === 'object') return 'structured value changed; inspect exact record';
    if (typeof v === 'number' && !Number.isFinite(v)) return 'unavailable';
    const unit = collection === 'households' ? {income:' USD/month', savings:' USD'}[field] ?? '' : '';
    return String(v).slice(0, 100) + unit;
  };
  const fields = [...row.changedFields].sort();
  return `${context} ${fields.slice(0, 4).map(field => `${field}: without plan ${value(row.before, field)}; with plan ${value(row.after, field)}.`).join(' ')}${fields.length > 4 ? ` ${fields.length - 4} additional changed fields in the inspector.` : ''} Modeled comparison, not a causal explanation.`;
}

/** Persistent, initially empty live region. Only explicit requests may write it. */
export function mountChangeNarration(container) {
  const output = container.ownerDocument.createElement('p');
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  output.setAttribute('aria-atomic', 'true');
  output.dataset.testid = 'change-narration';
  container.append(output);
  let disposed = false;
  return {
    announce(text) { if (!disposed && output.textContent !== text) output.textContent = text; },
    dispose() { disposed = true; output.remove(); },
  };
}
