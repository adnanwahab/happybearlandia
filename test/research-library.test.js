import { test, expect } from 'bun:test';
import { createResearchLibrary, readResearchLibrary, evidenceGraph, filterRules, libraryFromExperiment } from '../world/research-library/library.js';
import { housingResearchLibrary } from '../world/research-library/catalog.js';
import { parameters, metrics } from '../world/models/housing/schema.js';
import { housingCausalRegistry } from '../world/models/housing/causal-registry.js';
import { attachEvidenceLayer } from '../world/evidence-registry.js';
const rule = { id: 'r', label: 'Rent', kind: 'rule', assumption: false };
const source = { id: 's', title: 'Test dataset', kind: 'dataset', url: 'https://example.org/data', license: 'CC0-1.0', retrievedAt: '2026-11-12', supports: ['r'] };
const input = extra => ({ id: 'fixture', modelVersion: '1', rules: [rule], sources: [source], ...extra });
test('housing inventory tracks every registered parameter, equation and metric without claiming empirical support', () => {
 const graph = evidenceGraph(housingResearchLibrary());
 expect(graph.rules.length).toBe(parameters.length + metrics.length + housingCausalRegistry.equations.length);
 expect(graph.rules.every(row => row.assumption && row.sourceIds.length > 0)).toBe(true);
 expect(graph.rules.every(row => graph.missingEvidence.some(gap => gap.ruleId === row.id))).toBe(true);
 expect(graph.sources.every(row => row.license && row.retrievedAt && row.supports.length)).toBe(true);
 expect(graph.edges.length).toBe(graph.rules.length);
 expect(filterRules(graph, { status: 'assumption', query: 'rent_response' }).map(row => row.id)).toEqual(['parameter:rent_response', 'rule:rent-vacancy']);
 expect(filterRules(graph, { status: 'sourced' })).toEqual([]);
});
test('graph preserves missing rules, dangling links, implementation-only support and unresolved licenses', () => {
 const graph = evidenceGraph(createResearchLibrary(input({ rules: [rule, { ...rule, id: 'missing' }], sources: [{ ...source, kind: 'model', license: 'NOASSERTION', supports: ['r', 'unknown'] }] })));
 expect(graph.rules[1].status).toBe('missing');
 expect(graph.missingEvidence.map(row => row.ruleId)).toContain('unknown');
 expect(graph.missingEvidence.some(row => row.sourceId === 's' && row.reason.includes('License'))).toBe(true);
 expect(filterRules(graph, { status: 'missing' })).toHaveLength(2);
 expect(graph.edges[0].kind).toBe('implementation-reference');
});
test('valid external declared support closes structural gap without claiming verification', () => {
 const graph = evidenceGraph(createResearchLibrary(input()));
 expect(graph.rules[0].status).toBe('sourced');
 expect(graph.rules[0].empiricalEvidence).toBe('declared-unverified');
 expect(graph.missingEvidence).toEqual([]);
});
test('strict import rejects missing metadata, invalid dates, URLs, duplicates and unknown versions', () => {
 for (const patch of [{ license: '' }, { retrievedAt: null }, { retrievedAt: '2026-02-30' }, { url: 'javascript:alert(1)' }, { supports: [] }, { kind: 'invented' }]) expect(() => createResearchLibrary(input({ sources: [{ ...source, ...patch }] }))).toThrow();
 expect(() => createResearchLibrary(input({ sources: [source, source] }))).toThrow('Duplicate');
 expect(() => createResearchLibrary(input({ rules: [{ ...rule, assumption: true }] }))).toThrow();
 expect(() => readResearchLibrary({ ...input(), schemaVersion: 'future' })).toThrow();
});
test('export/import is lossless and isolated from caller mutation', () => {
 const original = input(), library = createResearchLibrary(original);
 original.sources[0].supports.push('other');
 expect(library.sources[0].supports).toEqual(['r']);
 expect(readResearchLibrary(JSON.parse(JSON.stringify(library)))).toEqual(library);
 const before = JSON.stringify(library); evidenceGraph(library); expect(JSON.stringify(library)).toBe(before);
});
test('civic integration preserves legacy metadata gaps and model values; complete metadata reaches shared library', () => {
 const experiment = { id: 'e', worldModel: { variables: [{ id: 'rent', baseline: 2, unit: 'USD', source: 'heuristic-default' }], causalEdges: [{ id: 'edge' }] }, outcomes: { metricRegistry: [{ id: 'm' }] } };
 const before = JSON.stringify(experiment), legacy = attachEvidenceLayer(experiment);
 expect(legacy.evidenceLayer.researchLibrary.rules).toHaveLength(3);
 expect(evidenceGraph(legacy.evidenceLayer.researchLibrary).missingEvidence).toHaveLength(3);
 const enriched = attachEvidenceLayer(experiment, { evidenceRegistry: { variables: { rent: { type: 'observed', sourceName: 'Dataset', sourceType: 'dataset', url: source.url, license: source.license, retrievedAt: source.retrievedAt } } } });
 expect(enriched.worldModel.variables[0].baseline).toBe(2);
 expect(enriched.evidenceLayer.researchLibrary.sources[0].supports).toEqual(['variables:rent']);
 expect(evidenceGraph(enriched.evidenceLayer.researchLibrary).rules[0].status).toBe('sourced');
 expect(JSON.stringify(experiment)).toBe(before);
 expect(libraryFromExperiment({} ).rules).toEqual([]);
});
