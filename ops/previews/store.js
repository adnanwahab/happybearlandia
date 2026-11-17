import {Database} from 'bun:sqlite';
import {createHash} from 'node:crypto';
import {mkdirSync, chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {PreviewError, validSHA, REPOSITORY} from './github.js';
export const RECIPE = 'hbl-secretless-bun-v1';
export const identity = sha => createHash('sha256').update(`${REPOSITORY}:${sha}:${RECIPE}`).digest('hex').slice(0,32);
export class PreviewStore {
  constructor(path, {now = Date.now, maxPending = 8, maxActive = 2} = {}) {
    mkdirSync(dirname(path), {recursive: true, mode: 0o700}); this.db = new Database(path); chmodSync(path, 0o600); this.now = now; this.maxPending = maxPending; this.maxActive = maxActive;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS previews(id TEXT PRIMARY KEY, sha TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests(identity TEXT NOT NULL, at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS runner_lock(id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT, expires INTEGER);`);
  }
  get(id) { if (!/^[a-f0-9]{32}$/.test(id)) throw new PreviewError('Invalid preview identity'); const row = this.db.query('SELECT data FROM previews WHERE id=?').get(id); if (!row) throw new PreviewError('Preview not found',404); return JSON.parse(row.data); }
  all() { return this.db.query('SELECT data FROM previews ORDER BY rowid').all().map(r => JSON.parse(r.data)); }
  update(job, patch) { const result = {...job, ...patch, updatedAt: this.now()}; this.db.query('UPDATE previews SET data=? WHERE id=?').run(JSON.stringify(result), job.id); return result; }
  admit({sha, number, launchPath, actor}) {
    if (!validSHA(sha) || !['/','/world'].includes(launchPath)) throw new PreviewError('Invalid revision or launch path');
    return this.db.transaction(() => {
      const expired=this.all().filter(j=>j.state==='expired'&&this.now()-j.updatedAt>7*86400000);for(const j of expired)this.db.query('DELETE FROM previews WHERE id=?').run(j.id);
      if(this.all().length>=512)throw new PreviewError('Preview history budget reached; operator retention review required',429,3600);
      const id = identity(sha); const existing = this.db.query('SELECT data FROM previews WHERE id=?').get(id);
      if (existing) return {job: JSON.parse(existing.data), reused: true};
      this.db.query('DELETE FROM requests WHERE at<?').run(this.now()-3600000);
      if (this.db.query('SELECT count(*) AS n FROM requests WHERE identity=?').get(actor).n >= 6) throw new PreviewError('Operator preview rate limit reached',429,3600);
      const pending = this.all().filter(j=>!['ready','failed','expired','unavailable'].includes(j.state));
      if (pending.length >= this.maxPending) throw new PreviewError('Preview queue is full',429,60);
      const job = {id, sha, number, repository: REPOSITORY, recipe: RECIPE, launchPath, state:'queued', createdAt:this.now(), updatedAt:this.now(), lastUsedAt:this.now(), attempt:0};
      this.db.query('INSERT INTO previews VALUES(?,?,?)').run(id,sha,JSON.stringify(job)); this.db.query('INSERT INTO requests VALUES(?,?)').run(actor,this.now());
      return {job,reused:false};
    }).immediate();
  }
  rate(actor) {
    this.db.query('DELETE FROM requests WHERE at<?').run(this.now()-3600000);
    if(this.db.query('SELECT count(*) AS n FROM requests WHERE identity=?').get(actor).n>=6)throw new PreviewError('Operator preview rate limit reached',429,3600);
    this.db.query('INSERT INTO requests VALUES(?,?)').run(actor,this.now());
  }
  retry(id, actor) { const j=this.get(id); if (j.cleanupPending || !['failed','expired'].includes(j.state)) throw new PreviewError('Only failed or expired previews can be explicitly retried',409); if(actor)this.rate(actor); return this.update(j,{state:'queued',error:null,url:null,resourceId:null,createdAt:this.now(),lastUsedAt:this.now(),preparationStartedAt:null}); }
  lock(owner) { return this.db.transaction(()=> { const row=this.db.query('SELECT * FROM runner_lock WHERE id=1').get(); if(row && row.owner!==owner && row.expires>this.now()) return false; this.db.query('INSERT OR REPLACE INTO runner_lock VALUES(1,?,?)').run(owner,this.now()+30000); return true; }).immediate(); }
  close() { this.db.close(); }
}
