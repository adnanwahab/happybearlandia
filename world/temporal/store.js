import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function createTemporalStore(dbPath) {
  if(dbPath!==':memory:') mkdirSync(dirname(dbPath),{recursive:true});
  const db=new Database(dbPath,{create:true});
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS osm_snapshots(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS osm_features(id TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS osm_feature_versions(feature_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(feature_id,version));
    CREATE TABLE IF NOT EXISTS world_events(id TEXT PRIMARY KEY,before_id TEXT,after_id TEXT,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS osm_history_cache(id TEXT PRIMARY KEY,data TEXT NOT NULL);`);
  const parse=row=>row?JSON.parse(row.data):null;
  const saveVersion=db.prepare('INSERT OR REPLACE INTO osm_feature_versions(feature_id,version,data) VALUES(?,?,?)');
  return {
    getSnapshot:id=>parse(db.query('SELECT data FROM osm_snapshots WHERE id=?').get(id)),
    findSnapshot:key=>parse(db.query('SELECT data FROM osm_snapshots WHERE request_key=?').get(key)),
    saveSnapshot:db.transaction((snapshot,key)=>{db.query('INSERT OR REPLACE INTO osm_snapshots VALUES(?,?,?)').run(snapshot.id,key,JSON.stringify(snapshot));for(const f of snapshot.features){db.query('INSERT OR REPLACE INTO osm_features VALUES(?,?)').run(f.id,JSON.stringify(f));if(f.version!=null)saveVersion.run(f.id,f.version,JSON.stringify(f));}}),
    saveDiff:db.transaction(diff=>{for(const e of diff.events)db.query('INSERT OR REPLACE INTO world_events VALUES(?,?,?,?)').run(e.id,diff.before,diff.after,JSON.stringify(e));}),
    getHistory:id=>parse(db.query('SELECT data FROM osm_history_cache WHERE id=?').get(id)),
    saveHistory:db.transaction(history=>{db.query('INSERT OR REPLACE INTO osm_history_cache VALUES(?,?)').run(history.id,JSON.stringify(history));for(const v of history.versions)saveVersion.run(history.id,v.version,JSON.stringify(v));}),
    close:()=>db.close()
  };
}
