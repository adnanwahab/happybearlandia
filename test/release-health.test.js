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


test.each([undefined, '', 'unknown', 'development', 'abc123', 'g'.repeat(40), 'a'.repeat(65), '/secret/config'])(
  'production build identity stays unknown for invalid input %j', async value => {
    expect(publicBuildId(value, true)).toBe('unknown');
    const handler = createReleaseHealthHandler({ env: { NODE_ENV: 'production', HBL_BUILD_ID: value } });
    expect((await handler(request('/api/health')).json()).buildId).toBe('unknown');
  },
);

test.each(['ABCDEF1', 'a'.repeat(40), 'f'.repeat(64)])('production accepts commit identity %s', value => {
  expect(publicBuildId(value, true)).toBe(value.toLowerCase());
});
