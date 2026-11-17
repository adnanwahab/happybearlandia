import { normalizePlan, planCost, POLICY_CATALOG } from '../model.js';

// Select existing authored catalog variants; never interpolate model inputs or cost.
export const CAPACITIES = Object.freeze([4, 8, 12]);
export function handleOptions(type, districtId) {
  return type === 'transit' && districtId === 'd1' ? CAPACITIES : null;
}
export function setCapacity(input, value) {
  const plan = normalizePlan(input);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Enter a finite capacity.');
  const amount = CAPACITIES.reduce((best, next) => Math.abs(next - value) < Math.abs(best - value) ? next : best);
  const id = POLICY_CATALOG.find(row => row.type === 'transit' && row.districtId === 'd1' && row.amount === amount).id;
  return normalizePlan({ ...plan, policies: [...plan.policies.filter(id => !id.startsWith('transit-d1-')), id] });
}
export function estimate(input) {
  const recipe = normalizePlan(input);
  const policy = POLICY_CATALOG.find(row => recipe.policies.includes(row.id) && row.type === 'transit' && row.districtId === 'd1');
  if (!policy) throw new Error('This plan has no supported Riverside transit handle.');
  return { recipe, capacity: policy.amount, cost: planCost(recipe), field: 'policies', policyId: policy.id };
}

// One queued paint, no permanent animation loop. Metrics describe UI pacing only.
export function createPacer({ request, cancel, now, paint }) {
  let pending = null, disposed = false;
  const metrics = { samples: 0, maxWaitMs: 0, slowFrames: 0, cancelled: 0 };
  return {
    metrics,
    schedule() {
      if (disposed || pending !== null) return;
      const start = now();
      pending = request(() => {
        pending = null;
        const wait = now() - start;
        metrics.samples++;
        metrics.maxWaitMs = Math.max(metrics.maxWaitMs, wait);
        if (wait > 34) metrics.slowFrames++;
        paint();
      });
    },
    dispose() {
      disposed = true;
      if (pending !== null) { cancel(pending); pending = null; metrics.cancelled++; }
    },
  };
}
