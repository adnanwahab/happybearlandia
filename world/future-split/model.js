import { VERSION, housingProjectBuildingId } from '../city/contracts.js';
import { addIntervention, cityMetrics, createEngine } from '../city/engine.js';
import { PLAN_DEFAULTS, POLICY_CATALOG } from '../invention/model.js';
import { createQuestScenario, QUEST_SCENARIO_VERSION } from '../living-city/quests.js';

const RECIPE_VERSION = 'future-split.v1';
const engine = createEngine();
const policies = new Map(POLICY_CATALOG.map(policy => [policy.id, policy]));

export const POLICY_OPTIONS = Object.freeze([
  Object.freeze({ id: '', label: 'No intervention (identical plans)' }),
  ...POLICY_CATALOG,
]);

export const DEFAULT_RECIPE = Object.freeze({
  version: RECIPE_VERSION,
  modelVersion: VERSION,
  scenarioVersion: QUEST_SCENARIO_VERSION,
  seed: PLAN_DEFAULTS.seed,
  months: PLAN_DEFAULTS.months,
  policyId: 'transit-d1-8',
});

export function normalizeRecipe(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Choose a valid Future Split recipe.');
  }
  const recipe = { ...DEFAULT_RECIPE };
  for (const field of Object.keys(recipe)) {
    if (Object.hasOwn(input, field)) recipe[field] = input[field];
  }
  if (recipe.version !== RECIPE_VERSION || recipe.modelVersion !== VERSION ||
      recipe.scenarioVersion !== QUEST_SCENARIO_VERSION) {
    throw new Error('This Future Split recipe uses an unsupported version.');
  }
  if (!Number.isInteger(recipe.seed) || recipe.seed < 0 || recipe.seed > 0xffffffff) {
    throw new Error('Choose a whole-number seed from 0 to 4294967295.');
  }
  if (!Number.isInteger(recipe.months) || recipe.months < 1 || recipe.months > 36) {
    throw new Error('Choose a horizon of 1 to 36 months.');
  }
  if (recipe.policyId !== '' && !policies.has(recipe.policyId)) {
    throw new Error('Choose one supported City policy or no intervention.');
  }
  return recipe;
}

export function encodeRecipe(input) {
  return JSON.stringify(normalizeRecipe(input));
}

export function decodeRecipe(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 1000) {
    throw new Error('This Future Split recipe link is invalid.');
  }
  let input;
  try {
    input = JSON.parse(encoded);
  } catch {
    throw new Error('This Future Split recipe link is invalid.');
  }
  if (!input || !Object.keys(DEFAULT_RECIPE).every(field => Object.hasOwn(input, field))) {
    throw new Error('This Future Split recipe link is missing its version or settings.');
  }
  return normalizeRecipe(input);
}

function mean(rows, field) {
  return rows.length ? rows.reduce((sum, row) => sum + row[field], 0) / rows.length : null;
}

function projectLabel(type) {
  return ({ housing: 'Housing project', transit: 'Transit project' })[type] ?? 'City project';
}

function inspectMonth({ state, trips, events }, capitalSpending, policyId) {
  const districtNames = new Map(state.districts.map(({ id, name }) => [id, name]));
  const unitsById = new Map(state.units.map(unit => [unit.id, unit]));
  const policyProjects = new Set(state.projects.filter(project => project.policyId).map(project => project.id));
  const policyBuildings = new Set([...policyProjects].map(housingProjectBuildingId));

  // The engine allocates policy project IDs from revision-local counters. The
  // selected catalog policy scopes those IDs while preserving the engine ID.
  const entityId = (kind, id, fromPolicy) => fromPolicy ? `${kind}:${policyId}:${id}` : `${kind}:${id}`;
  const buildings = state.buildings.map(({ id, districtId, parcelId, floors }) => {
    const units = state.units.filter(unit => unit.buildingId === id);
    return {
      id: entityId('building', id, policyBuildings.has(id)), modelId: id,
      kind: 'building', districtId, label: `${districtNames.get(districtId)} building`,
      fields: {
        districtId, parcelId: parcelId ?? null, floors, housingUnits: units.length,
        occupiedUnits: units.filter(unit => unit.householdId !== null).length,
        meanRent: mean(units, 'rent'),
      },
    };
  });
  const projects = state.projects.map(project => ({
    id: entityId('project', project.id, policyProjects.has(project.id)), modelId: project.id,
    kind: 'project', districtId: project.districtId, label: projectLabel(project.type),
    fields: {
      districtId: project.districtId, type: project.type, stage: project.stage,
      progress: project.progress, duration: project.duration, cost: project.cost,
      costOverrun: project.costOverrun, amount: project.amount, units: project.units,
      policyId: project.policyId ?? null,
    },
  }));
  const routes = state.links.map(link => ({
    id: entityId('route', link.id), modelId: link.id, kind: 'route',
    fromDistrictId: link.from, toDistrictId: link.to,
    label: `${districtNames.get(link.from)} → ${districtNames.get(link.to)} ${link.mode}`,
    fields: {
      mode: link.mode, fromDistrictId: link.from, toDistrictId: link.to,
      capacity: link.capacity, flow: link.flow, freeTimeMinutes: link.freeTime,
      travelTimeMinutes: link.travelTime, closed: link.closed,
    },
  }));
  const households = state.households.map(household => {
    const unit = unitsById.get(household.unitId);
    return {
      id: entityId('household', household.id), modelId: household.id, kind: 'household',
      districtId: household.districtId, label: household.id,
      fields: {
        districtId: household.districtId, unitId: household.unitId, buildingId: unit?.buildingId ?? null,
        size: household.size, income: household.income, savings: household.savings, rent: unit?.rent ?? null,
      },
    };
  });

  const { housingUnits, unhoused, balance, completedProjects } = cityMetrics(state);
  return {
    entities: [...buildings, ...projects, ...routes, ...households],
    metrics: {
      housingUnits, unhoused, meanRent: mean(state.units, 'rent'),
      meanCommuteMinutes: mean(trips, 'experiencedMinutes'), commuteCount: trips.length,
      publicBalance: balance, capitalSpending, completedProjects,
    },
    events,
  };
}

export function compareEntities(baseline, intervention) {
  const baselineById = new Map(baseline.map(entity => [entity.id, entity]));
  const interventionById = new Map(intervention.map(entity => [entity.id, entity]));
  const ids = new Set([...baselineById.keys(), ...interventionById.keys()]);
  const changes = [];
  for (const id of ids) {
    const before = baselineById.get(id) ?? null;
    const after = interventionById.get(id) ?? null;
    const keys = new Set([...Object.keys(before?.fields ?? {}), ...Object.keys(after?.fields ?? {})]);
    const fields = [...keys].filter(key => !before || !after || before.fields[key] !== after.fields[key]);
    if (!before || !after || fields.length) {
      changes.push({ id, kind: (after ?? before).kind, status: !before ? 'added' : !after ? 'removed' : 'modified', before, after, fields });
    }
  }
  return changes;
}

function compareMonth(left, right, baselineCapital, interventionCapital, policyId) {
  const baseline = inspectMonth(left, baselineCapital, '');
  const intervention = inspectMonth(right, interventionCapital, policyId);
  return {
    month: left.state.month,
    districts: left.state.districts.map(({ id, name }) => ({ id, name })),
    baseline,
    intervention,
    changes: compareEntities(baseline.entities, intervention.entities),
  };
}

export function runFutureSplit(input) {
  const recipe = normalizeRecipe(input);
  const start = createQuestScenario({ seed: recipe.seed });
  const policy = policies.get(recipe.policyId);
  let baseline = start;
  let intervention = policy ? { ...start, state: addIntervention(start.state, policy) } : start;
  let baselineCapital = 0;
  let interventionCapital = 0;
  let firstDivergenceMonth = null;
  // The common start is displayed before the submitted policy enters the engine.
  const frames = [compareMonth(start, start, 0, 0, '')];

  for (let index = 0; index < recipe.months; index++) {
    baseline = engine.step(baseline.state);
    intervention = engine.step(intervention.state);
    baselineCapital += baseline.state.systems.finance.capitalExpense;
    interventionCapital += intervention.state.systems.finance.capitalExpense;
    const frame = compareMonth(baseline, intervention, baselineCapital, interventionCapital, recipe.policyId);
    const metricChanged = Object.entries(frame.baseline.metrics).some(([key, value]) => value !== frame.intervention.metrics[key]);
    if (firstDivergenceMonth === null && (frame.changes.length || metricChanged)) {
      firstDivergenceMonth = frame.month;
    }
    frames.push(frame);
  }

  return {
    recipe,
    provenance: {
      modelVersion: VERSION,
      scenarioVersion: QUEST_SCENARIO_VERSION,
      seed: recipe.seed,
      startMonth: start.month,
      source: 'Synthetic Riverside City checkpoint',
      assumptions: [
        'Both arms use the same City checkpoint and seed. Only Future B receives the selected policy.',
        'District and entity placement is schematic. Distances and geometry are illustrative.',
        'Capital spending is cumulative modeled capital expense after the checkpoint.',
      ],
      populationSnapshot: start.state.provenance.populationSnapshot,
      worldRevision: start.state.provenance.worldRevision,
    },
    frames,
    firstDivergenceMonth,
  };
}
