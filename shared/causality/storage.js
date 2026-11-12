import {createHash} from 'node:crypto';
import {RunContextSchema, EventSchema, ObservationSchema, AssumptionSchema, EdgeSchema, CheckpointSchema, sameRun} from './index.js';
import {migrateCausalStorage} from './storage-migrations.js';

// Reject values which JSON would silently discard or coerce before hashing.
export function canonicalJSON(value) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+Array.from(value,v=>canonicalJSON(v)).join(',')+']';
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(value[k])).join(',')+'}';
  throw new TypeError('Causal records must contain only finite JSON values');
}
export const causalContentHash=value=>createHash('sha256').update(canonicalJSON(value)).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const parse=row=>row?{...JSON.parse(row.data),...(row.content_hash?{contentHash:row.content_hash}:{})}:null;
const pageSize=limit=>{if(limit===undefined)return 100;if(!Number.isInteger(limit)||limit<1||limit>1000)fail('limit must be between 1 and 1000');return limit;};
const id=value=>{if(typeof value!=='string'||!value.length||value.length>1024)fail('Expected a nonempty causal ID');return value;};

/** Attach causal history to an existing SQLite connection. Does not own its lifetime. */
export function createCausalStore(db) {
  migrateCausalStorage(db);
  const getRun=runId=>{const row=db.query('SELECT * FROM causal_runs WHERE id=?').get(runId);return row?{...parse(row),status:row.status,revision:row.revision}:null;};
  const writable=(runId,revision)=>{const run=getRun(runId);if(!run)fail('Causal run not found',404);if(run.status!=='running')fail('Terminal causal run is immutable',409);if(run.revision!==revision)fail('Causal run revision conflict',409);return run;};
  const page=(rows,limit,key)=>({items:rows.slice(0,limit).map(parse),nextCursor:rows.length>limit?rows[limit-1][key]:null});
  const listNodes=(kind,runId,{limit,afterSequence=-1}={})=>{limit=pageSize(limit);if(!Number.isSafeInteger(afterSequence)||afterSequence< -1)fail('Invalid sequence cursor');return page(db.query('SELECT * FROM causal_nodes WHERE run_id=? AND kind=? AND sequence>? ORDER BY sequence LIMIT ?').all(runId,kind,afterSequence,limit+1),limit,'sequence');};
  const createRun=db.transaction(run=>{
    const context=RunContextSchema.parse(run.context??run);
    const metadata=run.context?run.metadata:undefined;
    if(metadata!==undefined&&(!metadata||Array.isArray(metadata)||typeof metadata!=='object'||Object.keys(metadata).some(k=>!['manifest','metricDefinitions','provenance','interventions','distributions'].includes(k))))fail('Invalid causal run metadata');
    run={id:context.runId,context,...(metadata===undefined?{}:{metadata})};canonicalJSON(run);
    if(run.status!==undefined&&run.status!=='running')fail('New causal runs must be running');
    if(context.parentRunId){const parent=getRun(context.parentRunId);if(!parent)fail('Parent causal run not found',404);if(['universeId','worldId','scenarioId'].some(k=>parent.context[k]!==context[k]))fail('Parent causal run scope mismatch');}
    if(getRun(run.id))fail('Causal run already exists',409);
    db.query('INSERT INTO causal_runs(id,status,data) VALUES(?,?,?)').run(run.id,'running',canonicalJSON({...run,status:'running'}));return getRun(run.id);
  });
  const commit=db.transaction((runId,step)=>{
    if(!step||Object.keys(step).some(k=>!['expectedRevision','events','observations','assumptions','edges','checkpoints'].includes(k)))fail('Invalid causal step');
    for(const key of ['events','observations','assumptions','edges','checkpoints'])if(step[key]!==undefined&&(!Array.isArray(step[key])||step[key].length>10000))fail('Causal step arrays must be bounded');
    const run=writable(runId,step.expectedRevision);
    const prior=db.query('SELECT MAX(sequence) AS sequence FROM causal_nodes WHERE run_id=?').get(runId).sequence;
    const validate=(record,schema)=>{schema.parse(record);if(!sameRun(record.context,run.context))fail('Record must reference its own run');};
    for(const [kind,key] of [['event','events'],['observation','observations'],['assumption','assumptions']])for(const record of step[key]??[]){
      validate(record,kind==='event'?EventSchema:kind==='observation'?ObservationSchema:AssumptionSchema);
      if(!Number.isSafeInteger(record.sequence)||record.sequence<0||!Number.isFinite(record.context.tick))fail('Invalid record sequence or time');
      if(prior!==null&&record.sequence<=prior)fail('Causal steps must append sequence');
      const raw=canonicalJSON(record);
      db.query('INSERT INTO causal_nodes(run_id,id,kind,sequence,time,data,content_hash) VALUES(?,?,?,?,?,?,?)').run(runId,record.id,kind,record.sequence,record.context.tick,raw,causalContentHash(record));
    }
    if(db.query('SELECT 1 FROM (SELECT time,LAG(time) OVER (ORDER BY sequence) AS previous FROM causal_nodes WHERE run_id=?) WHERE time<previous LIMIT 1').get(runId))fail('Node sequence must follow simulation time');
    for(const record of step.edges??[]){
      validate(record,EdgeSchema);
      for(const evidenceId of record.evidenceIds)if(!db.query('SELECT 1 FROM causal_nodes WHERE run_id=? AND id=?').get(runId,evidenceId))fail('Edge evidence must exist in the same run');
      const raw=canonicalJSON(record);
      db.query('INSERT INTO causal_edges(run_id,id,source_id,target_id,association,data,content_hash) VALUES(?,?,?,?,?,?,?)').run(runId,record.id,record.fromId,record.toId,record.relation==='correlates'?1:0,raw,causalContentHash(record));
    }
    for(const record of step.checkpoints??[]){
      validate(record,CheckpointSchema);
      if(record.hash!==causalContentHash(record.state))fail('Checkpoint state hash mismatch');
      db.query('INSERT INTO causal_checkpoints(run_id,id,sequence,data,content_hash) VALUES(?,?,?,?,?)').run(runId,record.id,record.sequence,canonicalJSON(record),causalContentHash(record));
    }
    db.query('UPDATE causal_runs SET revision=revision+1 WHERE id=?').run(runId);return getRun(runId);
  });
  const complete=db.transaction((runId,{expectedRevision,status='completed'}={})=>{
    writable(runId,expectedRevision);if(!['completed','failed'].includes(status))fail('Invalid terminal status');
    // Streaming digest avoids materializing a large completed run in memory.
    const digest=createHash('sha256');
    digest.update(canonicalJSON({...getRun(runId),status}));
    for(const table of ['causal_nodes','causal_edges','causal_checkpoints'])for(const row of db.query(`SELECT id,content_hash FROM ${table} WHERE run_id=? ORDER BY id`).iterate(runId))digest.update(canonicalJSON([table,row.id,row.content_hash]));
    db.query('UPDATE causal_runs SET status=?,content_hash=?,revision=revision+1 WHERE id=?').run(status,digest.digest('hex'),runId);return getRun(runId);
  });
  return {
    createRun:run=>createRun.immediate(run),getRun,
    commitStep:(runId,step)=>commit.immediate(runId,step),completeRun:(runId,options)=>complete.immediate(runId,options),
    getNode:(runId,nodeId)=>parse(db.query('SELECT * FROM causal_nodes WHERE run_id=? AND id=?').get(runId,nodeId)),
    listEvents:(runId,options)=>listNodes('event',runId,options),listObservations:(runId,options)=>listNodes('observation',runId,options),listAssumptions:(runId,options)=>listNodes('assumption',runId,options),
    listRuns({limit,afterId='',...scope}={}){limit=pageSize(limit);const allowed=['universeId','worldId','scenarioId','status'];if(Object.keys(scope).some(k=>!allowed.includes(k)))fail('Unknown run filter');const clauses=['id>?'],values=[afterId];for(const [key,value]of Object.entries(scope)){clauses.push(key==='status'?'status=?':`json_extract(data,'$.context.${key}')=?`);values.push(value);}const rows=db.query(`SELECT * FROM causal_runs WHERE ${clauses.join(' AND ')} ORDER BY id LIMIT ?`).all(...values,limit+1);return {items:rows.slice(0,limit).map(r=>getRun(r.id)),nextCursor:rows.length>limit?rows[limit-1].id:null};},
    listEdges(runId,{limit,afterId='',sourceId,targetId,association}={}){limit=pageSize(limit);const clauses=['run_id=?','id>?'],values=[runId,afterId];for(const [column,value]of [['source_id',sourceId],['target_id',targetId],['association',association===undefined?undefined:Number(association)]])if(value!==undefined){clauses.push(column+'=?');values.push(value);}return page(db.query(`SELECT * FROM causal_edges WHERE ${clauses.join(' AND ')} ORDER BY id LIMIT ?`).all(...values,limit+1),limit,'id');},
    listCheckpoints(runId,{limit,afterSequence=-1}={}){limit=pageSize(limit);if(!Number.isSafeInteger(afterSequence)||afterSequence< -1)fail('Invalid sequence cursor');return page(db.query('SELECT * FROM causal_checkpoints WHERE run_id=? AND sequence>? ORDER BY sequence LIMIT ?').all(runId,afterSequence,limit+1),limit,'sequence');},
  };
}
