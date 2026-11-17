import { normalizePlan, runPlan } from '../../world/invention/model.js';
import { createPrediction, resolvePrediction } from '../../world/learning/prediction.js';

// Ephemeral local rehearsal. Capabilities never appear in public pool projections.
export function createPredictionPoolHandler({ enabled = false, now = Date.now, run = runPlan } = {}) {
  const pools = new Map();
  const token = () => crypto.randomUUID();
  return async function handle(request, address) {
    const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    if (!enabled || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return reply({ error: 'Local rehearsal unavailable.' }, 403);
    if (request.method !== 'POST') return reply({ error: 'POST required.' }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply({ error: 'Access denied.' }, 403);
    try {
      if (Number(request.headers.get('content-length')) > 4096) throw Error('Request too large.');
      const raw = await request.text();
      if (raw.length > 4096) throw Error('Request too large.');
      const data = JSON.parse(raw);
      for (const [id, pool] of pools) if (now() >= pool.expires) pools.delete(id);
      if (data.action === 'create') {
        if (pools.size >= 20) throw Error('Local pool limit reached.');
        const plan = normalizePlan(data.plan);
        createPrediction(plan, { metric: data.metric, expected: 0 });
        const id = token(), host = token(), invite = token();
        pools.set(id, { plan, metric: data.metric, host, invite, expires: now() + 3600000, members: new Map(), state: 'open' });
        return reply({ id, host, invite, expires: now() + 3600000 });
      }
      const pool = pools.get(data.id);
      if (!pool) return reply({ error: 'Pool missing or expired.' }, 404);
      if (data.action === 'join') {
        if (data.invite !== pool.invite || pool.state !== 'open') return reply({ error: 'Invite expired or access denied.' }, 403);
        if (pool.members.size >= 12) throw Error('Group is full.');
        const member = token();
        pool.members.set(member, null);
        return reply({ member });
      }
      const host = data.key === pool.host;
      if (!host && !pool.members.has(data.key)) return reply({ error: 'Access denied.' }, 403);
      if (data.action === 'delete') {
        if (host) pools.delete(data.id); else { pool.members.delete(data.key); pool.rows?.delete(data.key); }
        return reply({ deleted: true });
      }
      if (data.action === 'commit') {
        if (host || pool.state !== 'open' || pool.members.get(data.key)) throw Error('Commitment is locked.');
        const direction = ['down', 'same', 'up'].includes(data.direction) ? data.direction : null;
        if (data.direction && !direction) throw Error('Invalid direction.');
        const prediction = createPrediction(pool.plan, { metric: pool.metric, expected: direction ? 0 : data.expected }, new Date(now()).toISOString());
        pool.members.set(data.key, { prediction, direction });
      } else if (data.action === 'reveal') {
        if (!host) return reply({ error: 'Host required.' }, 403);
        if (pool.state === 'open') {
          // Freeze entry and commitments before any model computation; failed runs never reopen guesses.
          pool.state = 'locked';
          try {
            const baseline = run({ ...pool.plan, policies: [] }), adjusted = run(pool.plan);
            pool.rows = new Map([...pool.members.entries()].filter(([, value]) => Boolean(value)).map(([member, { prediction, direction }]) => {
              const result = resolvePrediction(prediction, baseline, adjusted);
              return [member, { expected: direction || prediction.expected, actual: result.actual, unit: result.unit,
                absoluteError: direction ? null : result.absoluteError,
                correct: direction && result.actual !== null ? direction === (result.actual < 0 ? 'down' : result.actual > 0 ? 'up' : 'same') : null }];
            }));
            pool.provenance = { recipe: adjusted.recipe, scenarioVersion: adjusted.scenarioVersion, targetMonth: adjusted.final.month, source: 'Versioned synthetic Riverside City; paired no-policy control', sampleCount: 1 };
            pool.state = 'revealed';
          } catch { pool.state = 'unavailable'; }
        }
      } else if (!['read', 'commit'].includes(data.action)) throw Error('Unsupported action.');
      return reply({ state: pool.state, plan: pool.plan, metric: pool.metric, expires: pool.expires,
        members: pool.members.size, committed: [...pool.members.values()].filter(Boolean).length,
        ownCommitted: !host && Boolean(pool.members.get(data.key)),
        ...(pool.state === 'revealed' ? { rows: [...pool.rows.values()], provenance: pool.provenance } : {}) });
    } catch (error) { return reply({ error: error.message }, 400); }
  };
}
