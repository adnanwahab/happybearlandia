import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export const EXPERIMENT_MAX_RECORDS=100;
export const EXPERIMENT_TOTAL_BYTES=256*1024*1024;
export function createWorldPersistenceStore(dbPath,{maxRecords=EXPERIMENT_MAX_RECORDS,maxTotalBytes=EXPERIMENT_TOTAL_BYTES,maxWritesPerMinute=10}={}){
 if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
 const db=new Database(dbPath,{create:true});
 db.exec('PRAGMA journal_mode=WAL; PRAGMA journal_size_limit=8388608; CREATE TABLE IF NOT EXISTS world_experiment_saves(id TEXT PRIMARY KEY,parent_id TEXT,created_at INTEGER NOT NULL,bytes INTEGER NOT NULL,metadata TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS world_experiment_write_attempts(at INTEGER NOT NULL);');
 const fail=(message,status)=>{throw Object.assign(new Error(message),{status});};
 const reserveWrite=db.transaction(now=>{db.query('DELETE FROM world_experiment_write_attempts WHERE at <= ?').run(now-60000);if(db.query('SELECT COUNT(*) AS n FROM world_experiment_write_attempts').get().n>=maxWritesPerMinute)fail('Experiment write rate limit reached; retry in one minute.',429);db.query('INSERT INTO world_experiment_write_attempts(at) VALUES(?)').run(now);});
 const put=db.transaction(record=>{if(db.query('SELECT 1 FROM world_experiment_saves WHERE id=?').get(record.id))fail('Experiment ID already exists; saved experiments are immutable.',409);if(record.parentId&&!db.query('SELECT 1 FROM world_experiment_saves WHERE id=?').get(record.parentId))fail('Parent experiment not found.',404);const raw=JSON.stringify(record),bytes=new TextEncoder().encode(raw).length,usage=db.query('SELECT COUNT(*) AS n,COALESCE(SUM(bytes),0) AS bytes FROM world_experiment_saves').get();if(usage.n>=maxRecords)fail(`Experiment storage has reached ${maxRecords} saved records. Existing saves were preserved.`,507);if(usage.bytes+bytes>maxTotalBytes)fail('Experiment storage has reached its total byte quota. Existing saves were preserved.',507);db.query('INSERT INTO world_experiment_saves(id,parent_id,created_at,bytes,metadata,data) VALUES(?,?,?,?,?,?)').run(record.id,record.parentId||null,Date.parse(record.createdAt),bytes,JSON.stringify({...record.metadata,bytes}),raw);return record;});
 return {reserveWrite,put,get(id){const row=db.query('SELECT data FROM world_experiment_saves WHERE id=?').get(id);return row?JSON.parse(row.data):null;},list(){return db.query('SELECT metadata FROM world_experiment_saves ORDER BY created_at DESC,id DESC').all().map(row=>JSON.parse(row.metadata));},usage(){const row=db.query('SELECT COUNT(*) AS records,COALESCE(SUM(bytes),0) AS bytes FROM world_experiment_saves').get();return {...row,maxRecords,maxBytes:maxTotalBytes};},close:()=>db.close()};
}
