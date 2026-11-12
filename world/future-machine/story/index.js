/** Deterministic interpretation of recorded monthly City comparisons. No simulation. */
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const clone = value => structuredClone(value);
const key = row => `${row.collection}:${row.entityId}:${row.kind || ''}`;
const physical = row => ['buildings', 'links'].includes(row.collection);

/** Frames are {month, changes: [{collection, entityId, kind, fields?}]}. */
export function selectChanges(frames, {limit = 6} = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid story limit');
  const seen = new Set();
  const ordered = [...frames].sort((a, b) => a.month - b.month);
  for (const frame of ordered) {
    if (!Number.isInteger(frame.month) || frame.month < 0 || frame.month > 120 || seen.has(frame.month)) throw new Error('Invalid or duplicate comparison month');
    seen.add(frame.month);
  }
  const candidates = ordered.flatMap(frame => (frame.changes || []).map(change => {
    if (!change.collection || typeof change.entityId !== 'string' || !change.entityId) throw new Error('Change requires exact City entity ID');
    // Structural changes rank above field changes. No incomparable currency/length sum.
    const fieldCount = Array.isArray(change.fields) ? change.fields.length : Object.keys(change.fields || {}).length;
    return {...clone(change), month: frame.month, significance: ['added', 'removed'].includes(change.kind) ? (physical(change) ? 2000 : 1000) + fieldCount : Math.max(1, fieldCount)};
  }));
  const chronological = (a, b) => a.month - b.month || compare(key(a), key(b));
  candidates.sort(chronological);
  if (!candidates.length) return {status: 'no-change', first: null, significant: [], stops: [], physicalStatus: 'no-physical-change'};
  const first = candidates[0];
  const ranked = [...candidates].sort((a, b) => b.significance - a.significance || chronological(a, b));
  const unique = new Map();
  for (const row of ranked) if (!unique.has(key(row))) unique.set(key(row), row);
  const significant = [...unique.values()];
  const stops = [first, ...significant.filter(row => key(row) !== key(first))].slice(0, limit);
  return {status: 'changed', first, significant: significant.slice(0, limit), stops, physicalStatus: candidates.some(physical) ? 'physical-change' : 'no-physical-change'};
}

/** Accept mapping only from the scene's exact collection+City ID lookup. */
export function directorCommand(change, mapping = []) {
  if (!change) return {status: 'no-change', month: null, camera: null, highlight: null};
  const matches = mapping.filter(row => row.collection === change.collection && row.entityId === change.entityId);
  const mapped = matches.length === 1 ? matches[0] : null;
  const position = mapped?.position;
  const valid = mapped && ['synthetic', 'sourced'].includes(mapped.provenance) && position && ['x', 'y', 'z'].every(axis => Number.isFinite(position[axis]));
  return {status: valid ? 'mapped' : 'unlocated', month: change.month,
    entity: {collection: change.collection, entityId: change.entityId},
    camera: valid ? {position: clone(position), provenance: mapped.provenance} : null,
    highlight: valid ? {collection: change.collection, entityId: change.entityId} : null,
    message: valid ? `${mapped.provenance === 'synthetic' ? 'Synthetic layout' : 'Sourced geometry'}; modeled City change.` : 'No unambiguous spatial mapping. Inspect this change without moving the camera.'};
}

const payloadKeys = {households: 'householdId', projects: 'projectId', buildings: 'buildingId', businesses: 'businessId', workers: 'workerId', links: 'linkId', policies: 'policyId', facilities: 'facilityId'};
function matchesEntity(event, change) {
  return event.entity?.collection === change.collection && event.entity?.entityId === change.entityId
    || (payloadKeys[change.collection] && event.payload?.[payloadKeys[change.collection]] === change.entityId)
    || (change.collection === 'districts' && event.geographyId === change.entityId);
}

/** Event IDs are scoped by future: City event IDs may repeat across A and B. */
export function explainChange(change, {a = [], b = []} = {}) {
  if (!change) return {status: 'no-change', receipts: [], text: 'No recorded differences in the supplied months.', uncertainty: ['Only supplied comparison months were inspected.']};
  const receipts = ['a', 'b'].flatMap(future => ({a, b}[future] || []).filter(event =>
    event.simulationTime === change.month && typeof event.id === 'string' && matchesEntity(event, change)
  ).map(event => ({future, eventId: event.id, month: event.simulationTime,
    entity: {collection: change.collection, entityId: change.entityId}, type: event.eventType,
    modelVersion: event.modelVersion ?? null, payload: clone(event.payload || {}),
    dependencies: clone(event.dependencies || [])}))).sort((x, y) => compare(x.future, y.future) || compare(x.eventId, y.eventId));
  return {status: receipts.length ? 'recorded-events' : 'missing-events', month: change.month,
    entity: {collection: change.collection, entityId: change.entityId}, receipts,
    text: `Month ${change.month}: ${change.collection} ${change.entityId} differs between the modeled futures.${receipts.length ? ' Related recorded events are listed.' : ' No matching entity event was supplied.'}`,
    uncertainty: ['Narrative interpretation of model records; not an empirical forecast.', 'Related events alone do not establish the cause of an A/B difference.', ...(receipts.some(row => !row.dependencies.length) || !receipts.length ? ['Recorded causal dependencies are unavailable for one or more receipts.'] : [])]};
}

/** Household IDs belong exclusively to monthly City; absent rows remain absent. */
export function householdImpact(a, b, householdId) {
  if (!a || !b || a.month !== b.month || !Number.isInteger(a.month)) throw new Error('Household impact requires matched monthly City snapshots');
  if (a.schemaVersion !== 'CityState.v1' || b.schemaVersion !== 'CityState.v1') throw new Error('Monthly City authority required');
  if (typeof householdId !== 'string' || !householdId) throw new Error('Exact household ID required');
  function observation(state) {
    const rows = state.households.filter(row => row.id === householdId);
    if (rows.length > 1) throw new Error('Ambiguous household ID');
    const h = rows[0];
    if (!h) return null;
    const unit = state.units.find(row => row.id === h.unitId && row.householdId === householdId);
    return {householdId, districtId: h.districtId, unitId: h.unitId ?? null, income: h.income, savings: h.savings, housingBurden: h.housingBurden ?? null, rent: unit?.rent ?? null};
  }
  const baseline = observation(a), plan = observation(b);
  const deltas = Object.fromEntries(['income', 'savings', 'housingBurden', 'rent'].map(field => [field,
    Number.isFinite(baseline?.[field]) && Number.isFinite(plan?.[field]) ? plan[field] - baseline[field] : null]));
  return {authority: 'monthly-city', month: a.month, householdId, status: baseline && plan ? 'matched' : 'missing-household', baseline, plan, deltas,
    uncertainty: ['Exact monthly City household identity only; no Population or House Simulator identity is inferred.', 'Missing rent or household records are unavailable, not zero.']};
}

const limits = ['Narrative interpretation of monthly City model results; not an empirical forecast.', 'Event association does not establish causation. Missing mapping or evidence remains unavailable.'];
const normalizedDiffs = diffs => diffs.filter(frame => frame.available).map(frame => ({month: frame.month, changes: frame.entities.map(row => ({...row, entityId: row.id, fields: row.changedFields}))}));
function description(frame, entity) {
  const change = {month: frame.month, collection: entity.collection, entityId: entity.id};
  const explanation = explainChange(change, {a: frame.baseline?.events, b: frame.plan?.events});
  const result = {title: `${entity.collection} ${entity.id} · Month ${frame.month}`, summary: explanation.text, evidence: explanation.receipts, limitations: [...explanation.uncertainty]};
  if (entity.collection === 'households' && frame.baseline && frame.plan) {
    result.impact = householdImpact(frame.baseline.state, frame.plan.state, entity.id);
    result.summary += ` Household observations: ${['income', 'savings', 'rent', 'housingBurden'].map(field => `${field} B−A ${result.impact.deltas[field] ?? 'unavailable'}`).join('; ')}.`;
  }
  return result;
}

export function buildStory(history, diffs) {
  const selected = selectChanges(normalizedDiffs(diffs));
  const stops = selected.stops.map((change, index) => {
    const entity = {collection: change.collection, id: change.entityId};
    const frame = {month: change.month, baseline: history.baseline.find(row => row.month === change.month), plan: history.plan.find(row => row.month === change.month)};
    const detail = description(frame, entity);
    return {month: change.month, title: `${index === 0 ? 'First divergence' : 'Significant change'} · ${entity.collection} ${entity.id}`, summary: detail.summary, entity, evidence: detail.evidence, limitations: detail.limitations};
  });
  return {stops, summary: selected.status === 'no-change' ? 'No recorded differences in available paired months.' : `${stops.length} selected modeled changes. ${selected.physicalStatus === 'no-physical-change' ? 'No physical building or link change was recorded.' : 'Building or link differences are available for inspection.'}`,
    limitations: [...limits, 'Significance ranks physical additions/removals first, then other additions/removals and changed-field count; repeated entity/kind changes are deduplicated; ties use month and exact ID; it is an editorial rule, not a causal or welfare score.', ...(diffs.some(row => !row.available) ? ['Some paired months are unavailable; first divergence is only among available months.'] : [])]};
}

export function describeSelection(frame, diff, {collection, id, arm} = {}) {
  if (!frame || !diff?.available) return {title: 'Unavailable month', summary: 'Both monthly snapshots are required.', evidence: [], limitations: [...limits]};
  if (!collection || !id) return {title: 'No selection', summary: 'Select an exact monthly City entity.', evidence: [], limitations: [...limits]};
  const result = description(frame, {collection, id});
  const changed = diff.entities.some(row => row.collection === collection && row.id === id);
  if (!changed) result.summary = `No recorded A/B difference for ${collection} ${id} at Month ${frame.month}.`;
  if (arm) result.selectedArm = arm;
  return result;
}

/** DOM uses textContent exclusively: payload strings never become markup. */
export function renderStory(container, description, {onJump, onNarrate} = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  const listeners = [];
  function text(tag, value, parent = root) { const element = doc.createElement(tag); element.textContent = value; parent.append(element); return element; }
  if (onNarrate) {
    const button = text('button', 'Describe selected change');
    button.type = 'button';
    button.addEventListener('click', onNarrate); listeners.push([button, onNarrate]);
  }
  text('h2', description.title || 'Show Me What Changed');
  text('p', `Narrative interpretation: ${description.summary}`);
  for (const stop of description.stops || []) {
    const button = text('button', `${stop.title} · Month ${stop.month}`);
    button.type = 'button';
    const handler = () => onJump?.(stop);
    button.addEventListener('click', handler); listeners.push([button, handler]);
    text('p', stop.summary);
  }
  const evidence = description.evidence || (description.stops || []).flatMap(stop => stop.evidence);
  const receipts = text('details', '');
  text('summary', `Recorded model events (${evidence.length})`, receipts);
  if (!evidence.length) text('p', 'No matching entity events supplied. Causal explanation unavailable.', receipts);
  for (const receipt of evidence) text('pre', JSON.stringify(receipt, null, 2), receipts);
  for (const limitation of description.limitations || []) text('p', limitation);
  container.replaceChildren(root);
  return () => { for (const [button, handler] of listeners) button.removeEventListener('click', handler); root.remove(); };
}
