import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertWorldDatabaseCompatible, createReleaseHealthHandler, publicBuildId } from '../ops/release-health.js';
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
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).not.toThrow();
    db.exec('PRAGMA user_version=2');
    expect(() => assertWorldDatabaseCompatible(fixture.dbPath)).toThrow('format version is unsupported');
    db.close();
  } finally {
    fixture.cleanup();
  }
});
