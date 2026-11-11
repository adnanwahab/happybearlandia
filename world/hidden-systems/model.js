import { VERSION, housingProjectBuildingId } from '../city/contracts.js';
import { addIntervention, createEngine } from '../city/engine.js';
import { createCity } from '../city/seed.js';

export const RECIPE_VERSION = 'hidden-systems.v1';
export const BASELINE = Object.freeze({ permits: 1, labor: 2, materials: 0.5 });
export const DEFAULTS = Object.freeze({ seed: 2911, months: 60, permits: 3, labor: 4, materials: 4 });
const householdId = 'household-0';
const engine = createEngine();

export function normalizeRecipe(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (input.version !== undefined && input.version !== RECIPE_VERSION) ||
      (input.modelVersion !== undefined && input.modelVersion !== VERSION)) {
    throw new Error('This Hidden Systems recipe uses an unsupported version.');
  }
  const { seed, months, permits, labor, materials } = { ...DEFAULTS, ...input };
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Choose a whole-number seed from 0 to 4294967295.');
  if (!Number.isInteger(months) || months < 1 || months > 60) throw new Error('Choose between 1 and 60 months.');
  if (!Number.isInteger(permits) || permits < 1 || permits > 6) throw new Error('Choose 1 to 6 permits per month.');
  if (![labor, materials].every(value => Number.isFinite(value) && value >= 0.5 && value <= 8 && Number.isInteger(value * 2))) {
    throw new Error('Choose labor and materials from 0.5 to 8 in half-unit steps.');
  }
  return { version: RECIPE_VERSION, modelVersion: VERSION, seed, months, permits, labor, materials };
}

export function readRecipe(encoded) {
  if (encoded === null) return normalizeRecipe();
  if (encoded.length > 600) throw new Error('The recipe is too long.');
  let parsed;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error('This Hidden Systems recipe is invalid.');
  }
  if (parsed?.version !== RECIPE_VERSION || parsed.modelVersion !== VERSION) {
    throw new Error('This Hidden Systems recipe uses an unsupported version.');
  }
  return normalizeRecipe(parsed);
}

function initialCity(seed) {
  let state = createCity({ seed, households: 18 });
  // Explicit fixture assumptions keep the initial shortage and public building
  // pipeline reproducible without changing any City system.
  const household = state.households.find(row => row.id === householdId);
  state.units = state.units.filter(unit => unit.householdId && unit.householdId !== householdId);
  household.unitId = null;
  household.districtId = 'd1';
  const worker = state.workers.find(row => row.householdId === householdId);
  const job = state.jobs.find(row => row.id === 'job-d0-0');
  worker.districtId = household.districtId;
  worker.jobId = job.id;
  job.workerId = worker.id;
  for (const row of state.households) {
    row.leaseUntil = 61;
    row.otherIncome += 5500;
  }
  for (const row of state.jobs) row.wage = 1800;
  state.provenance = { ...state.provenance, datasetVersion: RECIPE_VERSION };
  for (const parcel of state.parcels) parcel.capacity = 0;
  for (const utility of state.utilities) utility.capacity = 30;
  Object.assign(state.parameters, { contractors: 4, equipment: 4, administration: 12, annualGrowth: 0 });
  for (const district of state.districts) {
    for (let project = 0; project < 2; project++) {
      state = addIntervention(state, { type: 'housing', districtId: district.id, amount: 3, cost: 420000 });
    }
  }
  return engine.initialize(state);
}

function countAt(state, stage) {
  return state.projects.filter(project => project.stage === stage).length;
}

function run(initial, settings, months) {
  let state = structuredClone(initial);
  const { permits, labor, materials } = settings;
  Object.assign(state.parameters, { permits, labor, materials });
  const submitted = new Map();
  const history = [];
  let firstHousedMonth = null;

  function snapshot(step, previous) {
    const { events, moves, trips, capacities } = step ?? { events: [], moves: [], trips: [], capacities: [] };
    const month = state.month;
    const districtName = id => state.districts.find(row => row.id === id)?.name ?? null;
    const projectEvents = events.filter(event => event.system === 'construction');
    const eventsOf = type => projectEvents.filter(event => event.eventType === type);
    const permitArrivals = eventsOf('PERMIT_SUBMITTED');
    const permitGrants = eventsOf('PERMIT_GRANTED');
    for (const { payload } of permitArrivals) submitted.set(payload.projectId, month);
    const waiting = state.projects.filter(project => project.stage === 'permit')
      .map(project => ({ id: project.id, months: month - submitted.get(project.id) }));

    const family = state.households.find(row => row.id === householdId);
    const unit = state.units.find(row => row.id === family.unitId);
    const person = state.workers.find(row => row.householdId === householdId);
    const trip = trips.find(row => row.personId === person?.id);
    const move = moves.find(row => row.householdId === householdId);
    if (unit && firstHousedMonth === null) firstHousedMonth = month;

    return {
      month,
      permits: {
        opening: previous ? countAt(previous, 'permit') : null,
        arrivals: step ? permitArrivals.length : null,
        served: step ? permitGrants.length : null,
        closing: waiting.length, capacity: permits, waiting,
      },
      construction: {
        opening: previous ? countAt(previous, 'construction') : null,
        arrivals: step ? permitGrants.length : null,
        served: step ? eventsOf('PROJECT_COMPLETE').length : null,
        closing: countAt(state, 'construction'),
        blocked: projectEvents.filter(event =>
          ['CAPACITY_DELAY', 'MATERIAL_DELAY'].includes(event.eventType) &&
          !['permit delay', 'financing'].includes(event.payload.reason))
          .map(event => ({ id: event.payload.projectId, reason: event.payload.reason })),
      },
      resources: capacities.filter(row => row.districtId === '*' && row.resource !== 'administration')
        .map(({ resource, capacity, used, available }) => ({ resource, capacity, used, available })),
      projects: state.projects.map(project => {
        const buildingId = project.stage === 'completion' ? housingProjectBuildingId(project.id) : null;
        return {
          id: project.id, districtId: project.districtId, districtName: districtName(project.districtId),
          stage: project.stage, progress: project.progress, duration: project.duration, units: project.units,
          buildingId, occupied: buildingId
            ? state.units.filter(unit => unit.buildingId === buildingId && unit.householdId).length : null,
          events: projectEvents.filter(event => event.payload.projectId === project.id),
        };
      }),
      household: {
        id: householdId, districtId: family.districtId, districtName: districtName(family.districtId),
        buildingId: unit?.buildingId ?? null, unitId: unit?.id ?? null, rent: unit?.rent ?? null,
        income: family.income, savings: family.savings,
        commuteMinutes: trip?.experiencedMinutes ?? null, commuteOriginName: districtName(trip?.originId),
        move: move ? {
          ...move, originDistrict: districtName(move.originDistrict),
          destinationDistrict: districtName(move.destinationDistrict),
        } : null,
        firstHousedMonth,
      },
    };
  }

  history.push(snapshot());
  for (let month = 1; month <= months; month++) {
    const previous = state;
    const step = engine.step(state);
    state = step.state;
    history.push(snapshot(step, previous));
  }
  return history;
}

export function compareHiddenSystems(input) {
  const recipe = normalizeRecipe(input);
  const initial = initialCity(recipe.seed);
  return {
    recipe, baseline: run(initial, BASELINE, recipe.months),
    adjusted: run(initial, recipe, recipe.months),
  };
}
