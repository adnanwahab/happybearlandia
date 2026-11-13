const clone = value => structuredClone(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const unique = rows => new Set(rows.map(row => row.id)).size === rows.length;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Strict interchange boundary; missing evidence is valid data, malformed sources are not. */
export function createResearchLibrary({ id, modelVersion, sources = [], rules = [], limitations = [] }) {
  if (!text(id) || !text(modelVersion)) throw new Error('Library id and modelVersion are required.');
  if (!Array.isArray(sources) || !Array.isArray(rules) || !Array.isArray(limitations) || !limitations.every(text)) throw new Error('Invalid library collections.');
  for (const source of sources) {
    if (!source || !['paper', 'model', 'dataset', 'observation'].includes(source.kind) || !text(source.id) || !text(source.title) || !text(source.license) || !date(source.retrievedAt) || !Array.isArray(source.supports) || !source.supports.length || !source.supports.every(text)) throw new Error('Every source needs id, title, kind, license, retrieval date and supported rule IDs.');
    if (!text(source.url) || !/^(https?:\/\/|\/[^/])/.test(source.url)) throw new Error('Source URL must be HTTP(S) or a local absolute path.');
  }
  for (const rule of rules) {
    if (!rule || !text(rule.id) || !text(rule.label) || !['parameter', 'rule', 'metric'].includes(rule.kind) || typeof rule.assumption !== 'boolean' || (rule.assumption && !text(rule.rationale))) throw new Error('Every rule needs id, label, kind and explicit assumption status/rationale.');
  }
  if (!unique(sources) || !unique(rules)) throw new Error('Duplicate source or rule ID.');
  return clone({ schemaVersion: 'hbl-research-library.v1', id, modelVersion, sources, rules, limitations });
}

export function readResearchLibrary(value) {
  if (value?.schemaVersion !== 'hbl-research-library.v1') throw new Error('Unsupported research library version.');
  return createResearchLibrary(value);
}

export function evidenceGraph(input) {
  const library = readResearchLibrary(input);
  const edges = library.sources.flatMap(source => source.supports.map(ruleId => ({ sourceId: source.id, ruleId, kind: source.kind === 'model' ? 'implementation-reference' : 'declared-support' })));
  const rules = library.rules.map(rule => {
    const sources = library.sources.filter(source => source.supports.includes(rule.id));
    const empirical = sources.filter(source => source.kind !== 'model');
    return { ...rule, sourceIds: sources.map(source => source.id), status: rule.assumption ? 'assumption' : sources.length ? 'sourced' : 'missing', empiricalEvidence: empirical.length ? 'declared-unverified' : 'missing' };
  });
  const missingEvidence = rules.filter(rule => rule.empiricalEvidence === 'missing').map(rule => ({ ruleId: rule.id, reason: rule.assumption ? 'Explicit assumption; empirical support missing.' : rule.status === 'missing' ? 'No linked source or assumption declaration.' : 'Implementation reference only; empirical support missing.' }));
  for (const edge of edges) if (!rules.some(rule => rule.id === edge.ruleId)) missingEvidence.push({ ruleId: edge.ruleId, sourceId: edge.sourceId, reason: 'Source links to an unknown rule.' });
  for (const source of library.sources) if (['NOASSERTION', 'UNKNOWN'].includes(source.license.toUpperCase())) missingEvidence.push({ sourceId: source.id, reason: 'License requires review; redistribution permission is not established.' });
  return { ...library, rules, edges, missingEvidence };
}

export function filterRules(graph, { status = 'all', query = '' } = {}) {
  const needle = query.trim().toLowerCase();
  return graph.rules.filter(rule => (status === 'all' || rule.status === status || (status === 'missing' && graph.missingEvidence.some(gap => gap.ruleId === rule.id))) && JSON.stringify(rule).toLowerCase().includes(needle));
}

/** Preserve legacy evidence and values while projecting explicit source metadata. */
export function libraryFromExperiment(experiment) {
  const rules = [], sources = [];
  for (const [group, kind, rows] of [['variables', 'parameter', experiment.worldModel?.variables], ['causalEdges', 'rule', experiment.worldModel?.causalEdges], ['metrics', 'metric', experiment.outcomes?.metricRegistry]]) {
    for (const row of rows || []) {
      const id = `${group}:${row.id}`;
      const evidence = row.evidence || [];
      const assumption = !evidence.some(source => ['observed', 'estimated'].includes(source.type));
      rules.push({ id, label: row.label || row.name || row.id, kind, assumption, rationale: assumption ? row.reason || 'Synthetic model default or heuristic; not empirically established.' : null, unit: row.unit || null });
      evidence.forEach((source, index) => {
        // Legacy records lacking metadata remain gaps, never receive invented dates/licenses.
        if (text(source.license) && date(source.retrievedAt) && text(source.url)) sources.push({ id: `${id}:${index}`, kind: source.sourceType === 'model-assumption' ? 'model' : 'observation', title: source.sourceName, url: source.url, license: source.license, retrievedAt: source.retrievedAt, supports: [id], notes: source.notes });
      });
    }
  }
  return createResearchLibrary({ id: `civic:${experiment.id || 'draft'}`, modelVersion: experiment.worldModel?.version || experiment.modelVersion || 'unversioned', rules, sources, limitations: ['Declared source support is not independent verification or causal validation.', 'Legacy records without license, retrieval date or URL remain missing evidence.'] });
}
