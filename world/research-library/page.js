import { housingResearchLibrary } from './catalog.js';
import { readResearchLibrary, evidenceGraph, filterRules } from './library.js';
let library = housingResearchLibrary();
const $ = id => document.getElementById(id);
function element(tag, text, parent) { const node = document.createElement(tag); node.textContent = text; parent.append(node); return node; }
function render() {
  const graph = evidenceGraph(library);
  $('summary').textContent = `${library.id} · model ${library.modelVersion} · ${graph.rules.length} rules · ${graph.sources.length} sources · ${graph.rules.filter(row => row.assumption).length} assumptions · ${graph.missingEvidence.length} evidence gaps`;
  for (const id of ['limitations', 'rules', 'sources', 'gaps']) $(id).replaceChildren();
  graph.limitations.forEach(text => element('li', text, $('limitations')));
  const rules = filterRules(graph, { status: $('status').value, query: $('query').value });
  $('count').textContent = `${rules.length} matching rules`;
  if (!rules.length) element('p', 'No matching rules.', $('rules'));
  for (const rule of rules) {
    const card = element('article', '', $('rules')); card.id = `rule-${encodeURIComponent(rule.id)}`;
    element('h3', rule.label, card);
    element('p', `${rule.id} · ${rule.kind} · ${rule.status} · empirical evidence: ${rule.empiricalEvidence}`, card);
    if (rule.unit) element('p', `Unit: ${rule.unit}${rule.value !== undefined ? ` · Default: ${rule.value}` : ''}`, card);
    if (rule.description) element('p', rule.description, card);
    if (rule.expression) element('code', rule.expression, card);
    if (rule.rationale) element('p', rule.rationale, card);
    if (!rule.sourceIds.length) element('p', 'No linked source.', card);
    for (const sourceId of rule.sourceIds) { const source = graph.sources.find(row => row.id === sourceId); const link = element('a', `→ ${source.title} (${source.kind === 'model' ? 'implementation reference' : 'declared support'})`, card); link.href = `#source-${encodeURIComponent(source.id)}`; }
  }
  if (!graph.sources.length) element('p', 'No sources recorded.', $('sources'));
  for (const source of graph.sources) {
    const card = element('article', '', $('sources')); card.id = `source-${encodeURIComponent(source.id)}`;
    element('h3', source.title, card);
    element('p', `${source.kind} · License: ${source.license} · Retrieved: ${source.retrievedAt}`, card);
    const link = element('a', 'Open source', card); link.href = source.url;
    if (source.notes) element('p', source.notes, card);
    element('p', `Supports: ${source.supports.join(', ')}`, card);
  }
  if (!graph.missingEvidence.length) element('li', 'No structural evidence gaps. Declared support still requires scientific review.', $('gaps'));
  graph.missingEvidence.forEach(gap => element('li', `${gap.ruleId || gap.sourceId}: ${gap.reason}`, $('gaps')));
}
$('query').addEventListener('input', render);
$('status').addEventListener('change', render);
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'research-library.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').addEventListener('change', async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 2_000_000) throw new Error('Library exceeds the 2 MB import limit.');
    const next = readResearchLibrary(JSON.parse(await file.text()));
    library = next; $('message').textContent = 'Opened library for this session. Export to keep a copy.'; render();
  } catch (error) { $('message').textContent = `Library was not opened: ${error.message}`; }
  event.target.value = '';
});
render();
