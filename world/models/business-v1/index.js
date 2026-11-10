import { advanceBusinessChallenge } from './challenges.js';
import { ARCHETYPES, EVENTS } from './content.js';
import { copy, clamp, requireApproved } from './schema.js';
import { deriveSeed } from '../../world-generator.js';
import { seededRandom } from '../../decision/kernel.js';
export { approveDefinition, validateDefinition } from './schema.js';
export { compileLocal } from './compiler.js';
export const businessModel = {
  id: 'business-v1', version: '1.0.0', name: 'Business Lab', parameters: [],
  metrics: ['cash','profit','revenue','reputation','survival','customers'].map(id => ({ id, label: id, direction: 'higher-is-better', unit: ['cash','profit','revenue'].includes(id) ? 'USD' : 'count' })),
};
export function defaultPlan(def) {
  return { price: def.price, quality: def.quality, production: Math.round(Math.min(def.capacity * .65, def.baseTraffic * .2)), staff: 1, marketing: { social: 0, creators: 0, local: 0 }, supplier: 'standard', location: 1, equipment: 0, sellers: 25, recipe: Object.fromEntries(def.recipe.knobs.map(k => [k, 4])) };
}
export function createBusinessState(def, seed = 42) {
  requireApproved(def);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned integer.');
  return { schemaVersion: 'business-state.v1', def: copy(def), period: 0, scale: def.scale, seed, cash: def.startingCash, reputation: 0, inventory: 0, inventoryValue: 0, pipeline: [], awareness: def.startingAwareness, customers: 0, audience: 0, debt: 0, ownership: 1, financing: [], equipment: 0, location: 1, negativePeriods: 0, bankrupt: false, totalRevenue: 0, totalProfit: 0, totalSales: 0, logs: [], history: [{ period: 0, cash: def.startingCash, revenue: 0, profit: 0 }], lastPlan: defaultPlan(def) };
}
const rng = (s, period, system) => seededRandom(deriveSeed(s.seed, `${period}:${system}`));
export function forecast(state, count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const period = state.period + i + 1, random = rng(state, period, 'events');
    const temperature = Math.round(65 + random() * 30), rain = random() < .2;
    const event = random() < .23 ? EVENTS[Math.floor(random() * EVENTS.length)] : null;
    return { period, temperature, rain, event, label: event?.label || 'Normal trading', warning: event?.warning || 'No major event expected.' };
  });
}
export function validatePlan(plan) {
  const errors = [];
  for (const [key,min,max] of [['price',.01,1e6],['quality',1,100],['production',0,100000],['staff',1,100],['location',1,5],['sellers',1,10000],['equipment',0,5]]) if (typeof plan?.[key] !== 'number' || !Number.isFinite(plan[key]) || plan[key] < min || plan[key] > max) errors.push(`${key} must be ${min}–${max}.`);
  for (const id of ['social','creators','local']) if (!Number.isFinite(plan?.marketing?.[id]) || plan.marketing[id] < 0 || plan.marketing[id] > 1e7) errors.push(`Invalid ${id} marketing budget.`);
  if (plan?.recipe && (typeof plan.recipe !== 'object' || Object.values(plan.recipe).some(v => !Number.isFinite(v) || v < 0 || v > 10))) errors.push('Recipe values must be 0–10.');
  if (!['budget','standard','premium'].includes(plan?.supplier)) errors.push('Choose a supplier.');
  if (!Number.isInteger(plan?.staff) || !Number.isInteger(plan?.production) || !Number.isInteger(plan?.location) || !Number.isInteger(plan?.equipment)) errors.push('Staff, location and production must be whole numbers.');
  return errors;
}
const poisson = (mean, random) => {
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(2 * Math.PI * random())));
  const limit = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= random(); } while (p > limit && k < 200);
  return k - 1;
};
const utility = (quality, price, segment, d, reputation) => segment.quality * quality / 100 - segment.sensitivity * price / d.referencePrice.typical + .8 * reputation + 1.1 * segment.affinity;
export const purchaseProbability = u => 1 / (1 + Math.exp(-u));
export function simulatePeriod(input, plan, options = {}) {
  requireApproved(input.def);
  const errors = validatePlan(plan); if (errors.length) throw new Error(errors.join(' '));
  if (input.bankrupt) throw new Error('This company is bankrupt. Start a new company or enter another future.');
  const s = copy(input), d = s.def, adapter = ARCHETYPES[d.archetype], period = s.period + 1;
  const random = rng(s, period, 'customers'), market = rng(s, period, 'market'), supply = rng(s, period, 'supply');
  const predicted = options.forecast || forecast(s, 1)[0];
  const actual = { ...predicted, temperature: predicted.temperature + Math.round((market() - .5) * 8) };
  const priceNoise = market(), demandNoise = market(), rivalNoise = market(), retentionNoise = market(); // fixed exogenous draws
  const shock = actual.event;
  const supplier = { budget: { cost: .8, quality: .85, reliability: .85 }, standard: { cost: 1, quality: 1, reliability: .96 }, premium: { cost: 1.18, quality: 1.1, reliability: .995 } }[plan.supplier];
  const delivered = supply() <= supplier.reliability;
  const rawCost = d.recipe.knobs.length ? d.inputs.reduce((sum,i) => sum + i.cost * (plan.recipe?.[i.id] ?? 4), 0) / d.recipe.batchYield : d.inputs.reduce((sum,i) => sum + i.cost, 0);
  const costPerUnit = rawCost * (.7 + plan.quality / 250) * supplier.cost * (shock?.cost || 1) * (.95 + priceNoise * .1) * (plan.production >= d.capacity ? .95 : 1);
  const equipmentPurchase = Math.max(0, (plan.equipment || 0) - s.equipment) * d.price * 80;
  const tierCost = Math.max(0, plan.location - s.location) * d.rent * 20;
  s.equipment = Math.max(s.equipment, plan.equipment || 0); s.location = plan.location;
  const inputQuality = d.inputs.reduce((sum,i) => sum + i.quality, 0) / d.inputs.length;
  let quality = clamp(plan.quality * supplier.quality * inputQuality / .8 + s.equipment * 3, 1, 100);
  if (d.recipe.knobs.length) {
    const ideal = d.recipe.ideal?.default || {};
    const distance = d.recipe.knobs.reduce((sum,k) => sum + Math.abs((plan.recipe?.[k] ?? 4) - (ideal[k] ?? 4)), 0);
    quality *= Math.max(.25, 1 - distance / (d.recipe.knobs.length * 12));
  }
  const inventoryBased = adapter.constraint === 'inventory';
  const productionLimit = Math.min(d.capacity, d.production.hours * 60 / d.production.minutes * d.production.batchSize);
  const purchases = inventoryBased ? Math.floor(Math.min(plan.production, productionLimit * (1 + s.equipment * .15)) / d.production.batchSize) * d.production.batchSize : 0;
  const stockCost = purchases * costPerUnit;
  if (purchases && delivered) s.pipeline.push({ due: period + d.leadTime, qty: purchases, value: stockCost });
  // An unreliable supplier refunds the undelivered order rather than charging it.
  const inputCash = delivered ? stockCost : 0;
  s.pipeline = s.pipeline.filter(batch => { if (batch.due > period) return true; s.inventory += batch.qty; s.inventoryValue += batch.value; return false; });
  const previousShare = s.logs.at(-1)?.share || 0;
  const rivalPrice = d.referencePrice.typical * (previousShare > .19 ? .78 : .9) * (.96 + rivalNoise * .08);
  const rivals = [ { name: 'Low-cost challenger', strategy: 'Discounter', price: rivalPrice, quality: 55, brand: .2 }, { name: 'Premium neighbor', strategy: 'Premium', price: d.referencePrice.typical * 1.4, quality: 92, brand: previousShare > .19 ? .7 : .4 } ];
  const channelCards = d.channels.map(c => {
    const spend = plan.marketing[c.id], saturated = c.saturation * (1 - Math.exp(-spend / c.saturation));
    const impressions = Math.round(saturated * c.reach), visitors = Math.round(impressions * c.conversion);
    return { id: c.id, label: c.label, spend, impressions, visitors, customers: 0, cac: null };
  });
  const marketingCost = channelCards.reduce((a,c) => a + c.spend, 0);
  const visitsFromMarketing = channelCards.reduce((a,c) => a + c.visitors, 0);
  s.awareness = clamp(s.awareness * .985 + visitsFromMarketing / (d.baseTraffic * 20) + Math.max(0, s.reputation) * .012, .001, .95);
  const seasonIndex = d.scale === 'month' ? (period - 1) % 12 : Math.floor((period - 1) / 30) % 12;
  const weather = Math.max(.15, 1 + d.demand.weatherWeight * (actual.temperature - 70) / 20 - (actual.rain ? .45 : 0));
  const trafficMean = Math.min(100000, d.baseTraffic * (1 + d.growth) ** Math.min(120, period) * d.demand.seasonality[seasonIndex] * (shock?.traffic || 1) * (d.scale === 'day' ? weather : 1) * (1 + .25 * (plan.location - 1)) * (1 + .5 * s.reputation) * (.75 + .5 * demandNoise));
  const ticks = d.scale === 'day' ? 480 : 1;
  const arrivalsRandom = rng(s, period, 'arrivals');
  const expected = Math.min(100000, trafficMean * (.5 + s.awareness) + visitsFromMarketing);
  let remainingArrivals = 100000;
  const arrivalsByTick = Array.from({ length: ticks }, (_, tick) => {
    const hourly = d.scale === 'day' ? .5 + Math.sin(Math.PI * (tick + .5) / ticks) ** 2 : 1;
    const arrivals = Math.min(remainingArrivals, poisson(expected / ticks * hourly, arrivalsRandom));
    remainingArrivals -= arrivals; return arrivals;
  });
  const totalArrivals = arrivalsByTick.reduce((sum, value) => sum + value, 0);
  const outcomes = { bought: 0, 'too expensive': 0, "didn't like it": 0, 'sold out': 0, 'line too long': 0, 'not interested': 0, 'chose rival': 0 };
  const trace = [], segmentSales = Object.fromEntries(d.segments.map(x => [x.id, 0]));
  let revenue = 0, cogs = 0, serviceUsed = 0, satTotal = 0, backlog = 0;
  const laborCapacity = Math.floor(productionLimit * plan.staff * (1 + s.equipment * .15));
  const capacity = adapter.constraint === 'sellers' ? Math.min(d.capacity, plan.sellers * 20) : adapter.constraint === 'support' ? laborCapacity : adapter.constraint === 'attention' ? d.capacity : laborCapacity;
  // Subscription renewal happens before acquisition; support capacity constrains total active customers.
  let churned = 0;
  if (adapter.recurring) {
    churned = Math.min(s.customers, Math.round(s.customers * clamp(d.churnRate * (1.5 - quality / 100) * (.8 + .4 * retentionNoise), 0, 1)));
    s.customers -= churned;
    const renewals = Math.min(s.customers, capacity);
    churned += s.customers - renewals; s.customers = renewals;
    revenue += renewals * plan.price; cogs += renewals * costPerUnit; serviceUsed += renewals;
  }
  const weights = d.segments.reduce((sum, x) => sum + x.share, 0);
  let arrivalIndex = 0, nextFree = 0;
  for (let tick = 0; tick < ticks; tick++) {
    const batch = arrivalsByTick[tick];
    for (let j = 0; j < batch; j++) {
      const draws = [random(),random(),random(),random(),random()]; // same customer streams across paired plans
      let choice = draws[0] * weights;
      const segment = d.segments.find(x => (choice -= x.share) <= 0) || d.segments.at(-1);
      const budget = d.referencePrice.typical * segment.budget * (.8 + draws[1] * .4);
      const ours = utility(quality, plan.price, segment, d, s.reputation);
      const oursWeight = Math.exp(clamp(ours, -15, 15));
      const rivalWeight = rivals.reduce((a,r) => a + Math.exp(clamp(utility(r.quality, r.price, segment, d, r.brand), -15, 15)), 0);
      let reason;
      const willingness = draws[2];
      if (plan.price > budget) reason = 'too expensive';
      else if (draws[3] > Math.min(1, segment.affinity)) reason = 'not interested';
      else if (willingness > purchaseProbability(ours)) reason = "didn't like it";
      else if (draws[4] > oursWeight / (oursWeight + rivalWeight)) reason = 'chose rival';
      else if (inventoryBased && s.inventory < 1) reason = 'sold out';
      else if (serviceUsed >= capacity || (d.scale === 'day' && nextFree - tick > segment.patience)) { reason = 'line too long'; backlog++; }
      else {
        reason = 'bought'; serviceUsed++; segmentSales[segment.id]++;
        nextFree = Math.max(tick, nextFree) + ticks / Math.max(1, capacity);
        const effectivePrice = plan.price * (adapter.constraint === 'sellers' ? d.takeRate : 1);
        revenue += effectivePrice;
        if (inventoryBased) { const averageCost = s.inventoryValue / Math.max(1, s.inventory); s.inventory--; s.inventoryValue = Math.max(0, s.inventoryValue - averageCost); cogs += averageCost; }
        else cogs += costPerUnit;
        satTotal += clamp(quality / 100 - Math.max(0, plan.price / d.referencePrice.typical - 1) * .25 - Math.max(0, nextFree - tick) / 100, 0, 1);
      }
      outcomes[reason]++;
      if (options.trace !== false) trace.push({ tick, minute: 9 * 60 + tick, customer: ++arrivalIndex, segment: segment.id, reason, price: plan.price, quality });
    }
  }
  if (adapter.recurring) s.customers += outcomes.bought; else s.customers = outcomes.bought;
  const satisfaction = outcomes.bought ? satTotal / outcomes.bought : .5;
  s.reputation = clamp(s.reputation * .85 + (satisfaction * 2 - 1) * .15 - (outcomes['sold out'] / Math.max(1,totalArrivals)) * .1, -1, 1);
  s.awareness = clamp(s.awareness + outcomes.bought * d.repeatRate * Math.max(0, satisfaction - .5) / Math.max(1,d.baseTraffic), .001, .95);
  const spoiled = inventoryBased ? Math.floor(s.inventory * d.perishability.rate / (1 + s.equipment * .3)) : 0;
  const spoilageCost = spoiled * s.inventoryValue / Math.max(1,s.inventory);
  s.inventory -= spoiled; s.inventoryValue = Math.max(0, s.inventoryValue - spoilageCost);
  const rent = d.rent * plan.location, wages = d.wage * plan.staff, interest = s.debt * (d.scale === 'day' ? .0005 : .015);
  const expenses = cogs + spoilageCost + rent + wages + marketingCost + interest;
  const profit = revenue - expenses;
  const cashOut = inputCash + (inventoryBased ? 0 : cogs) + rent + wages + marketingCost + interest + equipmentPurchase + tierCost;
  const cashBefore = s.cash; s.cash += revenue - cashOut;
  s.negativePeriods = s.cash < 0 ? s.negativePeriods + 1 : 0;
  const creditLimit = Math.max(d.startingCash * .2, (s.totalRevenue + revenue) * .5);
  const availableCredit = Math.max(0, creditLimit - s.debt);
  s.bankrupt = (d.scale === 'month' ? s.cash < 0 : s.negativePeriods >= 3) && s.cash + availableCredit < 0;
  s.totalRevenue += revenue; s.totalProfit += profit; s.totalSales += outcomes.bought; s.period = period;
  s.lastPlan = copy(plan);
  // Attribute marketing customers proportionally; allocations never exceed actual new customers.
  let remaining = outcomes.bought;
  for (const c of channelCards) { c.customers = Math.min(remaining, Math.round(outcomes.bought * c.visitors / Math.max(1,totalArrivals))); remaining -= c.customers; c.cac = c.customers ? c.spend / c.customers : null; }
  const recurringRevenue = adapter.recurring ? s.customers * plan.price : 0;
  const report = { period, defVersion: d.version, seed: s.seed, weather: actual, rivals, arrivals: totalArrivals, outcomes, traceCount: trace.length, segmentSales, revenue, cogs, spoilageCost, spoiled, rent, wages, marketingCost, interest, equipmentPurchase, tierCost, inputCash, profit, cashBefore, cash: s.cash, cashChange: revenue - cashOut, availableCredit, inventory: s.inventory, reputation: s.reputation, satisfaction, channelCards, share: outcomes.bought / Math.max(1,totalArrivals), capacity, used: serviceUsed, backlog, churned, mrr: recurringRevenue, arr: recurringRevenue * 12, utilization: serviceUsed / Math.max(1,capacity), supplierDelivered: delivered, forecast: predicted, bankrupt: s.bankrupt };
  s.logs = [...s.logs, report].slice(-48);
  s.history = [...s.history, { period, cash: s.cash, revenue, profit }].slice(-120);
  return { state: advanceBusinessChallenge(s), report, trace };
}

export function metricsFor(s) { return { cash: s.cash, profit: s.totalProfit, revenue: s.totalRevenue, reputation: s.reputation, survival: s.bankrupt ? 0 : 1, customers: s.totalSales }; }
export function financeAction(input, type, amount) {
  const s = copy(input); requireApproved(s.def);
  if (s.bankrupt) throw new Error('Bankrupt businesses cannot finance new operations.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount.');
  const limit = Math.max(s.def.startingCash * .2, s.totalRevenue * .5);
  if (type === 'loan') { if (s.debt + amount > limit) throw new Error(`Credit limit is $${limit.toFixed(0)}.`); s.cash += amount; s.debt += amount; }
  else if (type === 'repay') { if (amount > s.cash || amount > s.debt) throw new Error('Repayment exceeds cash or debt.'); s.cash -= amount; s.debt -= amount; }
  else if (type === 'equity') {
    if ((s.financing || []).some(event => event.type === 'equity' && event.period === s.period)) throw new Error('Only one investor round is available per period.');
    if (s.scale !== 'month' || s.period < 2 || s.totalRevenue < s.def.startingCash * .1) throw new Error('Investors require two months and sales of at least 10% of starting cash.');
    if (amount > s.totalRevenue * 2) throw new Error('Offer exceeds 2× lifetime sales.');
    const valuation = Math.max(s.def.startingCash, s.totalRevenue * 4);
    s.ownership *= valuation / (valuation + amount); s.cash += amount;
  } else throw new Error('Unknown financing action.');
  s.financing = [...(s.financing || []), { type, amount, period: s.period, cash: s.cash, debt: s.debt, ownership: s.ownership }];
  return s;
}
