import { createDefinition, ARCHETYPES } from './content.js';
import { FIELDS, copy, validateDefinition } from './schema.js';

export function compileLocal(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new Error('Describe your business in 1–4000 characters.');
  const lower = text.toLowerCase();
  const archetype = /marketplace|two.sided|walker app/.test(lower) ? 'marketplace' : /subscription|saas|software/.test(lower) ? 'subscription' : /factory|manufactur|robot/.test(lower) ? 'manufacturing' : /agency|contractor/.test(lower) ? 'project' : /newsletter|creator|channel/.test(lower) ? 'media' : /landscap|car wash|service|cleaning/.test(lower) ? 'services' : /online|pack|sneaker|shipping|drink for/.test(lower) ? 'physical-product' : 'local-retail';
  const def = createDefinition(archetype, { description: text, name: text.replace(/^(a|an)\s+/i, '').split(/[,.;]/)[0].slice(0, 60) });
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (match) { const price = Number(match[1].replaceAll(',', '')); def.price = price; def.unitCost = Number((price * ARCHETYPES[archetype].cost / ARCHETYPES[archetype].price).toFixed(2)); def.referencePrice = { min: price * .5, typical: price, max: price * 2 }; }
  if (/12.pack/i.test(text)) def.unit = '12-pack';
  if (/yuzu/i.test(text)) { def.name = 'YuzuSpark'; }
  def.inputs[0].cost = def.unitCost; def.inputs[0].unit = def.unit;
  return { def, source: 'local-parser.v1', warnings: ['Local deterministic parser, not AI. Category defaults are illustrative assumptions without market research. Review every value.'], provenance: Object.fromEntries(FIELDS.map(([id]) => [id, id === 'price' && match ? 'player-set' : 'inferred'])) };
}

export function proposeLocalEdit(text, definition) {
  const draft = copy(definition), changes = [];
  const patterns = {
    price: /\bprice\s*(?:to|at|=)?\s*\$?\s*(\d+(?:\.\d+)?)/i,
    quality: /\bquality\s*(?:to|at|=)?\s*(\d+(?:\.\d+)?)/i,
    capacity: /\bcapacity\s*(?:to|at|=)?\s*([\d,]+)/i,
    unitCost: /\b(?:unit cost|cogs)\s*(?:to|at|=)?\s*\$?\s*(\d+(?:\.\d+)?)/i,
  };
  // Refuse mixed unsupported requests instead of silently dropping clauses.
  const clauses = String(text).split(/\s+(?:and|also)\s+|[,;]/i).filter(s => s.trim());
  for (const clause of clauses) {
    let found = false;
    for (const [id, pattern] of Object.entries(patterns)) { const m = clause.match(pattern); if (!m) continue; draft[id] = Number(m[1].replaceAll(',', '')); changes.push(id); found = true; }
    if (!found) throw new Error('Local edits support explicit price, quality, capacity and unit cost only. Use the assumption form or a configured AI provider for other changes.');
  }
  if (!changes.length) throw new Error('Specify a change, e.g. “Raise price to $3 and quality to 85”.');
  delete draft.approved; delete draft.version;
  const checked = validateDefinition(draft); if (!checked.valid) throw new Error(checked.errors.join(' '));
  return { def: draft, source: 'local-parser.v1', warnings: ['Proposal only. Nothing changes until approved.'], provenance: Object.fromEntries(changes.map(id => [id, 'player-set'])) };
}
export { ARCHETYPES };
