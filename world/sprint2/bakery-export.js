import { calculateBakeryTransport } from '../journeys/bakery-fixture.js';
import {
  BAKERY_DECISION_MONTH, decodeBakeryRecipe, encodeBakeryRecipe, runBakeryFuture,
} from '../journeys/bakery-scenario.js';
import { canonicalJSON } from '../replay/engine.js';

export const bakeryExportLimitations = Object.freeze([
  'The district, roads, bakery, and household are synthetic. No observed city, business, or household data was used.',
  'The fixed fixture uses no random draws. This comparison covers one road intervention and supplies no uncertainty estimates.',
  'The bakery closure and worker shift are scenario rules. Hours refer to one modeled shift per monthly state. Wages and household finances are outside the model.',
  'After the bakery closes, zero unserved units means no order was placed. The closure month still records its final order.',
]);

function exportRun(run) {
  const recipeId = encodeBakeryRecipe(run.recipe);
  const replayQuery = new URLSearchParams({ recipe: recipeId });
  return {
    ...run,
    provenance: {
      kind: 'deterministic-synthetic-scenario-rerun',
      recipeId,
      replayPath: `/world/journeys/bakery.html?${replayQuery}`,
    },
  };
}

export async function buildBakeryEvidence(recipeCode = null) {
  const recipe = recipeCode === null ? null : decodeBakeryRecipe(recipeCode);
  if (recipe && recipe.reopenMonth === null) {
    throw new TypeError('The comparison requires a road intervention recipe.');
  }
  const reopenMonth = recipe?.reopenMonth ?? BAKERY_DECISION_MONTH;
  const [baseline, intervention, openRoad, closedRoad] = await Promise.all([
    runBakeryFuture(),
    runBakeryFuture({ reopenMonth }),
    calculateBakeryTransport(),
    calculateBakeryTransport({ blocked: true }),
  ]);

  return {
    schemaVersion: 'hbl-bakery-evidence/1',
    classification: 'synthetic',
    sources: {
      scenario: '/world/journeys/bakery-scenario.js',
      transportFixture: '/world/journeys/bakery-fixture.js',
      logisticsSolver: '/tools/flowmap/logistics.js',
    },
    metricUnits: {
      month: 'zero-based simulation month since January 2026',
      year: 'calendar year',
      delivered: 'flour units per order',
      unserved: 'flour units per order',
      transportCost: 'modeled currency units per order',
      workerHours: 'hours per modeled shift',
      roadClosed: 'boolean',
      bakeryOpen: 'boolean',
    },
    rules: {
      transport: 'While trading, use the open or closed road solver result for the month’s flour order.',
      bakery: 'Three consecutive short deliveries permanently close the bakery during the third month.',
      workerShift: 'While open, schedule an eight-hour shift scaled by the share of the flour order delivered. Schedule zero hours when closed.',
    },
    limitations: bakeryExportLimitations,
    runs: { baseline: exportRun(baseline), intervention: exportRun(intervention) },
    transportEvidence: { openRoad, closedRoad },
  };
}

export function serializeBakeryEvidence(evidence) {
  return canonicalJSON(evidence) + '\n';
}
