import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertWorldDatabaseCompatible, createReleaseHealthHandler, initializeReleaseStorage, publicBuildId } from '../ops/release-health.js';
import { createWorldPersistenceStore } from '../world/experiments/persistence-store.js';

function temporary() {
  const root = mkdtempSync(join(tmpdir(), 'hbl-release-health-'));
  return {
    dbPath: join(root, 'world.sqlite'), decisionDirectory: join(root, 'decision'),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
const request = (path, method = 'GET') => new Request('http://localhost' + path, { method });

test('liveness remains separate from readiness and exposes only a safe build identifier', async () => {
  const fixture = temporary();
  try {
    mkdirSync(fixture.decisionDirectory);
    const store = createWorldPersistenceStore(fixture.dbPath);
    let now = 0;
    const handler = createReleaseHealthHandler({
      worldDbPath: fixture.dbPath, decisionDirectory: fixture.decisionDirectory,
      env: { NODE_ENV: 'production', HBL_BUILD_ID: 'ABCDEF123' }, now: () => now,
    });
    expect(await handler(request('/api/health')).json()).toEqual({ status: 'ok', buildId: 'abcdef123' });
    expect(await handler(request('/api/ready')).json()).toEqual({
      status: 'ready', buildId: 'abcdef123', checks: { worldStorage: 'ok', decisionStorage: 'ok' },
    });
    store.close();
    renameSync(fixture.decisionDirectory, fixture.decisionDirectory + '-off');
    expect(handler(request('/api/ready')).status).toBe(200);
    now = 2000;
    const degraded = handler(request('/api/ready'));
    expect(degraded.status).toBe(503);
    expect(degraded.headers.get('cache-control')).toBe('no-store');
    expect(await degraded.json()).toEqual({
      status: 'unavailable', buildId: 'abcdef123', checks: { worldStorage: 'ok', decisionStorage: 'unavailable' },
    });
    expect(handler(request('/api/health')).status).toBe(200);
    expect(await handler(request('/api/health', 'HEAD')).text()).toBe('');
    expect(handler(request('/api/ready', 'POST')).status).toBe(405);
    expect(handler(request('/elsewhere'))).toBeNull();
    expect(publicBuildId('/secret/config', true)).toBe('unknown');
    expect(publicBuildId(undefined)).toBe('development');
  } finally {
    fixture.cleanup();
  }
});

test('startup preflight rejects newer causal revisions before modifying the database', () => {
  const fixture = temporary();
  try {
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).not.toThrow();
    const store = createWorldPersistenceStore(fixture.dbPath);
    store.close();
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).not.toThrow();
    const db = new Database(fixture.dbPath);
    db.exec('INSERT INTO causal_storage_migrations(version) VALUES(2);');
    db.close();
    const before = readFileSync(fixture.dbPath);
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).toThrow('Causal SQLite schema is incompatible');
    expect(readFileSync(fixture.dbPath).equals(before)).toBe(true);
  } finally {
    fixture.cleanup();
  }
});

test('recognized legacy storage can migrate while a foreign SQLite schema is rejected', () => {
  const fixture = temporary();
  try {
    const db = new Database(fixture.dbPath);
    db.exec('CREATE TABLE unrelated (id INTEGER)');
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).toThrow('does not contain a recognized');
    db.exec('DROP TABLE unrelated; CREATE TABLE world_experiment_saves(id TEXT PRIMARY KEY,parent_id TEXT,created_at INTEGER NOT NULL,bytes INTEGER NOT NULL,metadata TEXT NOT NULL,data TEXT NOT NULL);');
    db.query('INSERT INTO world_experiment_saves VALUES (?, NULL, 0, 2, ?, ?)').run('legacy-save', '{}', '{}');
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).not.toThrow();
    db.exec('PRAGMA user_version=2');
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).toThrow('format version is unsupported');
    db.exec('PRAGMA user_version=0');
    db.close();

    const paths = initializeReleaseStorage({
      HBL_WORLD_DB_PATH: fixture.dbPath, DECISION_STORE_DIR: fixture.decisionDirectory,
    });
    const handler = createReleaseHealthHandler(paths);
    expect(handler(request('/api/ready')).status).toBe(503);
    const store = createWorldPersistenceStore(fixture.dbPath);
    try {
      expect(store.get('legacy-save')).toEqual({});
      expect(createReleaseHealthHandler(paths)(request('/api/ready')).status).toBe(200);
    } finally {
      store.close();
    }
  } finally {
    fixture.cleanup();
  }
});

test.each(['world_saved_homes', 'world_house_sessions'])('readiness requires the initialized %s table', async table => {
  const fixture = temporary();
  try {
    mkdirSync(fixture.decisionDirectory);
    createWorldPersistenceStore(fixture.dbPath).close();
    using db = new Database(fixture.dbPath);
    db.exec(`DROP TABLE ${table}`);
    const handler = createReleaseHealthHandler({
      worldDbPath: fixture.dbPath, decisionDirectory: fixture.decisionDirectory,
    });
    const response = handler(request('/api/ready'));
    expect(response.status).toBe(503);
    expect((await response.json()).checks).toEqual({ worldStorage: 'unavailable', decisionStorage: 'ok' });
  } finally {
    fixture.cleanup();
  }
});

test('malformed saved-home tables fail both startup preflight and readiness', async () => {
  const fixture = temporary();
  try {
    mkdirSync(fixture.decisionDirectory);
    createWorldPersistenceStore(fixture.dbPath).close();
    {
      using db = new Database(fixture.dbPath);
      db.exec('DROP TABLE world_saved_homes; CREATE TABLE world_saved_homes(id TEXT PRIMARY KEY)');
    }
    const before = readFileSync(fixture.dbPath);
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).toThrow('missing columns in world_saved_homes');
    expect(readFileSync(fixture.dbPath)).toEqual(before);
    const handler = createReleaseHealthHandler({
      worldDbPath: fixture.dbPath, decisionDirectory: fixture.decisionDirectory,
    });
    const response = handler(request('/api/ready'));
    expect(response.status).toBe(503);
    expect((await response.json()).checks.worldStorage).toBe('unavailable');
  } finally {
    fixture.cleanup();
  }
});

test('Decision preflight accepts an initializable path without creating it and rejects a file', async () => {
  const fixture = temporary();
  try {
    const cli = new URL('../ops/release-health.js', import.meta.url).pathname;
    const runPreflight = decisionDirectory => Bun.spawnSync([process.execPath, '--no-env-file', cli], {
      env: { HBL_WORLD_DB_PATH: fixture.dbPath, DECISION_STORE_DIR: decisionDirectory },
    });
    expect(runPreflight(join(fixture.decisionDirectory, 'nested')).exitCode).toBe(0);
    expect(existsSync(fixture.decisionDirectory)).toBe(false);
    writeFileSync(fixture.decisionDirectory, 'not a directory');
    const failed = runPreflight(fixture.decisionDirectory);
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr.toString()).toContain('Expected a storage directory');
    expect(() => initializeReleaseStorage({
      HBL_WORLD_DB_PATH: fixture.dbPath, DECISION_STORE_DIR: fixture.decisionDirectory,
    })).toThrow('Expected a storage directory');

    createWorldPersistenceStore(fixture.dbPath).close();
    const handler = createReleaseHealthHandler({
      worldDbPath: fixture.dbPath, decisionDirectory: fixture.decisionDirectory,
    });
    const response = handler(request('/api/ready'));
    expect(response.status).toBe(503);
    expect((await response.json()).checks).toEqual({ worldStorage: 'ok', decisionStorage: 'unavailable' });
  } finally {
    fixture.cleanup();
  }
});

test('demo readiness combines actual assets, synthetic fixtures and read-only backend probes', async () => {
  const fixture = temporary();
  try {
    const { DEMO_FILES } = await import('../ops/release-health.js');
    const root = join(fixture.decisionDirectory, 'demo');
    for (const file of Object.values(DEMO_FILES).flat()) {
      const target = join(root, file);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, 'fixture');
    }
    createWorldPersistenceStore(fixture.dbPath).close();
    const cityDirectory = join(root, 'private-city');
    let now = 0;
    const handler = createReleaseHealthHandler({
      worldDbPath: fixture.dbPath, decisionDirectory: fixture.decisionDirectory,
      demoRoot: root, cityDirectory, now: () => now,
      env: { HBL_BUILD_ID: '/private/secret', API_KEY: 'secret' },
    });
    const probe = () => handler(request('/api/demo/ready'));
    expect(probe().status).toBe(200);
    expect((await probe().json()).checks).toEqual({
      demoAssets: 'ok', scenarioFixtures: 'ok', cityStorage: 'ok', worldStorage: 'ok', decisionStorage: 'ok',
    });
    expect(existsSync(cityDirectory)).toBe(false);
    const missing = join(root, DEMO_FILES.scenarioFixtures[0]);
    renameSync(missing, missing + '.off');
    expect(probe().status).toBe(200); // bounded cache
    now = 2000;
    expect(probe().status).toBe(503);
    expect((await probe().json()).checks.scenarioFixtures).toBe('unavailable');
    renameSync(missing + '.off', missing);
    mkdirSync(cityDirectory);
    writeFileSync(join(cityDirectory, 'hbl.sqlite'), 'secret invalid database');
    const before = readFileSync(join(cityDirectory, 'hbl.sqlite'));
    now = 4000;
    const degraded = probe();
    expect(degraded.status).toBe(503);
    expect(degraded.headers.get('cache-control')).toBe('no-store');
    const body = await degraded.json();
    expect(body.checks.cityStorage).toBe('unavailable');
    expect(body.checks.scenarioFixtures).toBe('ok');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain(root);
    expect(readFileSync(join(cityDirectory, 'hbl.sqlite'))).toEqual(before);
    expect(await handler(request('/api/demo/ready', 'HEAD')).text()).toBe('');
    expect(handler(request('/api/demo/ready', 'POST')).status).toBe(405);
    expect(handler(request('/api/ready')).status).toBe(200);
  } finally { fixture.cleanup(); }
});

test('demo inventory resolves the checked-in homepage demo assets and generator', async () => {
  const fixture = temporary();
  try {
    mkdirSync(fixture.decisionDirectory);
    createWorldPersistenceStore(fixture.dbPath).close();
    const response = createReleaseHealthHandler({
      worldDbPath: fixture.dbPath, decisionDirectory: fixture.decisionDirectory,
      cityDirectory: join(fixture.decisionDirectory, 'uninitialized-city'),
    })(request('/api/demo/ready'));
    expect(response.status).toBe(200);
    expect((await response.json()).checks.scenarioFixtures).toBe('ok');
  } finally { fixture.cleanup(); }
});
