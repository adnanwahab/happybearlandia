// Process-local admission budget. Never derive identity from user-controlled headers.
export function isSimulationSubmission(request) {
  if (request.method !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  if (/\/(cancel|pause)$/.test(path)) return false;
  return ['/api/runs', '/api/world/experiments', '/api/decision-experiments',
    '/api/decision-optimizations', '/api/city-experiments'].some(base => path === base || path.startsWith(base + '/'));
}

// Only an explicitly configured test process may raise its isolated budget.
// Requests, headers and ordinary production environment settings cannot opt in.
export function simulationAdmissionOptionsFromEnv(env = {}) {
  if (env.NODE_ENV !== 'test') return {};
  const options = {};
  for (const [name, key] of [
    ['HBL_TEST_SIMULATION_PER_CLIENT', 'perClient'],
    ['HBL_TEST_SIMULATION_TOTAL', 'total'],
  ]) {
    if (env[name] === undefined) continue;
    if (!/^[1-9]\d*$/.test(env[name]) || !Number.isSafeInteger(Number(env[name]))) {
      throw new Error(`Invalid test admission limit: ${name}`);
    }
    options[key] = Number(env[name]);
  }
  return options;
}

export function createSimulationAdmission({ now = Date.now, windowMs = 60_000,
  perClient = 6, total = 60, maxClients = 4096 } = {}) {
  for (const value of [windowMs, perClient, total, maxClients]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid admission limit');
  }
  const clients = new Map();
  let global = { used: 0, until: 0 };
  return function admit(request, address) {
    if (!isSimulationSubmission(request)) return null;
    const time = now();
    if (time >= global.until) global = { used: 0, until: time + windowMs };
    // Expired entries can be reclaimed; live entries must never be evicted to bypass a limit.
    for (const [key, entry] of clients) if (time >= entry.until) clients.delete(key);
    const key = address || 'unknown';
    let client = clients.get(key);
    let until = 0;
    if (global.used >= total) until = global.until;
    if (client?.used >= perClient) until = Math.max(until, client.until);
    if (!client && clients.size >= maxClients) {
      until = Math.max(until, Math.min(...Array.from(clients.values(), entry => entry.until)));
    }
    if (until) {
      const retryAfterSeconds = Math.max(1, Math.ceil((until - time) / 1000));
      return Response.json({ error: 'Simulation submission limit reached. Retry after the indicated delay.',
        code: 'simulation_rate_limited', retryAfterSeconds }, { status: 429,
        headers: { 'retry-after': String(retryAfterSeconds), 'cache-control': 'no-store' } });
    }
    if (!client) { client = { used: 0, until: time + windowMs }; clients.set(key, client); }
    client.used++;
    global.used++;
    return null;
  };
}
