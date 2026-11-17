/** Source metadata describes origin, never empirical confidence or numeric precision. */
export const MONTHLY_CITY_PROVENANCE = Object.freeze({
  category: 'modeled',
  source: 'Monthly City recorded baseline and plan snapshots; capital spending uses the cumulative finance ledger',
  limitation: 'Synthetic, uncalibrated starting state (future-machine-synthetic.v1). Model results, not real-world observations or forecasts.',
});
const LABELS = Object.freeze({observed:'Observed', synthetic:'Synthetic', modeled:'Modeled'});
export function provenancePresentation(provenance) {
  const category = Object.hasOwn(LABELS, provenance?.category) ? provenance.category : 'unknown';
  const label = LABELS[category] || 'Provenance unavailable';
  const source = typeof provenance?.source === 'string' && provenance.source.trim() ? provenance.source.trim() : 'Unavailable';
  const limitation = typeof provenance?.limitation === 'string' ? provenance.limitation.trim() : '';
  return {category, label, description:`Category: ${label}. Source: ${source}.${limitation ? ` ${limitation}` : ''}`};
}
