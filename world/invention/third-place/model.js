// Authored design arithmetic only. No resident, visitation or relationship model.
export const VERSION = 'third-place-design.v1';
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const SCENARIO = freeze({
  id: 'empty-lot.v1', source: 'authored-synthetic', seed: 708,
  lotId: 'third-place-lot-1', areaM2: 400, budgetUSD: 100000,
  permitted: ['park', 'plaza'],
});
// Illustrative public costs, assumed immediate delivery and one year of upkeep.
// These are author inputs, not estimates from a municipal source or City spending.
export const PROJECTS = freeze({
  park: { label: 'Pocket park', areaM2: 300, capitalUSD: 60000, annualUpkeepUSD: 6000 },
  plaza: { label: 'Neighborhood plaza', areaM2: 400, capitalUSD: 80000, annualUpkeepUSD: 10000 },
});
const unavailable = freeze({
  visits: { status: 'unavailable', value: null, reason: 'No project-driven visitation model.' },
  social: { status: 'unavailable', value: null, reason: 'No project-driven relationship model.' },
  measured: { status: 'unavailable', value: null, reason: 'No measured observations supplied.' },
});
export function validateProject(project, source = SCENARIO) {
  if (!source) throw new Error('No source data. Load the pinned authored demo.');
  if (canonical(source) !== canonical(SCENARIO)) throw new Error('Unsupported source or scenario revision.');
  if (typeof project !== 'string' || !Object.hasOwn(PROJECTS, project) || !source.permitted.includes(project)) throw new Error('Project is not permitted on this authored lot.');
  const option = PROJECTS[project];
  if (option.areaM2 > source.areaM2 || option.capitalUSD + option.annualUpkeepUSD > source.budgetUSD) throw new Error('Project exceeds lot area or first-year public budget.');
  return option;
}
export function compareProject(project, source = SCENARIO) {
  const option = validateProject(project, source);
  const context = { version: VERSION, scenarioId: source.id, source: source.source, seed: source.seed, lotId: source.lotId };
  return freeze({
    version: VERSION, project, scenario: structuredClone(source),
    before: { ...context, checkpoint: 'before', project: 'empty', capitalUSD: 0, annualUpkeepUSD: 0, firstYearUSD: 0, remainingUSD: source.budgetUSD, outcomes: unavailable },
    after: { ...context, checkpoint: 'after', project, capitalUSD: option.capitalUSD, annualUpkeepUSD: option.annualUpkeepUSD, firstYearUSD: option.capitalUSD + option.annualUpkeepUSD, remainingUSD: source.budgetUSD - option.capitalUSD - option.annualUpkeepUSD, outcomes: unavailable },
  });
}
// Fixed field ordering makes comparison independent of JSON object key order.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function replayComparison(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 8192) throw new Error('Replay must be JSON under 8192 bytes.');
  let recorded;
  try { recorded = JSON.parse(text); } catch { throw new Error('Invalid replay JSON.'); }
  if (!recorded || recorded.version !== VERSION) throw new Error('Replay version mismatch.');
  const recomputed = compareProject(recorded.project, recorded.scenario);
  if (canonical(recorded) !== canonical(recomputed)) throw new Error('Replay mismatch. No results loaded.');
  return recomputed;
}
