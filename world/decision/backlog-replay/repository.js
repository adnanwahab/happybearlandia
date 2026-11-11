import { mkdir, open, link, unlink, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { constants } from 'node:fs';
import { canonicalJSON, canonicalDigest } from '../../replay/engine.js';
import { MAX_CHECKPOINT_BYTES } from './index.js';

const within = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../'); };
const deny = message => { throw new Error(message); };
const scopeKeys = ['ownerId', 'experimentId', 'runId'];
function scopeIdentity(scope) {
  if (!scope || scopeKeys.some(key => typeof scope[key] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(scope[key]))) deny('Explicit authenticated owner/experiment/run scope required');
  return Object.fromEntries(scopeKeys.map(key => [key, scope[key]]));
}
/** Private local persistence only. Caller MUST authenticate and authorize scope first.
 * Publication uses exclusive hard-link creation: partial writes never become visible.
 * Repeated identical saves succeed; conflicting ID writes never overwrite history.
 */
export function createHousingCheckpointRepository({ directory, adapter, publicRoots = [], now = Date.now }) {
  if (!directory || !adapter?.restore || !publicRoots.length) deny('Private directory, adapter and served publicRoots required');
  const root = resolve(directory);
  let readyPromise;
  async function ready() {
    return readyPromise ||= (async () => {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const physicalRoot = await realpath(root);
      for (const path of publicRoots) if (within(await realpath(path), physicalRoot)) deny('Checkpoint directory must be outside served roots');
      return physicalRoot;
    })().catch(error => { readyPromise = null; throw error; });
  }
  async function pathFor(scope, id) {
    if (typeof id !== 'string' || !/^housing:sha256:[a-f0-9]{64}$/.test(id)) deny('Invalid checkpoint ID');
    const scopeHash = (await canonicalDigest(scopeIdentity(scope))).slice(7);
    return join(await ready(), scopeHash + '-' + id.slice(15) + '.json');
  }
  async function read(path) {
    let file;
    try {
      file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > MAX_CHECKPOINT_BYTES + 4096) deny('Invalid or oversized persisted checkpoint');
      const buffer = Buffer.alloc(MAX_CHECKPOINT_BYTES + 4097);
      let length = 0;
      while (length < buffer.length) { const { bytesRead } = await file.read(buffer, length, buffer.length - length, null); if (!bytesRead) break; length += bytesRead; }
      if (length > MAX_CHECKPOINT_BYTES + 4096) deny('Oversized persisted checkpoint');
      const raw = buffer.subarray(0, length).toString('utf8');
      if (Buffer.byteLength(raw) > MAX_CHECKPOINT_BYTES + 4096) deny('Oversized persisted checkpoint');
      const record = JSON.parse(raw);
      if (canonicalJSON(record) !== raw) deny('Noncanonical persisted envelope');
      return record;
    } finally { await file?.close(); }
  }
  async function validate(record, scope, expected) {
    if (canonicalJSON(record.scope) !== canonicalJSON(scopeIdentity(scope))) deny('Checkpoint owner scope mismatch');
    if (!Number.isSafeInteger(record.expiresAt) || record.expiresAt <= now()) deny('Checkpoint retention expired');
    return adapter.restore(record.serialized, expected);
  }
  return {
    async load(scope, expected) {
      const record = await read(await pathFor(scope, expected?.id));
      const checkpoint = await validate(record, scope, expected);
      return { checkpoint, serialized: record.serialized, expiresAt: record.expiresAt };
    },
    async save(scope, serialized, { expiresAt, parent } = {}) {
      const checkpoint = await adapter.restore(serialized);
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= now() || expiresAt - now() > 30 * 86400000) deny('Retention must be future and at most 30 days');
      if (checkpoint.parentDigest) {
        if (!parent?.id || parent.digest !== checkpoint.parentDigest) deny('Pinned parent required');
        const retained = await this.load(scope, parent);
        const previous = retained.checkpoint;
        if (checkpoint.recipeDigest !== previous.recipeDigest || checkpoint.state.month < previous.state.month) deny('Parent recipe or clock mismatch');
        const ancestry = checkpoint.lineage.slice(0, previous.lineage.length);
        if (canonicalJSON(ancestry) !== canonicalJSON(previous.lineage) || checkpoint.lineage.length > previous.lineage.length + 1) deny('Parent lineage mismatch');
        if (checkpoint.lineage.length > previous.lineage.length) {
          const branch = checkpoint.lineage.at(-1);
          if (branch.parentDigest !== previous.digest || branch.parentCheckpointId !== previous.id || branch.month !== previous.state.month) deny('Branch parent mismatch');
        }
        for (const key of ['monthlyTimeline', 'timeline', 'events', 'capacityLedger']) {
          const prefix = checkpoint.state[key].filter(row => (row.month ?? row.year * 12) <= previous.state.month);
          if (canonicalJSON(prefix) !== canonicalJSON(previous.state[key])) deny('Parent causal prefix mismatch');
        }
        for (const row of previous.state.lifecycle.rows) {
          const child = checkpoint.state.lifecycle.rows.find(child => child.projectId === row.projectId);
          if (!child || canonicalJSON(child.uncertainty) !== canonicalJSON(row.uncertainty)) deny('Parent lifecycle mismatch');
          for (const key of ['states', 'events']) if (canonicalJSON(child[key].filter(event => event.month <= previous.state.month)) !== canonicalJSON(row[key])) deny('Parent lifecycle prefix mismatch');
        }
        if (retained.expiresAt < expiresAt) deny('Child cannot outlive parent retention');
      } else if (parent) deny('Unexpected parent');
      const path = await pathFor(scope, checkpoint.id);
      const content = canonicalJSON({ scope: scopeIdentity(scope), serialized, expiresAt });
      if (Buffer.byteLength(content) > MAX_CHECKPOINT_BYTES + 4096) deny('Oversized persisted envelope');
      const temporary = path + '.' + crypto.randomUUID() + '.tmp';
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(content); await file.sync(); await file.close();
        try { await link(temporary, path); }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const existing = await read(path);
          if (canonicalJSON(existing) !== content) deny('Immutable checkpoint conflict');
          await validate(existing, scope, { id: checkpoint.id, digest: checkpoint.digest });
        }
      } finally { await file.close(); await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
      return { id: checkpoint.id, digest: checkpoint.digest, expiresAt };
    },
  };
}
