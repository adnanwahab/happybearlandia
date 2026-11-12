import { Database } from 'bun:sqlite';
import { accessSync, constants, existsSync, lstatSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_OPTIMIZATION_DIRECTORY, DEFAULT_DECISION_STORE_DIR } from '../world/decision/store.js';
import { resolveWorldDatabasePath } from '../world/experiments/database-path.js';

const probeTTL = 2000;
// Bounded availability inventory for the homepage's Play Demo entry point.
export const DEMO_FILES = Object.freeze({
  demoAssets: ['index.html', 'world/future-machine.html', 'world/future-machine/main.js',
    'world/future-machine/ui/styles.css', 'world/future-machine/demo-controller.js'],
  scenarioFixtures: ['world/future-machine/contracts.js', 'world/future-machine/data/index.js',
    'world/city/seed.js', 'world/city/engine.js'],
});

function probeDemoFiles(root, files) {
  for (const file of files) {
    const path = join(root, file);
    if (!statSync(path).isFile() || statSync(path).size === 0) throw new Error('Demo file unavailable');
    accessSync(path, constants.R_OK);
  }
}
const worldColumns = {
  world_experiment_saves: ['id', 'parent_id', 'created_at', 'bytes', 'metadata', 'data'],
  world_experiment_write_attempts: ['at'],
  world_saved_homes: ['id', 'home_key', 'latest_save_id', 'created_at', 'updated_at', 'data'],
  world_home_revisions: ['save_id', 'home_id'],
  world_home_indexed: ['save_id'],
  world_home_migrations: ['key'],
  world_home_residents: ['id', 'home_id', 'person_id', 'data'],
  world_house_sessions: ['experiment_id', 'household_id', 'revision', 'minute', 'updated_at', 'bytes', 'data'],
  world_house_session_write_attempts: ['at'],
  world_date_media: ['id', 'experiment_id', 'created_at', 'bytes', 'mime_type', 'metadata', 'image'],
  world_date_media_write_attempts: ['at'],
};
const causalColumns = {
  causal_storage_migrations: ['version'],
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

function assertColumns(db, objects, schema, required, label) {
  for (const [table, columns] of Object.entries(schema)) {
    if (!required && !objects.has(table)) continue;
    if (objects.get(table) !== 'table') throw new Error(`${label} SQLite schema is incompatible: expected table ${table}.`);
    const fields = new Set(db.query(`PRAGMA table_info(${table})`).all().map(row => row.name.toLowerCase()));
    if (columns.some(column => !fields.has(column))) {
      throw new Error(`${label} SQLite schema is incompatible: missing columns in ${table}.`);
    }
  }
}

function inspectWorldSchema(db, initialized) {
  const { user_version: version } = db.query('PRAGMA user_version').get();
  if (version !== 0) throw new Error('World SQLite format version is unsupported by this release.');

  const rows = db.query("SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT GLOB 'sqlite_*'").all();
  const objects = new Map(rows.map(({ name, type }) => [name.toLowerCase(), type]));
  const hasCausalMigration = objects.has('causal_storage_migrations');
  if (rows.some(row => row.type === 'table') && !objects.has('world_experiment_saves') && !hasCausalMigration) {
    throw new Error('SQLite file does not contain a recognized World or causal schema.');
  }
  assertColumns(db, objects, worldColumns, initialized, 'World');
  assertColumns(db, objects, causalColumns, initialized || hasCausalMigration, 'Causal');
  if (hasCausalMigration) {
    const versions = db.query('SELECT version FROM causal_storage_migrations').all();
    if (!versions.length || versions.some(row => !knownMigrations.has(row.version))) {
      throw new Error('Causal SQLite schema is incompatible with this release.');
    }
  } else if ([...objects.keys()].some(name => name.startsWith('causal_'))) {
    throw new Error('Causal SQLite tables have no supported migration record.');
  }
}

// Before migrations, absent World tables can be initialized by the store.
export function assertWorldDatabaseCompatible(path) {
  if (path === ':memory:' || !lstatSync(path, { throwIfNoEntry: false })) return;
  if (!statSync(path).isFile()) throw new Error('World storage must be a SQLite file.');
  readOnly(path, db => inspectWorldSchema(db, false));
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

function preflightReleaseStorage(env) {
  const paths = releasePaths(env);
  assertWorldDatabaseCompatible(paths.worldDbPath);
  let ancestor = paths.decisionDirectory;
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) ancestor = dirname(ancestor);
  if (ancestor === paths.decisionDirectory) probeDecision(paths.decisionDirectory);
  else directoryAvailable(ancestor);
  return paths;
}

export function initializeReleaseStorage(env = process.env) {
  const paths = preflightReleaseStorage(env);
  mkdirSync(paths.decisionDirectory, { recursive: true, mode: 0o700 });
  return paths;
}

function directoryAvailable(path) {
  if (!statSync(path).isDirectory()) throw new Error('Expected a storage directory.');
  accessSync(path, constants.R_OK | constants.W_OK | constants.X_OK);
}

function probeDecision(path) {
  directoryAvailable(path);
  const optimizationDirectory = join(path, DECISION_OPTIMIZATION_DIRECTORY);
  if (lstatSync(optimizationDirectory, { throwIfNoEntry: false })) directoryAvailable(optimizationDirectory);
}

function probeWorld(path) {
  if (path === ':memory:') return;
  directoryAvailable(dirname(path));
  accessSync(path, constants.R_OK | constants.W_OK);
  readOnly(path, db => {
    inspectWorldSchema(db, true);
    db.query('SELECT id FROM world_experiment_saves LIMIT 1').get();
    db.query('SELECT id FROM causal_runs LIMIT 1').get();
  });
}

function canProbe(probe) {
  try { probe(); return 'ok'; } catch { return 'unavailable'; }
}

export function createReleaseHealthHandler({
  worldDbPath, decisionDirectory, env = process.env, now = () => performance.now(),
  demoRoot = fileURLToPath(new URL('../', import.meta.url)),
  cityDirectory = env.HBL_CITY_DATA_DIR || '.hbl-city',
} = {}) {
  const buildId = publicBuildId(env.HBL_BUILD_ID, env.NODE_ENV === 'production');
  let cached;
  let demoCached;
  return request => {
    const path = new URL(request.url).pathname;
    if (!['/api/health', '/api/ready', '/api/demo/ready'].includes(path)) return null;
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { ...headers, allow: 'GET, HEAD' } });
    }

    let report = { status: 'ok', buildId };
    let status = 200;
    if (path !== '/api/health') {
      const at = now();
      if (!cached || at - cached.at >= probeTTL) {
        cached = {
          at,
          checks: {
            worldStorage: canProbe(() => probeWorld(worldDbPath)),
            decisionStorage: canProbe(() => probeDecision(decisionDirectory)),
          },
        };
      }
      let checks = cached.checks;
      if (path === '/api/demo/ready') {
        if (!demoCached || at - demoCached.at >= probeTTL) {
          demoCached = { at, checks: { ...Object.fromEntries(Object.entries(DEMO_FILES).map(
            ([name, files]) => [name, canProbe(() => probeDemoFiles(demoRoot, files))],
          )), cityStorage: canProbe(() => {
            // CityStore initializes lazily on first play. Inspect its existing
            // ancestor without initializing a store or changing queued runs.
            if (!existsSync(join(cityDirectory, 'hbl.sqlite'))) {
              let ancestor = resolve(cityDirectory);
              while (!existsSync(ancestor)) ancestor = dirname(ancestor);
              directoryAvailable(ancestor);
              return;
            }
            directoryAvailable(join(cityDirectory, 'experiments'));
            readOnly(join(cityDirectory, 'hbl.sqlite'), db => {
              db.query('SELECT experiment_id, status, manifest_json FROM experiment_index LIMIT 1').get();
            });
          }) } };
        }
        checks = { ...demoCached.checks, ...checks };
      }
      const ready = Object.values(checks).every(check => check === 'ok');
      report = { status: ready ? 'ready' : 'unavailable', buildId, checks };
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
    preflightReleaseStorage(process.env);
    console.log('Release storage preflight passed.');
  } catch (error) {
    console.error('Release storage preflight failed:', error.message);
    process.exitCode = 1;
  }
}
