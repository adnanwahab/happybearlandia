/** Paired synthetic actor differences. Never scale a visible sample to a city. */
const FIELDS = ['mode','currentMode','homeDistrictId','homeDistrict','workDistrictId','workDistrict','income','rent','commuteMinutes','satisfaction','affordabilityStress','displacementRisk','displaced'];
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function checkedRows(rows) {
  if (!Array.isArray(rows) || rows.length > 100000) throw new TypeError('Supply at most 100,000 explicit actor records.');
  const map = new Map();
  for (const row of rows) {
    const id = row?.id ?? row?.personId;
    if (typeof id !== 'string' || !id || map.has(id)) throw new TypeError('Actor records need unique string IDs.');
    map.set(id, row);
  }
  return map;
}
function identity(manifest) {
  const config = manifest?.config ?? manifest;
  return { modelVersion: manifest?.modelVersion, seed: config?.seed, snapshotId: config?.snapshotId, population: config?.population };
}
function stateOf(row) {
  return Object.fromEntries(FIELDS.filter(field => row[field] !== undefined).map(field => [field, structuredClone(row[field])]));
}
export function compareBehaviorActors({ baseline, treatment, baselineScenarioId, treatmentScenarioId, baselineManifest, treatmentManifest } = {}) {
  if (typeof baselineScenarioId !== 'string' || !baselineScenarioId || typeof treatmentScenarioId !== 'string' || !treatmentScenarioId || baselineScenarioId === treatmentScenarioId) throw new TypeError('Supply distinct scenario IDs.');
  const initial = identity(baselineManifest), next = identity(treatmentManifest);
  for (const field of Object.keys(initial)) {
    if (initial[field] === undefined || initial[field] === null || !equal(initial[field], next[field])) throw new Error(`Incompatible or missing paired identity: ${field}`);
  }
  const leftConfig = baselineManifest?.initialPopulationConfig ?? baselineManifest?.config ?? baselineManifest;
  const rightConfig = treatmentManifest?.initialPopulationConfig ?? treatmentManifest?.config ?? treatmentManifest;
  for (const field of ['householdSize','medianIncome','incomeSpread','employmentRate','representedPopulation']) {
    if ((leftConfig?.[field] !== undefined || rightConfig?.[field] !== undefined) && !equal(leftConfig?.[field], rightConfig?.[field])) throw new Error(`Incompatible initial population: ${field}`);
  }
  const before = checkedRows(baseline), after = checkedRows(treatment), rows = [];
  let matched = 0, unmatchedBaseline = 0, unknownWeights = 0, matchedWeight = 0, changedWeight = 0, unchanged = 0;
  const counts = { modeChanged: 0, housingChanged: 0, workChanged: 0, displacementRiskChanged: 0 };
  const weighted = { modeChanged: 0, housingChanged: 0, workChanged: 0, displacementRiskChanged: 0 };
  for (const [id, left] of before) {
    const right = after.get(id);
    if (!right) { unmatchedBaseline++; continue; }
    matched++;
    const validWeight = Number.isFinite(left.weight) && left.weight > 0 && left.weight === right.weight;
    if (validWeight) matchedWeight += left.weight; else unknownWeights++;
    const baselineState = stateOf(left), treatmentState = stateOf(right);
    const changedFields = FIELDS.filter(field => left[field] !== undefined && right[field] !== undefined && !equal(left[field], right[field]));
    const changedDecisionTypes = [];
    const changes = {
      modeChanged: changedFields.some(field => ['mode','currentMode'].includes(field)),
      housingChanged: changedFields.some(field => ['homeDistrictId','homeDistrict'].includes(field)),
      workChanged: changedFields.some(field => ['workDistrictId','workDistrict'].includes(field)),
      displacementRiskChanged: changedFields.includes('displacementRisk'),
    };
    for (const [name, changed] of Object.entries(changes)) if (changed) { counts[name]++; if (validWeight) weighted[name] += left.weight; }
    if (changes.modeChanged) changedDecisionTypes.push('mode-state');
    if (changes.housingChanged) changedDecisionTypes.push('housing-state');
    if (changes.workChanged) changedDecisionTypes.push('employment-location-state');
    if (!changedFields.length) { unchanged++; continue; }
    if (validWeight) changedWeight += left.weight;
    rows.push({ schemaVersion: 'behavior-delta.v1', actorId: id, baselineScenarioId, treatmentScenarioId, baselineState, treatmentState, changedFields, changedDecisionTypes, weight: validWeight ? left.weight : null });
  }
  return { schemaVersion: 'behavior-comparison.v1', identity: initial, rows,
    summary: { matched, changed: rows.length, unchanged, unmatchedBaseline, unmatchedTreatment: [...after.keys()].filter(id => !before.has(id)).length, counts,
      weightedCounts: unknownWeights ? null : weighted, matchedWeight: unknownWeights ? null : matchedWeight, changedWeight: unknownWeights ? null : changedWeight, unknownWeights },
    limitations: ['Compares supplied actor records only; a bounded sample is not a citywide total.', 'State differences do not establish a specific decision cause; inspect actual DecisionEvent records.', 'Displacement risk is reported separately from an observed modeled displacement move.', ...(unknownWeights ? ['Weighted totals unavailable: paired actor weights are missing or inconsistent.'] : [])] };
}
