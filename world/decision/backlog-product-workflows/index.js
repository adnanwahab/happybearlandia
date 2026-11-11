import { Database } from 'bun:sqlite';
import { mkdirSync, realpathSync, chmodSync } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export class WorkflowError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const token = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const requireToken = value => { if (!token(value)) throw new WorkflowError('Invalid identity or idempotency key'); };
const inside = (parent, child) => { const p = relative(parent, child); return !p || (!p.startsWith('..') && !isAbsolute(p)); };

/** Local only. Owner is supplied by the trusted host, never by the request body. */
export function createProductWorkflowStore({ directory, now = Date.now, retentionMs = 30 * 86400000, capacity = 1000, publicRoots = ['world', 'data', 'game', 'tools', 'blog', 'visualizations'].map(p => resolve(p)) } = {}) {
  if (!directory || !Number.isSafeInteger(retentionMs) || retentionMs < 1 || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw new Error('Invalid workflow store configuration');
  const root = resolve(directory);
  if (publicRoots.some(p => inside(resolve(p), root))) throw new Error('Workflow store must be private');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (publicRoots.some(p => { try { return inside(realpathSync(p), realpathSync(root)); } catch { return inside(resolve(p), realpathSync(root)); } })) throw new Error('Workflow store must be private');
  const db = new Database(join(root, 'product-workflows.sqlite'), { create: true });
  chmodSync(join(root, 'product-workflows.sqlite'), 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS workflows (id TEXT PRIMARY KEY, owner TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, expires INTEGER NOT NULL, record TEXT NOT NULL, UNIQUE(owner,key))');
  const purge = () => db.query('DELETE FROM workflows WHERE expires <= ?').run(now());
  const transaction = fn => db.transaction(() => { purge(); return fn(); }).immediate();
  return {
    submit(owner, input) {
      requireToken(owner);
      return transaction(() => {
        if (!input || typeof input !== 'object' || Array.isArray(input) || input.consent !== true || input.reviewed !== true) throw new WorkflowError('Explicit consent and review are required');
        requireToken(input.key);
        if (Object.keys(input).some(k => !['key', 'kind', 'consent', 'reviewed', 'event', 'brief'].includes(k))) throw new WorkflowError('Unsupported field');
        let payload;
        if (input.kind === 'event' && ['studio_opened', 'comparison_saved', 'brief_exported'].includes(input.event) && input.brief === undefined) payload = { event: input.event };
        else if (input.kind === 'pilot' && typeof input.brief === 'string' && input.brief.trim() && input.brief.length <= 4000 && input.event === undefined) payload = { brief: input.brief.trim() };
        else throw new WorkflowError('Invalid workflow payload');
        const fingerprint = createHash('sha256').update(JSON.stringify({ kind: input.kind, payload })).digest('hex');
        const prior = db.query('SELECT fingerprint,record FROM workflows WHERE owner=? AND key=?').get(owner, input.key);
        if (prior) { if (prior.fingerprint !== fingerprint) throw new WorkflowError('Idempotency conflict', 409); return JSON.parse(prior.record); }
        if (db.query('SELECT count(*) AS n FROM workflows').get().n >= capacity) throw new WorkflowError('Local workflow capacity reached', 429);
        const createdAt = now();
        const record = { schemaVersion: 'product-workflow.v1', id: randomUUID(), kind: input.kind, payload, createdAt, expiresAt: createdAt + retentionMs, consent: true, reviewed: true, status: 'stored-locally', externalSubmission: false };
        db.query('INSERT INTO workflows VALUES (?,?,?,?,?,?)').run(record.id, owner, input.key, fingerprint, record.expiresAt, JSON.stringify(record));
        return record;
      });
    },
    export(owner) { requireToken(owner); return transaction(() => db.query('SELECT record FROM workflows WHERE owner=? ORDER BY rowid').all(owner).map(r => JSON.parse(r.record))); },
    delete(owner) { requireToken(owner); return transaction(() => ({ deleted: db.query('DELETE FROM workflows WHERE owner=?').run(owner).changes })); },
    purge() { return transaction(() => ({ status: 'retention-applied' })); },
    close() { db.close(); },
  };
}

async function readJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new WorkflowError('JSON required', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkflowError('Body required');
  const chunks = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 16384) throw new WorkflowError('Body too large', 413); chunks.push(part.value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new WorkflowError('Invalid JSON'); }
}

/** Returns null for unrelated routes. Host must enforce auth and CSRF via authorize. */
export function createProductWorkflowHandler({ store, authorize, base = '/api/product-workflows' }) {
  if (typeof authorize !== 'function') throw new Error('Trusted host authorization required');
  const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
  return async request => {
    if (new URL(request.url).pathname !== base) return null;
    try {
      const owner = await authorize(request);
      if (!token(owner)) return json({ error: 'Unauthorized' }, 401);
      if (request.method === 'POST') return json(await store.submit(owner, await readJSON(request)), 200);
      if (request.method === 'GET') return json({ schemaVersion: 'product-workflow-export.v1', records: await store.export(owner) });
      if (request.method === 'DELETE') return json(await store.delete(owner));
      return json({ error: 'Method not allowed' }, 405);
    } catch (error) { return json({ error: error instanceof WorkflowError ? error.message : 'Local workflow storage unavailable' }, error instanceof WorkflowError ? error.status : 503); }
  };
}
