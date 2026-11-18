import { normalizeStorm, compileStorm, CROSSING_DRAINS, stormCost } from './scenario.js';
import { simulateWater, WATER_MODEL_VERSION } from './physics.js';
import { consequences } from './compare.js';

export const RESCUE_VERSION = 'storm-rescue.v1';
export function replayRescue(plan) {
  if (plan.version !== RESCUE_VERSION || !['none', 'crossing'].includes(plan.resources) || !['before', 'missed'].includes(plan.timing)) throw new Error('Unsupported plan');
  const baseline = normalizeStorm();
  const adjusted = normalizeStorm({ ...baseline, edits: plan.resources === 'crossing' && plan.timing === 'before' ? CROSSING_DRAINS : [] });
  return { version: RESCUE_VERSION, source: 'Synthetic storm-neighborhood.v1; no observed rescue or forecast data',
    model: WATER_MODEL_VERSION, seed: baseline.seed, baseline, adjusted,
    spent: adjusted.edits.length ? stormCost(adjusted) : 0,
    outcome: plan.timing === 'missed' ? 'missed' : 'modeled', realWorldOutcome: 'unknown',
    control: consequences(simulateWater(compileStorm(baseline))).totals,
    response: consequences(simulateWater(compileStorm(adjusted))).totals };
}

// Single-process, synchronous compare-and-commit. No await between revision check and publication.
export function createRescueHandler({ now = Date.now, token = () => crypto.randomUUID() } = {}) {
  const rooms = new Map();
  const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  return async request => {
    for (const [id, room] of rooms) if (room.expires <= now()) rooms.delete(id);
    const parts = new URL(request.url).pathname.split('/').filter(Boolean);
    try {
      if (request.method === 'POST' && parts.length === 3) {
        if (rooms.size >= 100) return json({ error: 'Room capacity reached' }, 503);
        const id = token(), crew = token(), budget = token();
        rooms.set(id, { crew, budget, revision: 0, resources: null, timing: null, receipt: null, expires: now() + 3600000 });
        return json({ id, crew, budget, revision: 0 }, 201);
      }
      const room = rooms.get(parts[3]);
      if (!room) return json({ error: 'Room missing or expired; outcome unknown' }, 404);
      const credential = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      const role = credential === room.crew ? 'crew' : credential === room.budget ? 'budget' : null;
      if (!role) return json({ error: 'Access denied' }, 403);
      if (request.method === 'DELETE') { rooms.delete(parts[3]); return json({ deleted: true }); }
      const snapshot = () => ({ revision: room.revision, resources: room.resources, timing: room.timing, receipt: room.receipt, expires: room.expires });
      if (request.method === 'GET') return json(snapshot());
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      const raw = await request.text();
      if (raw.length > 1024) return json({ error: 'Proposal too large' }, 413);
      const body = JSON.parse(raw);
      // Recheck expiry/deletion after reading the request body.
      if (rooms.get(parts[3]) !== room || room.expires <= now()) return json({ error: 'Room missing or expired' }, 404);
      if (body.action === 'replay' && room.receipt) return json({ ...snapshot(), replay: replayRescue(room.receipt.plan) });
      if (body.revision !== room.revision || room.receipt) return json({ error: 'Plan changed or already committed' }, 409);
      if (body.action === 'commit') {
        if (role !== 'budget') return json({ error: 'Budget role required' }, 403);
        if (room.resources === null || room.timing === null) return json({ error: 'Both proposals required; outcome unknown' }, 422);
        const plan = { version: RESCUE_VERSION, resources: room.resources, timing: room.timing };
        const run = replayRescue(plan);
        if (run.spent > 480000) return json({ error: 'Budget exceeded' }, 422);
        room.receipt = { plan, run, committedRevision: room.revision };
      } else if (body.action === 'propose') {
        if (role === 'crew' && ['none', 'crossing'].includes(body.value)) room.resources = body.value;
        else if (role === 'budget' && ['before', 'missed'].includes(body.value)) room.timing = body.value;
        else return json({ error: 'Unsupported role action' }, 422);
      } else return json({ error: 'Unsupported action' }, 422);
      room.revision++;
      return json(snapshot());
    } catch { return json({ error: 'Invalid request or unavailable model; outcome unknown' }, 400); }
  };
}
