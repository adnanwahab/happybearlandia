import { executeDecisionExperiment } from '../../decision/kernel.js';
import { businessModel, simulatePeriod, metricsFor, forecast } from './index.js';
import { copy } from './schema.js';

export function simulateBusinessRun(initial, plan, seed, horizon, { trace = false } = {}) {
  const announcedForecast = forecast(initial, 1)[0];
  let state = copy(initial); state.seed = seed;
  const timeline = [{ year: 0, period: state.period, metrics: metricsFor(state) }];
  const reports = [], traces = [];
  for (let i = 0; i < horizon && !state.bankrupt; i++) {
    const result = simulatePeriod(state, plan, { trace, ...(i === 0 ? { forecast: announcedForecast } : {}) }); state = result.state;
    reports.push(result.report); if (trace) traces.push(result.trace);
    timeline.push({ year: (i + 1) / (state.scale === 'month' ? 12 : 365), period: state.period, metrics: metricsFor(state) });
  }
  const causes = [];
  const revenue = reports.reduce((s,r) => s + r.revenue, 0), marketing = reports.reduce((s,r) => s + r.marketingCost, 0);
  const sold = reports.reduce((s,r) => s + r.outcomes.bought, 0), lost = reports.reduce((s,r) => s + r.outcomes['sold out'], 0);
  if (marketing > revenue * .4) causes.push('Acquisition spend above 40% of sales');
  if (reports.some(r => r.wages > r.revenue * .5)) causes.push('Payroll above 50% of sales');
  if (lost > sold * .2) causes.push('Stockouts lost potential sales');
  if (reports.some(r => r.spoilageCost > r.revenue * .2)) causes.push('Spoilage above 20% of sales');
  if (reports.some(r => r.outcomes['too expensive'] > r.arrivals * .4)) causes.push('Price exceeded customer budgets');
  if (reports.some(r => r.weather.event?.id === 'shortage')) causes.push('Supplier cost shock');
  if (reports.some(r => r.outcomes['line too long'] > r.arrivals * .1)) causes.push('Service capacity constrained sales');
  const metrics = metricsFor(state);
  return { state, reports, traces, metrics, timeline, drivers: causes, events: [], accounting: { defVersion: initial.def.version, horizon, cashStart: initial.cash, seed } };
}
export function bucketRun(run, initial) {
  if (!run.metrics.survival) return 'bankrupt';
  if (run.metrics.cash < initial.def.startingCash * .15) return 'funding';
  if (run.metrics.profit > initial.totalProfit) return 'profitable';
  return 'small';
}
export function summarizeFutures(runs, initial) {
  const buckets = Object.fromEntries(['profitable','small','funding','bankrupt'].map(key => [key, 0]));
  const completed = runs.filter(r => r.status === 'completed').map(r => ({ ...r, bucket: bucketRun(r, initial) }));
  for (const r of completed) buckets[r.bucket]++;
  const adverse = completed.filter(r => ['bankrupt','funding'].includes(r.bucket)), rest = completed.filter(r => !['bankrupt','funding'].includes(r.bucket));
  const causes = [...new Set(completed.flatMap(r => r.drivers))].map(cause => {
    const count = rows => rows.filter(r => r.drivers.includes(cause)).length;
    return { cause, adverseCount: count(adverse), adverseShare: adverse.length ? count(adverse) / adverse.length : 0, otherShare: rest.length ? count(rest) / rest.length : 0, adverseTotal: adverse.length };
  }).sort((a,b) => (b.adverseShare - b.otherShare) - (a.adverseShare - a.otherShare));
  const cash = completed.map(r => r.metrics.cash).sort((a,b) => a - b);
  return { runs: completed, buckets, causes, count: completed.length, failed: runs.length - completed.length, survival: completed.length ? 1 - buckets.bankrupt / completed.length : 0, medianCash: cash[Math.floor(cash.length / 2)] ?? 0, p10: cash[Math.floor(cash.length * .1)] ?? 0, p90: cash[Math.floor(cash.length * .9)] ?? 0 };
}
export function suggestedPlan(plan, summary) {
  const next = copy(plan), cause = summary.causes[0]?.cause || '';
  let explanation;
  if (/Stockouts/.test(cause)) { next.production = Math.min(100000, Math.ceil(plan.production * 1.25)); explanation = 'Raise production 25% to test the stockout hypothesis.'; }
  else if (/Payroll|Service capacity/.test(cause)) { next.staff = /Service/.test(cause) ? Math.min(100,plan.staff + 1) : Math.max(1,plan.staff - 1); explanation = 'Test a change of one employee against the same futures.'; }
  else if (/Price/.test(cause)) { next.price = Math.max(.01, Math.round(plan.price * .9 * 100) / 100); explanation = 'Test a 10% lower price against the same futures.'; }
  else if (/Spoilage/.test(cause)) { next.production = Math.max(1, Math.round(plan.production * .75)); explanation = 'Test 25% lower production to reduce spoilage.'; }
  else { for (const key of Object.keys(next.marketing)) next.marketing[key] = Math.round(next.marketing[key] * .65); next.price = Math.round(next.price * 1.05 * 100) / 100; explanation = 'Test 35% less acquisition spending and a 5% higher price.'; }
  if (JSON.stringify(next) === JSON.stringify(plan)) { next.price = Math.round(plan.price * 1.05 * 100) / 100; explanation = 'Staffing is already at its bound. Test a 5% price increase instead.'; }
  return { plan: next, explanation };
}
// Uses the same generic experiment executor as housing. Business periods stay explicit
// in the closure; the executor's years argument is deliberately not a calendar input.
export async function runFutures(initial, plan, { count = 500, horizon = initial.scale === 'month' ? 24 : 30, alternatives = [], onProgress = () => {}, shouldCancel = () => false } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 500 || !Number.isInteger(horizon) || horizon < 1 || horizon > 60) throw new Error('Use 1–500 futures and 1–60 periods.');
  const plans = [plan, ...alternatives.slice(0, 3)];
  const experiment = { id: 'business-futures', seed: initial.seed, runs: count, years: 1, scenarios: plans.map((p,i) => ({ id: `plan-${i}`, name: i ? `Alternative ${i}` : 'Current plan', kind: i ? 'alternative' : 'baseline', parameters: {}, uncertainty: {}, stressPresets: [], _plan: p })) };
  // The kernel passes numeric parameter maps; a per-scenario index bridges to
  // immutable business state and the approved definition without changing housing.
  experiment.scenarios.forEach((s,i) => s.parameters = { planIndex: i });
  const model = { ...businessModel, parameters: [{ id: 'planIndex', default: 0, min: 0, max: 3 }] };
  const result = await executeDecisionExperiment({ experiment, model, yieldEvery: 5, shouldCancel, onProgress: update => onProgress(update.progress),
    simulateRun: ({ parameters, seed }) => simulateBusinessRun(initial, plans[parameters.planIndex], seed, horizon),
  });
  return { status: result.status, model: { id: model.id, version: model.version }, defVersion: initial.def.version, initial: copy(initial), plans: copy(plans), horizon,
    summaries: plans.map((_,i) => summarizeFutures(result.runs.filter(r => r.scenarioId === `plan-${i}`), initial)), comparisons: result.comparisons };
}
export function replayFuture(result, index, alternative = 0) {
  const row = result.summaries[alternative].runs[index];
  if (!row) throw new Error('Future not found.');
  return simulateBusinessRun(result.initial, result.plans[alternative], row.seed, result.horizon, { trace: true });
}
export function searchPlans(plan) {
  return [
    { ...copy(plan), production: Math.round(plan.production * .7), marketing: Object.fromEntries(Object.entries(plan.marketing).map(([k,v]) => [k,Math.round(v * .6)])) },
    { ...copy(plan), price: Math.round(plan.price * 1.1 * 100) / 100, quality: Math.min(100,plan.quality + 5) },
    { ...copy(plan), production: Math.min(100000,Math.round(plan.production * 1.3)), staff: Math.min(100,plan.staff + 1), marketing: Object.fromEntries(Object.entries(plan.marketing).map(([k,v]) => [k,Math.round(v * 1.4)])) },
  ];
}
export function paretoFrontier(summaries) {
  const rows = summaries.map((s,i) => ({ index: i, survival: s.survival, cash: s.medianCash, sales: s.runs.reduce((a,r) => a + r.metrics.customers, 0) / Math.max(1,s.count) }));
  return rows.filter(a => !rows.some(b => b.index !== a.index && b.survival >= a.survival && b.cash >= a.cash && b.sales >= a.sales && (b.survival > a.survival || b.cash > a.cash || b.sales > a.sales)));
}
