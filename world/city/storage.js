import {Database} from 'bun:sqlite';
import {mkdirSync, readFileSync} from 'node:fs';
import {join, resolve, relative} from 'node:path';
import {migrateCitySave} from './save-format.js';
import {VERSION} from './contracts.js';
const idPattern=/^city_[a-zA-Z0-9_-]{1,100}$/;
const sqlSchema=`
CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runs(run_id TEXT PRIMARY KEY,experiment_id TEXT NOT NULL,scenario_id TEXT NOT NULL,run_index INTEGER NOT NULL,seed INTEGER NOT NULL,status TEXT NOT NULL,model_manifest_json TEXT NOT NULL,duration_ms REAL,outcome TEXT);
CREATE TABLE IF NOT EXISTS run_metrics(run_id TEXT REFERENCES runs(run_id),metric_id TEXT,value REAL NOT NULL,PRIMARY KEY(run_id,metric_id));
CREATE TABLE IF NOT EXISTS observations(run_id TEXT REFERENCES runs(run_id),simulation_time INTEGER,geography_type TEXT,geography_id TEXT,metric_id TEXT,value REAL);
CREATE INDEX IF NOT EXISTS observations_time ON observations(run_id,simulation_time);
CREATE INDEX IF NOT EXISTS observations_metric ON observations(metric_id);
CREATE INDEX IF NOT EXISTS observations_geography ON observations(geography_id);
CREATE TABLE IF NOT EXISTS system_events(event_id INTEGER PRIMARY KEY,run_id TEXT REFERENCES runs(run_id),simulation_time INTEGER,system TEXT,event_type TEXT,geography_id TEXT,severity REAL,payload_json TEXT);
CREATE INDEX IF NOT EXISTS system_events_type ON system_events(event_type,simulation_time);
CREATE TABLE IF NOT EXISTS decisions(decision_id INTEGER PRIMARY KEY,run_id TEXT REFERENCES runs(run_id),simulation_time INTEGER,actor_type TEXT,actor_id TEXT,decision_type TEXT,trigger TEXT,chosen_option TEXT,random_draw REAL,primary_reason TEXT,model_id TEXT,model_version TEXT);
CREATE INDEX IF NOT EXISTS decisions_actor ON decisions(actor_id);
CREATE INDEX IF NOT EXISTS decisions_type ON decisions(decision_type);
CREATE INDEX IF NOT EXISTS decisions_time ON decisions(simulation_time);
CREATE TABLE IF NOT EXISTS decision_alternatives(decision_id INTEGER REFERENCES decisions(decision_id),alternative_id TEXT,eligible INTEGER,rejection_reason TEXT,utility REAL,components_json TEXT,PRIMARY KEY(decision_id,alternative_id));
CREATE TABLE IF NOT EXISTS trips(trip_id INTEGER PRIMARY KEY,run_id TEXT REFERENCES runs(run_id),person_id TEXT,departure_time INTEGER,arrival_time INTEGER,origin_id TEXT,destination_id TEXT,purpose TEXT,mode TEXT,planned_minutes REAL,experienced_minutes REAL,cost REAL,delay_minutes REAL);
CREATE TABLE IF NOT EXISTS moves(move_id INTEGER PRIMARY KEY,run_id TEXT REFERENCES runs(run_id),household_id TEXT,simulation_time INTEGER,origin_district TEXT,destination_district TEXT,previous_cost REAL,new_cost REAL,modeled_displacement INTEGER,primary_reason TEXT);
CREATE TABLE IF NOT EXISTS municipal_finance(run_id TEXT REFERENCES runs(run_id),period INTEGER,revenue REAL,operating_expense REAL,capital_expense REAL,debt REAL,balance REAL,PRIMARY KEY(run_id,period));
CREATE TABLE IF NOT EXISTS utility_state(run_id TEXT REFERENCES runs(run_id),period INTEGER,district_id TEXT,utility TEXT,demand REAL,capacity REAL,service_level REAL);
CREATE TABLE IF NOT EXISTS service_state(run_id TEXT REFERENCES runs(run_id),period INTEGER,facility_id TEXT,demand REAL,capacity REAL,utilization REAL);
CREATE TABLE IF NOT EXISTS business_observations(run_id TEXT REFERENCES runs(run_id),period INTEGER,business_id TEXT,employees INTEGER,demand_index REAL,cost_index REAL,viability REAL);
CREATE TABLE IF NOT EXISTS system_states(run_id TEXT REFERENCES runs(run_id),period INTEGER,system TEXT,state_json TEXT);
CREATE TABLE IF NOT EXISTS resource_flows(run_id TEXT REFERENCES runs(run_id),period INTEGER,resource TEXT,origin TEXT,destination TEXT,amount REAL,system TEXT);
CREATE TABLE IF NOT EXISTS analysis_results(id INTEGER PRIMARY KEY,run_id TEXT,period INTEGER,system TEXT,message TEXT);
`;
function open(path,readonly=false) {
  const db=new Database(path,readonly?{readonly:true}:{create:true});
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if(!readonly)db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  return db;
}
const json=JSON.stringify;
export class CityStore {
  constructor(root=process.env.HBL_CITY_DATA_DIR||'.hbl-city') {
    this.root=resolve(root);
    for(const name of ['world','data','game','tools','blog']) {const r=relative(resolve(name),this.root);if(!r.startsWith('..')&&!r.startsWith('/'))throw new Error('City storage must be outside served directories');}
    mkdirSync(join(this.root,'experiments'),{recursive:true,mode:0o700});mkdirSync(join(this.root,'projects'),{recursive:true,mode:0o700});
    this.control=open(join(this.root,'hbl.sqlite'));
    this.control.exec(`CREATE TABLE IF NOT EXISTS organizations(organization_id TEXT PRIMARY KEY,name TEXT); CREATE TABLE IF NOT EXISTS users(user_id TEXT PRIMARY KEY,display_name TEXT); CREATE TABLE IF NOT EXISTS project_members(project_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL,PRIMARY KEY(project_id,user_id)); CREATE TABLE IF NOT EXISTS projects(project_id TEXT PRIMARY KEY,name TEXT,world_revision TEXT); CREATE TABLE IF NOT EXISTS model_versions(model_id TEXT,version TEXT,manifest_json TEXT,PRIMARY KEY(model_id,version)); CREATE TABLE IF NOT EXISTS dataset_snapshots(snapshot_id TEXT PRIMARY KEY,metadata_json TEXT); CREATE TABLE IF NOT EXISTS experiment_index(experiment_id TEXT PRIMARY KEY,status TEXT,created_at TEXT,manifest_json TEXT,error TEXT); CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,created_at TEXT,action TEXT,entity_id TEXT); CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT);`);
    // A crash cannot leave a job permanently looking active after restart.
    this.control.query("UPDATE experiment_index SET status='interrupted',error='Server restarted; create a new experiment to resume' WHERE status IN ('running','queued')").run();
    this.queues=new Map();
  }
  path(id) {if(!idPattern.test(id))throw new Error('Invalid city experiment ID');return join(this.root,'experiments',`${id}.sqlite`);}
  get(id){this.path(id);const row=this.control.query('SELECT * FROM experiment_index WHERE experiment_id=?').get(id);return row?{...row,...migrateCitySave(JSON.parse(row.manifest_json))}:null;}
  list(){return this.control.query('SELECT experiment_id,status,created_at,error FROM experiment_index ORDER BY created_at DESC LIMIT 100').all();}
  create(id,manifest) {
    manifest=migrateCitySave(manifest).manifest;
    const db=open(this.path(id));
    try{db.exec(sqlSchema);db.query('INSERT INTO metadata VALUES (?,?)').run('manifest',json(manifest));}finally{db.close();}
    this.control.query('INSERT INTO experiment_index VALUES (?,?,?,?,NULL)').run(id,'queued',new Date().toISOString(),json(manifest));
    this.control.query('INSERT OR REPLACE INTO model_versions VALUES (?,?,?)').run('coupled-city',VERSION,json(manifest.modelManifest));
    this.control.query('INSERT OR REPLACE INTO dataset_snapshots VALUES (?,?)').run(manifest.initial.provenance.populationSnapshot,json(manifest.initial.provenance));
    this.control.query('INSERT INTO audit_log(created_at,action,entity_id) VALUES (?,?,?)').run(new Date().toISOString(),'create-experiment',id);
  }
  status(id,status,error=null){this.control.query('UPDATE experiment_index SET status=?,error=? WHERE experiment_id=?').run(status,error,id);}
  enqueue(id,write) {
    // Exactly one transaction writer per experiment. Simulation code supplies batches.
    const queued=(this.queues.get(id)||Promise.resolve()).catch(()=>{}).then(()=>{
      const db=open(this.path(id));try{return db.transaction(()=>write(db))();}finally{db.close();}
    });this.queues.set(id,queued);queued.finally(()=>{if(this.queues.get(id)===queued)this.queues.delete(id);}).catch(()=>{});return queued;
  }
  async saveRun(id,{runId,scenarioId,index,seed,metrics,steps,durationMs,retention,manifest}) {
    return this.enqueue(id,db=>{
      db.query('INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?)').run(runId,id,scenarioId,index,seed,'complete',json(manifest),durationMs,metrics.unhoused?'housing-stress':'complete');
      const insert=(table,values)=>db.query(`INSERT INTO ${table} VALUES (${values.map(()=>'?').join(',')})`).run(...values);
      for(const [key,value]of Object.entries(metrics))insert('run_metrics',[runId,key,value]);
      for(const step of steps) {
        const t=step.state.month;
        for(const o of step.observations)insert('observations',[runId,t,o.geographyType,o.geographyId,o.metricId,o.value]);
        for(const e of step.events)insert('system_events',[null,runId,t,e.system,e.eventType,e.geographyId,e.severity,json(e.payload)]);
        const f=step.state.systems.finance;insert('municipal_finance',[runId,t,f.revenue,f.operatingExpense,f.capitalExpense,f.debt,f.balance]);
        for(const u of step.state.utilities)insert('utility_state',[runId,t,u.districtId,u.type,u.demand,u.effectiveCapacity??u.capacity,u.serviceLevel]);
        for(const f of step.state.facilities)insert('service_state',[runId,t,f.id,f.demand,f.capacity,f.utilization]);
        for(const d of step.diagnostics)insert('analysis_results',[null,runId,t,d.system,d.message]);
        if(retention==='summary')continue;
        const sample=(rows)=>retention==='full'?rows:rows.filter((_,i)=>i%10===0);
        for(const d of sample(step.decisions)) {
          const result=insert('decisions',[null,runId,t,d.actorType,d.actorId,d.decisionType,null,d.chosenOption,null,d.primaryReason,d.modelId,d.modelVersion]);
          for(const a of retention==='full'?d.alternatives:[])insert('decision_alternatives',[Number(result.lastInsertRowid),a.id,Number(a.eligible),a.rejectionReason||null,a.utility??null,json(a.components||{})]);
        }
        for(const m of sample(step.moves))insert('moves',[null,runId,m.householdId,t,m.originDistrict,m.destinationDistrict,m.previousCost,m.newCost,Number(m.modeledDisplacement),m.primaryReason]);
        for(const trip of sample(step.trips))insert('trips',[null,runId,trip.personId,t*43200,t*43200+trip.experiencedMinutes,trip.originId,trip.destinationId,'work',trip.mode,trip.plannedMinutes,trip.experiencedMinutes,0,trip.delayMinutes]);
        for(const b of sample(step.state.businesses))insert('business_observations',[runId,t,b.id,b.employees||0,b.demand||0,b.cost||0,b.viability||0]);
        for(const [system,state]of Object.entries(step.state.systems))insert('system_states',[runId,t,system,json(state)]);
        for(const flow of step.flows)insert('resource_flows',[runId,t,flow.resource,flow.from,flow.to,flow.amount,flow.system]);
      }
    });
  }
  savedOutcome(id,runId) {
    const db=open(this.path(id),true);
    try{return Object.fromEntries(db.query('SELECT metric_id,value FROM run_metrics WHERE run_id=?').all(runId).map(r=>[r.metric_id,r.value]));}finally{db.close();}
  }
  tables(id){const db=open(this.path(id),true);try{return db.query("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(({name})=>({name,columns:db.query(`PRAGMA table_info(${name})`).all().map(c=>({name:c.name,type:c.type}))}));}finally{db.close();}}
  export(id){const db=open(this.path(id));try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}finally{db.close();}return readFileSync(this.path(id));}
  saveWorld(projectId,state) {
    if(!idPattern.test(projectId))throw new Error('Invalid project ID');
    const root=join(this.root,'projects',projectId);mkdirSync(root,{recursive:true,mode:0o700});const db=open(join(root,'world.sqlite'));
    try {db.transaction(()=>{
      for(const [table,rows]of Object.entries({districts:state.districts,parcels:state.parcels,buildings:state.buildings,housing_units:state.units,roads:state.links.filter(l=>l.mode==='road'),transit:state.links.filter(l=>l.mode==='transit'),facilities:state.facilities,businesses:state.businesses,jobs:state.jobs,utility_areas:state.utilities,hazard_layers:state.shocks,interventions:state.policies})) {
        db.exec(`CREATE TABLE IF NOT EXISTS ${table}(id TEXT PRIMARY KEY,district_id TEXT,status TEXT,capacity REAL,rent REAL,geometry_json TEXT,metadata_json TEXT NOT NULL)`);
        db.exec(`DELETE FROM ${table}`);
        const q=db.query(`INSERT INTO ${table} VALUES (?,?,?,?,?,?,?)`);
        for(const row of rows)q.run(row.id,row.districtId||null,row.status||row.stage||null,row.capacity??null,row.rent??null,row.geometry?json(row.geometry):null,json(row));
      }
      for(const [table,rows]of [['building',state.buildings],['parcel',state.parcels],['facility',state.facilities]]) {
        db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${table}_rtree USING rtree(spatial_id,min_x,max_x,min_y,max_y)`);db.exec(`DELETE FROM ${table}_rtree`);
        db.exec(`CREATE TABLE IF NOT EXISTS ${table}_spatial_ids(spatial_id INTEGER PRIMARY KEY,entity_id TEXT UNIQUE)`);db.exec(`DELETE FROM ${table}_spatial_ids`);
        rows.forEach((row,i)=>{if(Array.isArray(row.bbox)&&row.bbox.length===4&&row.bbox.every(Number.isFinite)&&row.bbox[0]<=row.bbox[2]&&row.bbox[1]<=row.bbox[3]){db.query(`INSERT INTO ${table}_rtree VALUES (?,?,?,?,?)`).run(i+1,row.bbox[0],row.bbox[2],row.bbox[1],row.bbox[3]);db.query(`INSERT INTO ${table}_spatial_ids VALUES (?,?)`).run(i+1,row.id);}});
      }
      db.exec('CREATE TABLE IF NOT EXISTS world_revisions(revision TEXT PRIMARY KEY,state_json TEXT NOT NULL)');db.query('INSERT OR IGNORE INTO world_revisions VALUES (?,?)').run(state.provenance.worldRevision,json(state));
    })();}finally{db.close();}
    this.control.query('INSERT OR REPLACE INTO projects VALUES (?,?,?)').run(projectId,projectId,state.provenance.worldRevision);
  }
  close(){this.control.close();}
}
export function validateReadQuery(sql) {
  if(typeof sql!=='string'||sql.length>10000)throw new Error('SQL must be at most 10,000 characters');
  const clean=sql.trim().replace(/;\s*$/,'');
  if(!/^(SELECT|WITH)\b/i.test(clean)||/;|--|\/\*|\b(attach|detach|pragma|insert|update|delete|drop|alter|create|replace|vacuum|load_extension|writefile|readfile)\b/i.test(clean))throw new Error('Only a single read-only SELECT or WITH query is allowed');
  return clean;
}
export function queryDatabase(path,sql) {
  const clean=validateReadQuery(sql),db=open(path,true);
  try{db.exec('PRAGMA query_only=ON;');const rows=db.query(`SELECT * FROM (${clean}) LIMIT 1001`).all();return {rows:rows.slice(0,1000),truncated:rows.length>1000};}finally{db.close();}
}
