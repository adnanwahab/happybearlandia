import { CONTRACTS, VERSION } from './contracts.js';

export const NEIGHBORHOOD_CATALOG_VERSION = 'neighborhood-metrics.v1';
const definitions = [
  ['population', 'households', ['size'], 'persons', 'sum(size)', 'none', 'Synthetic persons, not a census.'],
  ['households', 'households', [], 'households', 'count', 'none', 'No observed addresses implied.'],
  ['housing_units', 'units', [], 'units', 'count', 'none', 'Includes construction and renovation inventory.'],
  ['available_units', 'units', ['status'], 'units', "count(status === 'available')", 'none', 'Available does not mean affordable.'],
  ['mean_rental_unit_rent', 'units', ['rent', 'tenure'], 'illustrative USD/month', "mean(rent where tenure === 'rental')", 'rental-tenure units', 'Not observed market rent; no rental units means unavailable.'],
  ['unhoused_households', 'households', ['unitId'], 'households', 'count(unitId === null)', 'none', 'Not a real-world homelessness census.'],
  ['employed_workers', 'workers', ['jobId'], 'workers', 'count(jobId !== null)', 'none', 'Modeled assignments, not an employment rate.'],
  ['unfilled_jobs', 'jobs', ['workerId'], 'positions', 'count(workerId === null)', 'none', 'Not observed job vacancies.'],
  ['open_businesses', 'businesses', ['status'], 'businesses', "count(status === 'open')", 'none', 'Synthetic establishment status.'],
  ['outgoing_link_travel_time', 'links', ['travelTime'], 'modeled minutes', 'mean(travelTime)', 'outgoing links', 'Not person commute times; no outgoing links means unavailable.'],
  ['overloaded_facilities', 'facilities', ['utilization'], 'facilities', 'count(utilization > 1)', 'none', 'Illustrative load estimate, not service quality.'],
  ['utility_shortfalls', 'utilities', ['serviceLevel'], 'network records', 'count(serviceLevel < 1)', 'none', 'Not people without power.'],
];

/** Metadata only: no simulated values, random draws, proxies or district aggregation. */
export const NEIGHBORHOOD_METRICS = Object.freeze(definitions.map(
  ([id, collection, fields, unit, reducer, denominator, caveat]) => {
    const districtField = collection === 'links' ? 'from' : 'districtId';
    return Object.freeze({
      id, collection, fields: Object.freeze([districtField, ...fields]),
      sourcePaths: Object.freeze([districtField, ...fields].map(field => `state.${collection}[].${field}`)),
      unit, reducer, denominator, caveat, districtField,
      catalogVersion: NEIGHBORHOOD_CATALOG_VERSION,
      schemaVersion: CONTRACTS.CityState, modelVersion: VERSION,
      geographyType: 'district', timeScope: 'snapshot at state.month (monthly clock)',
      evidenceClass: 'synthetic-model', status: 'supported',
      evidence: Object.freeze(['world/city/seed.js', 'world/city/systems.js', 'world/city/contracts.js']),
      missingPolicy: 'Missing collection, district attribution or required field: unavailable, never zero. Null assignment IDs are known unassigned; undefined IDs are missing. Empty count/sum inventory: zero only when complete; empty mean denominator: unavailable.',
      cellValue: null,
    });
  },
));

/** Unknown labels are deliberately not inferred from a similar modeled signal. */
export function lookupNeighborhoodMetric(id) {
  return NEIGHBORHOOD_METRICS.find(metric => metric.id === id) ?? {
    id, catalogVersion: NEIGHBORHOOD_CATALOG_VERSION,
    schemaVersion: CONTRACTS.CityState, modelVersion: VERSION,
    geographyType: 'district', timeScope: 'snapshot at state.month (monthly clock)',
    status: 'not_modeled', value: null, unit: null, sourcePaths: [], evidence: [],
    missingPolicy: 'No audited CityState mapping for this label; do not substitute a proxy.',
  };
}
