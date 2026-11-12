/** Additive migrations: never copies or replaces authoritative world state. */
export function migrateCausalStorage(db) {
  db.exec('PRAGMA foreign_keys=ON');
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS causal_storage_migrations(version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS causal_runs(id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('running','completed','failed')), revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, content_hash TEXT);
      CREATE TABLE IF NOT EXISTS causal_nodes(run_id TEXT NOT NULL REFERENCES causal_runs(id), id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('event','observation','assumption')), sequence INTEGER NOT NULL CHECK(sequence>=0), time REAL NOT NULL, data TEXT NOT NULL, content_hash TEXT NOT NULL, PRIMARY KEY(run_id,id), UNIQUE(run_id,sequence));
      CREATE INDEX IF NOT EXISTS causal_runs_scope ON causal_runs(json_extract(data,'$.context.worldId'),id);
      CREATE INDEX IF NOT EXISTS causal_nodes_kind_page ON causal_nodes(run_id,kind,sequence);
      CREATE INDEX IF NOT EXISTS causal_nodes_time ON causal_nodes(run_id,time,sequence);
      CREATE TABLE IF NOT EXISTS causal_edges(run_id TEXT NOT NULL REFERENCES causal_runs(id), id TEXT NOT NULL, source_id TEXT NOT NULL, target_id TEXT NOT NULL, association INTEGER NOT NULL CHECK(association IN (0,1)), data TEXT NOT NULL, content_hash TEXT NOT NULL, PRIMARY KEY(run_id,id), FOREIGN KEY(run_id,source_id) REFERENCES causal_nodes(run_id,id), FOREIGN KEY(run_id,target_id) REFERENCES causal_nodes(run_id,id));
      CREATE INDEX IF NOT EXISTS causal_edges_source ON causal_edges(run_id,source_id,id);
      CREATE INDEX IF NOT EXISTS causal_edges_target ON causal_edges(run_id,target_id,id);
      CREATE TABLE IF NOT EXISTS causal_checkpoints(run_id TEXT NOT NULL REFERENCES causal_runs(id), id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK(sequence>=0), data TEXT NOT NULL, content_hash TEXT NOT NULL, PRIMARY KEY(run_id,id), UNIQUE(run_id,sequence));
      INSERT OR IGNORE INTO causal_storage_migrations(version) VALUES(1);`);
    for (const table of ['causal_nodes','causal_edges','causal_checkpoints']) {
      for (const op of ['INSERT','UPDATE','DELETE']) {
        const ref=op==='DELETE'?'OLD':'NEW';
        db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_${op.toLowerCase()}_immutable BEFORE ${op} ON ${table} WHEN (SELECT status FROM causal_runs WHERE id=${ref}.run_id) != 'running' BEGIN SELECT RAISE(ABORT,'Terminal causal run is immutable'); END;`);
      }
    }
    db.exec(`CREATE TRIGGER IF NOT EXISTS causal_runs_update_immutable BEFORE UPDATE ON causal_runs WHEN OLD.status != 'running' BEGIN SELECT RAISE(ABORT,'Terminal causal run is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS causal_runs_delete_immutable BEFORE DELETE ON causal_runs WHEN OLD.status != 'running' BEGIN SELECT RAISE(ABORT,'Terminal causal run is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS causal_nodes_no_update BEFORE UPDATE ON causal_nodes BEGIN SELECT RAISE(ABORT,'Causal records are append only'); END;
      CREATE TRIGGER IF NOT EXISTS causal_edges_no_update BEFORE UPDATE ON causal_edges BEGIN SELECT RAISE(ABORT,'Causal records are append only'); END;
      CREATE TRIGGER IF NOT EXISTS causal_checkpoints_no_update BEFORE UPDATE ON causal_checkpoints BEGIN SELECT RAISE(ABORT,'Causal records are append only'); END;
      CREATE TRIGGER IF NOT EXISTS causal_dependency_order BEFORE INSERT ON causal_edges WHEN NEW.association=0 AND NOT EXISTS(SELECT 1 FROM causal_nodes s JOIN causal_nodes t ON t.run_id=s.run_id WHERE s.run_id=NEW.run_id AND s.id=NEW.source_id AND t.id=NEW.target_id AND s.sequence<t.sequence AND s.time<=t.time) BEGIN SELECT RAISE(ABORT,'Dependencies must follow sequence and time'); END;`);
  }).immediate();
}
