import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export const SHARE_TTL_MS=30*24*60*60*1000;
export function createRealityShareStore(dbPath,{maxRecords=100,maxWritesPerMinute=20}={}) {
 if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
 const db=new Database(dbPath,{create:true});
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS reality_shares(id TEXT PRIMARY KEY,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reality_share_attempts(at INTEGER NOT NULL);');
 const error=(message,status)=>{throw Object.assign(new Error(message),{status});};
 const reserveWrite=db.transaction(now=>{db.query('DELETE FROM reality_share_attempts WHERE at <= ?').run(now-60000);const count=db.query('SELECT COUNT(*) AS n FROM reality_share_attempts').get().n;if(count>=maxWritesPerMinute)error('Share write rate limit reached; retry in one minute.',429);db.query('INSERT INTO reality_share_attempts(at) VALUES(?)').run(now);});
 const put=db.transaction(record=>{const time=Date.parse(record.createdAt);db.query('DELETE FROM reality_shares WHERE expires_at <= ?').run(time);if(db.query('SELECT 1 FROM reality_shares WHERE id=?').get(record.id))error('Share ID already exists; shares are immutable.',409);if(db.query('SELECT COUNT(*) AS n FROM reality_shares').get().n>=maxRecords)error('Local share storage is full. Existing shares remain immutable until expiry.',507);db.query('INSERT INTO reality_shares(id,created_at,expires_at,data) VALUES(?,?,?,?)').run(record.id,time,Date.parse(record.expiresAt),JSON.stringify(record));return record;});
 return {reserveWrite,put,get(id,now=Date.now()){const row=db.query('SELECT data,expires_at FROM reality_shares WHERE id=?').get(id);if(!row)return null;if(row.expires_at<=now){db.query('DELETE FROM reality_shares WHERE id=?').run(id);return null;}return JSON.parse(row.data);},close:()=>db.close()};
}
