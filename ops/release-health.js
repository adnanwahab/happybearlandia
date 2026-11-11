import { Database } from 'bun:sqlite';
import { accessSync, constants, existsSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { DEFAULT_DECISION_STORE_DIR } from '../world/decision/store.js';
import { resolveWorldDatabasePath } from '../world/experiments/database-path.js';

const probeTTL = 2000;
const worldColumns = {
  world_experiment_saves: ['id', 'parent_id', 'created_at', 'bytes', 'metadata', 'data'],
  causal_runs: ['id', 'status', 'revision', 'data', 'content_hash'],
  causal_nodes: ['run_id', 'id', 'kind', 'sequence', 'time', 'data', 'content_hash'],
  causal_checkpoints: ['run_id', 'id', 'sequence', 'data', 'content_hash'],
  causal_edges: ['run_id', 'id', 'source_id', 'target_id', 'association', 'data', 'content_hash'],
};
const publicRoots = ['world', 'data', 'game', 'tools', 'blog', 'visualizations'];
const knownMigrations = new Set([1]);

export function publicBuildId(value, production = false) {
  return typeof value === 'string' && /^[a-f0-9]{7,64}$/i.test(value)
    ? value.toLowerCase() : production ? 'unknown' : 'development';
}

function readOnly(path, inspect) {
  const db = new Database(path, { readonly: true });
  try {
    db.exec('PRAGMA busy_timeout=100');
    return inspect(db);
  } finally {
    db.close();
  }
}

// This check runs before the World store applies its additive migrations.
export function assertWorldDatabaseCompatible(path) {
  if (path === ':memory:' || !existsSync(path)) return;
  if (!statSync(path).isFile()) throw new Error('World storage must be a SQLite file.');
  readOnly(path, db => {
    const { user_version: version } = db.query('PRAGMA user_version').get();
    if (version !== 0) throw new Error('World SQLite format version is unsupported by this release.');

    const rows = db.query("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const tables = new Set(rows.map(row => row.name));
    if (tables.size && !tables.has('world_experiment_saves') && !tables.has('causal_storage_migrations')) {
      throw new Error('SQLite file does not contain a recognized World or causal schema.');
    }
    for (const [table, required] of Object.entries(worldColumns)) {
      if (!tables.has(table)) continue;
      const fields = new Set(db.query(`PRAGMA table_info(${table})`).all().map(row => row.name));
      if (required.some(field => !fields.has(field))) throw new Error('World SQLite schema is incompatible with this release.');
    }
    if (tables.has('causal_storage_migrations')) {
      const versions = db.query('SELECT version FROM causal_storage_migrations').all();
      if (!versions.length || versions.some(row => !knownMigrations.has(row.version)) ||
          Object.keys(worldColumns).filter(key => key.startsWith('causal_')).some(key => !tables.has(key))) {
        throw new Error('Causal SQLite schema is incompatible with this release.');
      }
    } else if ([...tables].some(table => table.startsWith('causal_'))) {
      throw new Error('Causal SQLite tables have no supported migration record.');
    }
  });
}

function canonical(path) {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(canonical(parent), relative(parent, path));
}

function inside(parent, path) {
  const suffix = relative(parent, path);
  return suffix !== '..' && !suffix.startsWith('..' + sep) && !isAbsolute(suffix);
}

export function releasePaths(env = process.env) {
  const worldDbPath = resolveWorldDatabasePath({ env });
  if (env.FLY_APP_NAME && (!env.DECISION_STORE_DIR || !isAbsolute(env.DECISION_STORE_DIR))) {
    throw new Error('Fly Decision storage requires an absolute configured directory.');
  }
  let decisionDirectory = canonical(resolve(env.DECISION_STORE_DIR || DEFAULT_DECISION_STORE_DIR));
  if (env.FLY_APP_NAME) {
    // Reuse the volume guard on the containing directory without creating a file.
    decisionDirectory = dirname(resolveWorldDatabasePath({
      env: { ...env, HBL_WORLD_DB_PATH: join(decisionDirectory, '.release-volume-check.sqlite') },
    }));
  }
  if (publicRoots.some(root => inside(canonical(resolve(root)), decisionDirectory))) {
    throw new Error('Decision storage must be outside publicly served directories.');
  }
  return { worldDbPath, decisionDirectory };
}

export function initializeReleaseStorage(env = process.env) {
  const paths = releasePaths(env);
  assertWorldDatabaseCompatible(paths.worldDbPath);
  mkdirSync(paths.decisionDirectory, { recursive: true, mode: 0o700 });
  return paths;
}

function directoryAvailable(path) {
  if (!statSync(path).isDirectory()) throw new Error('Expected a storage directory.');
  accessSync(path, constants.R_OK | constants.W_OK | constants.X_OK);
}

function probeWorld(path) {
  if (path === ':memory:') return;
  directoryAvailable(dirname(path));
  accessSync(path, constants.R_OK | constants.W_OK);
  readOnly(path, db => {
    db.query('SELECT id FROM world_experiment_saves LIMIT 1').get();
    db.query('SELECT id FROM causal_runs LIMIT 1').get();
  });
}

function canProbe(probe) {
  try { probe(); return 'ok'; } catch { return 'unavailable'; }
}

export function createReleaseHealthHandler({
  worldDbPath, decisionDirectory, env = process.env, now = () => performance.now(),
} = {}) {
  const buildId = publicBuildId(env.HBL_BUILD_ID, env.NODE_ENV === 'production');
  let cached;
  return request => {
    const path = new URL(request.url).pathname;
    if (path !== '/api/health' && path !== '/api/ready') return null;
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { ...headers, allow: 'GET, HEAD' } });
    }

    let report = { status: 'ok', buildId };
    let status = 200;
    if (path === '/api/ready') {
      const at = now();
      if (!cached || at - cached.at >= probeTTL) {
        cached = {
          at,
          checks: {
            worldStorage: canProbe(() => probeWorld(worldDbPath)),
            decisionStorage: canProbe(() => directoryAvailable(decisionDirectory)),
          },
        };
      }
      const ready = Object.values(cached.checks).every(check => check === 'ok');
      report = { status: ready ? 'ready' : 'unavailable', buildId, checks: cached.checks };
      if (!ready) status = 503;
    }
    if (request.method === 'HEAD') {
      return new Response(null, { status, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
    }
    return Response.json(report, { status, headers });
  };
}

if (import.meta.main) {
  try {
    const { worldDbPath } = releasePaths();
    assertWorldDatabaseCompatible(worldDbPath);
    console.log('Release storage preflight passed.');
  } catch (error) {
    console.error('Release storage preflight failed:', error.message);
    process.exitCode = 1;
  }
}
