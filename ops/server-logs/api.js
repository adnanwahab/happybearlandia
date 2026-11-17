import { captureConsole, createServerLogRecorder, instrumentFetch } from './capture.js';
import { normalizePath } from './redact.js';
import { createServerLogStore, DEFAULT_LOG_DIR } from './store.js';

export const SCHEMA = 'server-logs.v1';
const DAY_MS = 86400000;
const LEVELS = { info: 0, warn: 1, error: 2 };
const TYPES = new Set(['request', 'exception', 'console', 'lifecycle', 'notice']);
const UNITS = { m: 60000, h: 3600000, d: DAY_MS };
const OFF = /^(0|off|false|no|disabled)$/i;
const PRIVACY = 'Redacted before storage: no IP addresses, query strings, headers, cookies or request bodies are kept, '
  + 'and IDs, share codes, emails, tokens and coordinates are removed from paths and messages.';
const NOT_RECORDED = ['successful static-asset requests', 'successful health checks', 'requests to /api/server-logs',
  'Fly platform logs (proxy, machine start and stop)'];

const json = (body, status = 200, headers = {}) => Response.json(body, {
  status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...headers },
});

function parseSince(value, now, retentionDays) {
  const floor = now - retentionDays * DAY_MS;
  if (value === null || value === '') return Math.max(floor, now - DAY_MS);
  const relative = /^(\d{1,4})([mhd])$/.exec(value);
  if (relative) return Math.max(floor, now - Number(relative[1]) * UNITS[relative[2]]);
  const at = Date.parse(value);
  if (!Number.isFinite(at)) throw new Error('since must be a duration such as 30m, 6h or 2d, or an ISO timestamp.');
  return Math.min(now, Math.max(floor, at));
}

export function parseQuery(params, now, retentionDays) {
  const since = parseSince(params.get('since'), now, retentionDays);
  let until = now;
  if (params.get('until')) {
    const at = Date.parse(params.get('until'));
    if (!Number.isFinite(at)) throw new Error('until must be an ISO timestamp.');
    until = Math.min(now, at);
  }
  if (until < since) throw new Error('until must be later than since.');
  const level = params.get('level') || 'info';
  if (!Object.hasOwn(LEVELS, level)) throw new Error('level must be info, warn or error.');
  const type = params.get('type') || null;
  if (type && !TYPES.has(type)) throw new Error('type must be request, exception, console, lifecycle or notice.');
  const limitText = params.get('limit');
  const limit = limitText === null ? 200 : Number(limitText);
  if (!/^\d{1,4}$/.test(limitText ?? '200') || limit > 1000) throw new Error('limit must be a whole number from 0 to 1000.');
  const path = params.get('path') ? normalizePath(params.get('path')) : null;
  return { since, until, level, type, limit, path };
}

function bump(map, key, base, at) {
  const item = map.get(key) || { ...base, count: 0, firstAt: at, lastAt: at };
  item.count++;
  if (at < item.firstAt) item.firstAt = at;
  if (at > item.lastAt) item.lastAt = at;
  map.set(key, item);
}
const top = (items, score, count) => [...items].sort((a, b) => score(b) - score(a)).slice(0, count);
function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))];
}

// Aggregates the whole matching window, not only the entries returned, so a reader
// sees which routes fail or crawl and which errors repeat at a glance.
export function summarizeEntries(entries) {
  const byLevel = { info: 0, warn: 0, error: 0 };
  const byType = {};
  const byStatusClass = {};
  const byKind = {};
  const routes = new Map();
  const missing = new Map();
  const failures = new Map();
  const problems = new Map();
  const builds = new Set();
  let requests = 0;
  let serverStarts = 0;
  for (const entry of entries) {
    if (Object.hasOwn(byLevel, entry.level)) byLevel[entry.level]++;
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    if (entry.type === 'request') {
      requests++;
      const statusClass = `${Math.floor(entry.status / 100)}xx`;
      byStatusClass[statusClass] = (byStatusClass[statusClass] || 0) + 1;
      byKind[entry.kind] = (byKind[entry.kind] || 0) + 1;
      const key = `${entry.method} ${entry.path}`;
      const route = routes.get(key) || { method: entry.method, path: entry.path, kind: entry.kind, count: 0, errors: 0, ms: [] };
      route.count++;
      if (entry.status >= 400) route.errors++;
      if (Number.isFinite(entry.ms) && route.ms.length < 5000) route.ms.push(entry.ms);
      routes.set(key, route);
      if (entry.status === 404) bump(missing, entry.path, { path: entry.path }, entry.t);
      if (entry.status >= 500) bump(failures, `${key} ${entry.status}`, { method: entry.method, path: entry.path, status: entry.status }, entry.t);
    } else if (entry.type === 'lifecycle') {
      if (entry.message === 'server started') serverStarts++;
      if (entry.build) builds.add(entry.build);
    } else {
      const message = entry.type === 'exception' ? `${entry.name}: ${entry.message}` : entry.message;
      bump(problems, `${entry.type}|${entry.level}|${entry.path || ''}|${message}`,
        { type: entry.type, level: entry.level, message, ...(entry.path ? { path: entry.path } : {}) }, entry.t);
    }
  }
  const routeList = [...routes.values()].map(({ ms, ...route }) => ({
    ...route, p95Ms: percentile(ms, 0.95), maxMs: ms.length ? ms.reduce((a, b) => Math.max(a, b)) : null,
  }));
  return {
    entries: entries.length, byLevel, byType,
    requests: {
      total: requests, byStatusClass, byKind,
      topPaths: top(routeList, route => route.count, 15),
      notFound: top(missing.values(), item => item.count, 15),
      serverErrors: top(failures.values(), item => item.count, 15),
      slowest: top(routeList.filter(route => route.p95Ms !== null), route => route.p95Ms, 10)
        .map(({ method, path, count, p95Ms, maxMs }) => ({ method, path, count, p95Ms, maxMs })),
    },
    problems: top(problems.values(), item => item.count, 20),
    serverStarts, builds: [...builds],
  };
}

export function createServerLogsHandler(options = {}) {
  const { store } = options;
  const now = options.now || Date.now;
  const cacheMs = options.cacheMs ?? 10000;
  const cache = new Map();
  return function handleServerLogs(request) {
    if (request.method !== 'GET') return json({ error: 'Use GET /api/server-logs.' }, 405, { allow: 'GET' });
    const url = new URL(request.url);
    const at = now();
    const key = [...url.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(pair => pair.join('=')).join('&');
    const cached = cache.get(key);
    if (cached && at - cached.at < cacheMs) return json(cached.body);
    let query;
    try {
      query = parseQuery(url.searchParams, at, store.retentionDays);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
    const { entries, truncated } = store.read({ since: query.since, until: query.until });
    const minimum = LEVELS[query.level];
    const matching = entries.filter(entry => (LEVELS[entry.level] ?? 0) >= minimum
      && (!query.type || entry.type === query.type)
      && (!query.path || String(entry.path || '').startsWith(query.path)));
    const body = {
      schemaVersion: SCHEMA,
      generatedAt: new Date(at).toISOString(),
      build: options.buildId || 'unknown',
      processStartedAt: options.startedAt || null,
      window: { since: new Date(query.since).toISOString(), until: new Date(query.until).toISOString() },
      query: { level: query.level, type: query.type, path: query.path, limit: query.limit },
      retentionDays: store.retentionDays,
      privacy: PRIVACY,
      notRecorded: NOT_RECORDED,
      truncated,
      summary: summarizeEntries(matching),
      entries: matching.slice(0, query.limit),
    };
    if (cache.size >= 100) cache.clear();
    cache.set(key, { at, body });
    return json(body);
  };
}

const notFound = () => new Response('Not found', { status: 404 });

// Server wiring: HBL_SERVER_LOG_DIR (default .hbl-private/server-logs),
// HBL_SERVER_LOG_RETENTION_DAYS (default 14) and HBL_SERVER_LOGS=off to disable.
// A bad configuration disables logging rather than stopping the game server.
export function createServerLogs(env = process.env, options = {}) {
  const buildId = String(env.HBL_BUILD_ID || 'unknown').slice(0, 80);
  const startedAt = new Date((options.now || Date.now)()).toISOString();
  const disabled = {
    enabled: false,
    instrument: handler => handler,
    captureConsole: () => () => {},
    started: () => false,
    handle: notFound,
  };
  if (OFF.test(env.HBL_SERVER_LOGS || '')) return disabled;
  let store;
  try {
    store = createServerLogStore({
      dir: env.HBL_SERVER_LOG_DIR || DEFAULT_LOG_DIR,
      retentionDays: env.HBL_SERVER_LOG_RETENTION_DAYS,
      now: options.now,
    });
  } catch (error) {
    console.error(`[server-logs] disabled: ${error.message}`);
    return disabled;
  }
  const recorder = createServerLogRecorder(store, { appRoot: options.appRoot });
  return {
    enabled: true,
    store,
    instrument: handler => instrumentFetch(handler, recorder),
    captureConsole: (target = console) => captureConsole(recorder, target),
    started: () => recorder.lifecycle('server started', { build: buildId }),
    handle: createServerLogsHandler({ store, buildId, startedAt, now: options.now }),
  };
}
