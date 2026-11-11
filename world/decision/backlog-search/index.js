import { compileFutureSearch, futureOutcome } from '../visualizations.js';
export const SEARCH_VERSION = 'recorded-future-search.v1';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const normalize = value => String(value).toLowerCase().replace(/[_-]/g, ' ').trim();
const aliases = { rent: 'median_rent', cost: 'public_expenditure', supply: 'housing_supply', vacancy: 'vacancy_rate' };

/** Read-only Decision results adapter, compatible with visualization search.
 * No inference, provider calls, simulation execution or cross-model mapping.
 */
export function compileRecordedFutureSearch(query, metrics = [], selected = {}) {
  const fail = error => ({ version: SEARCH_VERSION, error, description: error, test: () => false,
    explain: () => ({ status: 'unsupported', reasons: [error], evidence: [] }) });
  if (typeof query !== 'string' || query.length > 1000) return fail('Use at most 1000 characters.');
  const scope = { ...selected }, rules = [];
  const clauses = query.trim() ? query.trim().split(/\s+and\s+/i) : [];
  if (clauses.length > 12) return fail('Use at most 12 AND clauses.');
  for (let clause of clauses) {
    clause = clause.replace(/^(show|find)\s+(me\s+)?/i, '').replace(/^(futures|worlds)\s+(where|with|that have)\s+/i, '').trim();
    const scoped = clause.match(/^(scenario|seed|model version|at month)\s*(?:=\s*)?([\w.-]+)$/i);
    if (scoped) {
      const key = { scenario: 'scenarioId', seed: 'seed', 'model version': 'modelVersion', 'at month': 'month' }[scoped[1].toLowerCase()];
      const value = ['month', 'seed'].includes(key) ? Number(scoped[2]) : scoped[2];
      if (scope[key] !== undefined && scope[key] !== value) return fail(`Query conflicts with selected ${key}.`);
      scope[key] = value; continue;
    }
    const event = clause.match(/^events?\s*:\s*(.+)$/i);
    if (event) { rules.push({ kind: 'event', phrase: normalize(event[1]) }); continue; }
    if (/^(success(es|ful)?|failures?|mixed|unclassified)$/i.test(clause)) {
      if (/^unclassified$/i.test(clause)) rules.push({ kind: 'unclassified' });
      else rules.push({ kind: 'outcome', compiled: compileFutureSearch(clause, metrics) });
      continue;
    }
    const match = clause.match(/^(.+?)\s*(<=|>=|<|>|=|below|under|less than|above|over|greater than|at least|at most)\s*(\$?)(-?(?:\d+(?:,\d{3})*)(?:\.\d+)?)([kmb])?\s*(.*?)$/i);
    if (!match) return fail(`Unsupported clause “${clause}”. Use a metric comparison or event: phrase.`);
    const needle = normalize(match[1]);
    let candidates = metrics.filter(metric => metric.id === aliases[needle] || normalize(metric.id) === needle || normalize(metric.label) === needle);
    if (!candidates.length) candidates = metrics.filter(metric => normalize(metric.id).includes(needle) || normalize(metric.label).includes(needle));
    if (candidates.length !== 1) return fail(`Unknown or ambiguous metric “${match[1]}”. Use its exact ID.`);
    const metric = candidates[0], unit = match[6].trim(), declared = String(metric.unit || '');
    if (match[3] && !/^USD(?:\/|$)/.test(declared)) return fail(`$ is incompatible with ${metric.id} (${declared}).`);
    if (unit && !(unit === '%' && ['fraction', 'probability', '%'].includes(declared)) && unit.toLowerCase() !== declared.toLowerCase()) return fail(`Expected ${metric.id} in ${declared}; received ${unit}.`);
    const threshold = Number(match[4].replaceAll(',', '')) * ({ k: 1e3, m: 1e6, b: 1e9 }[match[5]?.toLowerCase()] || 1) / (unit === '%' && ['fraction', 'probability'].includes(declared) ? 100 : 1);
    if (!finite(threshold)) return fail('Threshold must be finite.');
    // Delegate supported numeric semantics to the existing compiler, with exact ID.
    const compiled = compileFutureSearch(`${metric.id} ${match[2]} ${threshold}`, metrics);
    if (compiled.error) return fail(compiled.error);
    rules.push({ kind: 'metric', metricId: metric.id, unit: declared, operator: match[2], threshold, compiled });
  }
  for (const [key, max] of [['month', 600], ['seed', 0xffffffff]]) if (scope[key] !== undefined && (!Number.isInteger(scope[key]) || scope[key] < 0 || scope[key] > max)) return fail(`Selected ${key} must be an integer from 0 to ${max}.`);
  function explain(run, scenario = {}) {
    const evidence = [];
    const record = (status, detail) => evidence.push({ status, ...detail });
    if (!['completed', 'successful', 'success', 'succeeded'].includes(run?.status)) record('missing', { reason: 'Run is not completed.' });
    for (const key of ['scenarioId', 'seed', 'modelId', 'modelVersion']) if (scope[key] !== undefined) record(run?.[key] === undefined ? 'missing' : run[key] === scope[key] ? 'match' : 'excluded', { field: key, expected: scope[key], actual: run?.[key] });
    const snapshots = scope.month === undefined ? null : (Array.isArray(run?.monthlyTimeline) ? run.monthlyTimeline : run?.timeline || []).filter(row => row.month === scope.month || (row.month === undefined && row.year * 12 === scope.month));
    const values = snapshots === null ? run?.metrics : snapshots.length === 1 ? snapshots[0].metrics : null;
    if (snapshots && snapshots.length !== 1) record('missing', { reason: 'Exactly one recorded snapshot is required.', month: scope.month });
    for (const rule of rules) {
      const { compiled, ...detail } = rule;
      if (rule.kind === 'metric') record(!finite(values?.[rule.metricId]) ? 'missing' : compiled.test({ metrics: values }) ? 'match' : 'excluded', { ...detail, value: values?.[rule.metricId], month: scope.month ?? 'final' });
      if (rule.kind === 'outcome' || rule.kind === 'unclassified') {
        if (scope.month !== undefined) record('missing', { reason: 'Outcome classification is final-only.' });
        else if (rule.kind === 'unclassified') record(futureOutcome(run, scenario) === 'unclassified' ? 'match' : 'excluded', detail);
        else record(compiled.test(run, scenario) ? 'match' : 'excluded', detail);
      }
      if (rule.kind === 'event') {
        if (!Array.isArray(run?.events)) { record('missing', { ...detail, reason: 'No recorded event collection.' }); continue; }
        const eligible = run.events.filter(event => scope.month === undefined || (finite(event.month) ? event.month : finite(event.year) ? event.year * 12 : Infinity) <= scope.month);
        const matches = eligible.filter(event => normalize(typeof event === 'string' ? event : [event.type, event.label, event.message, event.description].filter(Boolean).join(' ')).includes(rule.phrase));
        const undated = scope.month !== undefined && run.events.some(event => !finite(event?.month) && !finite(event?.year));
        record(matches.length ? 'match' : undated ? 'missing' : 'excluded', { ...detail, events: matches, ...(undated && !matches.length ? { reason: 'Undated events cannot be placed before the selected month.' } : {}) });
      }
    }
    return { status: evidence.some(item => item.status === 'excluded') ? 'excluded' : evidence.some(item => item.status === 'missing') ? 'missing' : 'match', version: SEARCH_VERSION,
      source: { runId: run?.id, experimentId: run?.experimentId, scenarioId: run?.scenarioId, seed: run?.seed, modelId: run?.modelId, modelVersion: run?.modelVersion, month: scope.month ?? 'final' }, evidence };
  }
  return { version: SEARCH_VERSION, scope, rules: rules.map(({ compiled, ...rule }) => rule), description: `Recorded futures; ${scope.month === undefined ? 'final metrics' : `exact month ${scope.month}`}; ${rules.length} conditions. No forecast generated.`, explain, test: (run, scenario) => explain(run, scenario).status === 'match' };
}

/** Search a loaded Decision store/API record. Bounds are explicit: never sample
 * away records, rerun a future, or mistake an unfinished job for saved evidence.
 */
export function searchStoredDecisionResults(record, query, metrics, selected = {}) {
  if (!Array.isArray(record?.runs) || record.runs.length > 8000) throw new Error('Expected at most 8000 loaded Decision runs.');
  const compiled = compileRecordedFutureSearch(query, metrics, selected);
  if (compiled.error) return { version: SEARCH_VERSION, error: compiled.error, results: [] };
  const experiment = record.experiment || {};
  const scenarios = new Map((experiment.scenarios || []).map(scenario => [scenario.id, scenario]));
  return { version: SEARCH_VERSION, description: compiled.description, results: record.runs.map(run => {
    const scoped = { modelId: experiment.modelId, modelVersion: experiment.modelVersion, experimentId: experiment.id, ...run };
    return { run, ...compiled.explain(scoped, scenarios.get(run.scenarioId)) };
  }) };
}
