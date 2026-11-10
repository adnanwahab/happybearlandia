import {causalContentHash} from '../../shared/causality/storage.js';
import {ReplayError} from './engine.js';
/** Stored Checkpoint.state is a replay-checkpoint.v1 envelope, never an observation. */
export function createReplayRepository(store){
 const readAll=(method,runId)=>{const rows=[];let afterSequence=-1;do{const page=store[method](runId,{limit:1000,afterSequence});rows.push(...page.items);if(page.nextCursor===null)break;if(page.nextCursor<=afterSequence)throw new ReplayError('INVALID_CURSOR','History cursor did not advance');afterSequence=page.nextCursor;}while(true);return rows;};
 const verify=row=>{const {contentHash,...body}=row;if(!contentHash||contentHash!==causalContentHash(body))throw new ReplayError('STORAGE_HASH_MISMATCH','Stored history failed content hash verification');return body;};
 return {load(context){
  const run=store.getRun(context.runId);if(!run)throw new ReplayError('CHECKPOINT_UNAVAILABLE','Run not found');
  const checkpoints=readAll('listCheckpoints',context.runId).map(verify).filter(c=>c.state?.schemaVersion==='replay-checkpoint.v1').map(c=>c.state);
  const records=readAll('listEvents',context.runId).map(verify);
  // Only explicit versioned replay records are authoritative. All other events remain descriptive.
  const events=records.map(r=>r.payload?.replayEvent||{id:r.id,context:r.context,tick:r.context?.tick??r.time,sequence:r.sequence,replayKind:'descriptive'});
  const digests=records.filter(r=>r.type==='replay.state-digest.v1').map(r=>r.payload).filter(Boolean);
  return {checkpoints,events:events.filter(e=>!records.some(r=>r.id===e.id&&r.type==='replay.state-digest.v1')),digests};
 }};
}
