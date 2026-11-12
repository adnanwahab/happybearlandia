import { parameters, metrics, housingModel } from '../models/housing/schema.js';
import { housingCausalRegistry } from '../models/housing/causal-registry.js';
import { createResearchLibrary } from './library.js';

export function housingResearchLibrary() {
  const rules = [
    ...parameters.map(row => ({ id: `parameter:${row.id}`, label: row.label, kind: 'parameter', unit: row.unit, value: row.default, description: row.description, assumption: true, rationale: row.source.label })),
    ...housingCausalRegistry.equations.map(row => ({ id: `rule:${row.id}`, label: row.label, kind: 'rule', expression: row.expression, assumption: true, rationale: housingCausalRegistry.limitation })),
    ...metrics.map(row => ({ id: `metric:${row.id}`, label: row.label, kind: 'metric', unit: row.unit, description: row.description, assumption: true, rationale: row.boundary })),
  ];
  return createResearchLibrary({ id: 'housing-research.v1', modelVersion: housingModel.version, rules,
    sources: [{ id: 'housing-schema', title: 'HBL housing model schema and synthetic defaults', kind: 'model', url: '/world/models/housing/schema.js', license: 'NOASSERTION', retrievedAt: '2026-11-12', supports: rules.filter(row => row.kind !== 'rule').map(row => row.id), notes: 'Local repository inspection date. No license grant or external empirical support established.' },
      { id: 'housing-equations', title: 'HBL implemented housing equation registry', kind: 'model', url: '/world/models/housing/causal-registry.js', license: 'NOASSERTION', retrievedAt: '2026-11-12', supports: rules.filter(row => row.kind === 'rule').map(row => row.id), notes: 'Local repository inspection; implementation documentation, not empirical evidence.' }],
    limitations: ['Housing parameters, registered equations and metrics only. Population, monthly City, Business and other engines have not been inventoried.', 'No papers or empirical datasets have been retrieved in this slice. Historical series definitions are not observations supporting synthetic coefficients.', 'NOASSERTION records require license review before redistribution. Source support is declared, not independently validated.'] });
}
