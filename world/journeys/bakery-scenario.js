import { calculateBakeryTransport } from './bakery-fixture.js';

export const BAKERY_MODEL_VERSION = 'bakery-v1';
export const BAKERY_SEED = 2911;
export const BAKERY_DECISION_MONTH = 72;
export const BAKERY_FINAL_MONTH = 240;

function validateRecipe(recipe) {
  if (recipe?.version !== BAKERY_MODEL_VERSION || recipe.seed !== BAKERY_SEED) {
    throw new TypeError('This bakery model version or seed is unavailable.');
  }
  const { reopenMonth } = recipe;
  if (reopenMonth !== null && (!Number.isInteger(reopenMonth) ||
      reopenMonth < BAKERY_DECISION_MONTH || reopenMonth > BAKERY_FINAL_MONTH)) {
    throw new RangeError('Choose a month from the road closure through the end of the recording.');
  }
  return { version: BAKERY_MODEL_VERSION, seed: BAKERY_SEED, reopenMonth };
}

export function encodeBakeryRecipe(recipe) {
  const { version, seed, reopenMonth } = validateRecipe(recipe);
  return [version, seed, reopenMonth ?? 'baseline'].join('.');
}

export function decodeBakeryRecipe(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 40) throw new TypeError('Invalid bakery recipe.');
  const [version, seed, month, ...extra] = encoded.split('.');
  if (extra.length || !/^[0-9]+$/.test(seed) || !/^(baseline|[0-9]+)$/.test(month)) {
    throw new TypeError('Invalid bakery recipe.');
  }
  return validateRecipe({ version, seed: Number(seed), reopenMonth: month === 'baseline' ? null : Number(month) });
}

function buildTimeline(recipe, openDelivery, closedDelivery) {
  const months = [];
  const events = [];
  const record = (month, title, detail) => events.push({ month, title, detail });
  let bakeryOpen = true;
  let shortMonths = 0;

  for (let month = 0; month <= BAKERY_FINAL_MONTH; month++) {
    const roadClosed = month >= BAKERY_DECISION_MONTH &&
      (recipe.reopenMonth === null || month < recipe.reopenMonth);
    const { delivered, unserved, cost } = bakeryOpen
      ? (roadClosed ? closedDelivery : openDelivery)
      : { delivered: 0, unserved: 0, cost: 0 };
    const wasOpen = bakeryOpen;
    if (wasOpen) {
      shortMonths = unserved > 0 ? shortMonths + 1 : 0;
      if (shortMonths === 3) bakeryOpen = false;
    }
    // This fixture schedules one worker for an eight-hour modeled shift.
    // The shift scales with supplied flour while the business is trading.
    const workerHours = bakeryOpen ? 8 * delivered / 100 : 0;
    months.push({
      month, year: 2026 + Math.floor(month / 12), roadClosed, delivered, unserved,
      transportCost: cost, bakeryOpen, workerHours,
    });

    if (month === BAKERY_DECISION_MONTH) {
      if (roadClosed) {
        record(month, 'The direct flour route closes',
          `The detour delivered ${delivered} of 100 flour units. Luis worked ${workerHours} of 8 scheduled hours.`);
      } else {
        record(month, 'The direct flour route stays open',
          `The road intervention preserved delivery of ${delivered} flour units and Luis’s ${workerHours}-hour shift.`);
      }
    } else if (month === recipe.reopenMonth) {
      record(month, 'The direct flour route reopens', bakeryOpen
        ? `The bakery received ${delivered} flour units and Luis returned to an ${workerHours}-hour shift.`
        : 'The bakery had already closed. It placed no new orders and Luis worked no bakery hours.');
    }
    if (wasOpen && !bakeryOpen) {
      record(month, 'Riverside Bakery closes',
        `Three consecutive short deliveries triggered the scenario’s closure rule. The last order was ${unserved} units short. Luis’s bakery shift fell to zero hours.`);
    }
  }
  return { months, events };
}

let logistics;
export async function runBakeryFuture({ reopenMonth = null } = {}) {
  const recipe = validateRecipe({ version: BAKERY_MODEL_VERSION, seed: BAKERY_SEED, reopenMonth });
  logistics ??= Promise.all([calculateBakeryTransport(), calculateBakeryTransport({ blocked: true })]);
  const [open, closed] = await logistics;
  const { months, events } = buildTimeline(recipe, open.result.deliveries[0], closed.result.deliveries[0]);
  return { version: recipe.version, seed: recipe.seed, recipe, months, events,
    decisionMonth: BAKERY_DECISION_MONTH, finalMonth: BAKERY_FINAL_MONTH };
}
