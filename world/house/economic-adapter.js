import { RunContextSchema, parseCanonicalId, canonicalId, ObservationSchema } from '../../shared/causality/index.js';
/** Synthetic economic projection. Never mutates household gameplay or savings. */
export const HOUSEHOLD_MAPPING_VERSION = 'household-economic.v1';
const finite = (value, name) => {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be finite and nonnegative`);
  return value;
};
export function projectHouseholdEconomy({ employment, mapping, housingCostPerDay, commuteCostPerDay, commuteMinutesPerDay, services = [], context }) {
  if (mapping?.schemaVersion !== HOUSEHOLD_MAPPING_VERSION || employment?.schemaVersion !== 'business-employment.v1') throw new TypeError('Unsupported economic mapping');
  if (!mapping.householdId || !mapping.businessId || !context?.runId || !context?.worldId || !Number.isInteger(context.tick) || context.tick < 0) throw new TypeError('Explicit household, business and run/tick context required');
  context = RunContextSchema.parse(context);
  for (const [value, kind] of [[mapping.householdId, 'household'], [mapping.businessId, 'business']]) if (parseCanonicalId(value).kind !== kind) throw new TypeError('Incorrect mapping entity kind');
  const fraction = finite(mapping.allocationFraction, 'allocationFraction');
  if (fraction > 1 || !(mapping.periodDays > 0) || !Number.isFinite(mapping.periodDays)) throw new TypeError('Invalid payroll allocation period');
  const incomePerDay = finite(employment.wages, 'wages') * fraction / mapping.periodDays;
  const housing = finite(housingCostPerDay, 'housingCostPerDay');
  const commute = finite(commuteCostPerDay, 'commuteCostPerDay');
  const minutes = finite(commuteMinutesPerDay, 'commuteMinutesPerDay');
  const availableServices = services.map(s => {
    if (!s.id || typeof s.available !== 'boolean') throw new TypeError('Explicit service ID and availability required');
    return { id: s.id, available: s.available };
  });
  return { schemaVersion: HOUSEHOLD_MAPPING_VERSION, context: structuredClone(context), householdId: mapping.householdId,
    provenance: { classification: 'synthetic', businessId: mapping.businessId, employmentPeriod: employment.period, mapping: structuredClone(mapping) },
    economicInputs: { incomePerDay, housingCostPerDay: housing, commuteCostPerDay: commute },
    environmentalInputs: { commuteMinutesPerDay: minutes, services: availableServices },
    budget: { unit: 'currency/day', disposablePerDay: incomePerDay - housing - commute },
    narrativeActivities: [] };
}
export function householdBudgetChange(before, after) {
  if (before.householdId !== after.householdId || before.context.worldId !== after.context.worldId) throw new TypeError('Incompatible households');
  return after.budget.disposablePerDay - before.budget.disposablePerDay;
}

/** Inspector evidence is calculated from the supplied recorded employment period. */
export function householdEconomicObservations(projection) {
  const {context, householdId} = projection;
  return Object.entries({...projection.economicInputs, disposablePerDay: projection.budget.disposablePerDay}).map(([metric, value], sequence) => ObservationSchema.parse({sequence,
    id: canonicalId('observation', 'household', `${context.runId}/${context.tick}/${householdId}/${metric}`), context,
    entityId: householdId, metricId: canonicalId('metric', 'household', metric), value, unit: 'USD/day',
    provenance: {id: canonicalId('provenance', 'household', `${context.runId}/${context.tick}/${householdId}/${metric}`), kind: 'derived', source: 'Explicit payroll allocation and daily costs', modelVersion: HOUSEHOLD_MAPPING_VERSION, sourceIds: [projection.provenance.businessId]}
  }));
}

/** Bind the business adapter's recorded output, rejecting cross-run payroll. */
export function connectHouseholdEconomy(input) {
  const employment = input.employment;
  if (!employment.context || employment.entityId !== input.mapping.businessId) throw new TypeError('Mapped business employment required');
  for (const key of ['universeId','worldId','scenarioId','runId','tick']) if (employment.context[key] !== input.context[key]) throw new TypeError('Employment context mismatch');
  const projection = projectHouseholdEconomy(input);
  const observations = householdEconomicObservations(projection);
  const sourceIds = employment.provenance?.sourceIds ?? [];
  const edges = sourceIds.flatMap(fromId => observations.map(row => ({
    id: canonicalId('edge','household',`${fromId}/${row.id}`), context: projection.context, fromId, toId: row.id,
    relation: 'contributes', confidence: 1, evidenceIds: [fromId], provenance: row.provenance
  })));
  return {projection, snapshot: {context: projection.context, events: [], observations, assumptions: [], edges}};
}
