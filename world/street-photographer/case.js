/** Authored checkpoint game, independent of City/Population/OSM clocks. */
export const PIN = Object.freeze({id:'street-mystery.1', rulesVersion:'street-photo.1', seed:712, runId:'toy:street:712:v1'});
export const CLUES = Object.freeze([
  Object.freeze({entityId:'toy:bakery', checkpointId:'street-cp-1', prompt:'Was the bakery open before the mystery?', hint:'Investigate the corner bakery on May 1, 2046.', flavor:'The missing morning loaf — scripted mystery.'}),
  Object.freeze({entityId:'toy:notice', checkpointId:'street-cp-2', prompt:'Find the notice explaining the quiet month.', hint:'Investigate the notice board on June 1, 2046.', flavor:'A neighbor whispers about repairs — scripted flavor.'}),
  Object.freeze({entityId:'toy:bench', checkpointId:'street-cp-3', prompt:'Find evidence that deliveries returned.', hint:'Investigate the east bench on July 1, 2046.', flavor:'Follow the imaginary flour trail — scripted flavor.'}),
]);
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
const freeze = value => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
// Independent pinned digest of scenario.json; changes require a new authored version.
const DIGEST = '64c9da76d8d0e2f2c3841cf001e237d284a46441d8aaa29733112a9f9e00c1e0';
/** @param {{checkpoints?: Array<{id:string,date:string,tick:number,entities:Array<{id:string,name:string,x:number,width:number,label:string}>}>,source?:string}} data */
export async function createCase(data) {
  if(!data || !Array.isArray(data.checkpoints) || !data.checkpoints.length) throw Error('No source data. No clue can be solved.');
  const copy=structuredClone(data);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(copy)));
  const digest=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==DIGEST) throw Error('Replay mismatch: checkpoint, source, seed or version changed. No substitute result.');
  const source=freeze(copy);
  let receipts=[], cancelled=false;
  return {
    get source(){return source;},
    get progress(){return receipts.length;},
    get receipts(){return structuredClone(receipts);},
    cancel(){cancelled=true;},
    resume(){cancelled=false;},
    restart(){receipts=[];cancelled=false;},
    /** @param {{checkpointId?:string,entityId?:string,mode?:string,cameraX?:number,snapshot?:unknown}} [input] */
    capture({checkpointId,entityId,mode='photo',cameraX=0,snapshot}={}) {
      const fail=message=>({ok:false,message});
      if(cancelled) return fail('Case paused. Resume to investigate.');
      if(receipts.length===CLUES.length) return fail('Case already solved. Restart to try again.');
      const clue=CLUES[receipts.length], cp=source.checkpoints.find(c=>c.id===checkpointId);
      if(!cp) return fail('No source checkpoint. Choose an available date.');
      if(snapshot!==undefined && canonical(snapshot)!==canonical(cp)) return fail('Replay mismatch. No clue recorded.');
      if(cp.id!==clue.checkpointId) return fail('Wrong date. Investigate another checkpoint; reveal the hint if needed.');
      if(entityId!==clue.entityId) return fail('Wrong subject. Investigate the clue location.');
      const entity=cp.entities.find(e=>e.id===entityId);
      if(!entity) return fail('No source entity at this checkpoint.');
      if(!['photo','inspect'].includes(mode)) return fail('Choose photo or text inspection.');
      // Same orthographic viewport used by page SVG: 240 units wide, no occluders.
      if(mode==='photo' && (!Number.isFinite(cameraX) || cameraX<0 || cameraX>360 || entity.x<cameraX || entity.x+entity.width>cameraX+240)) return fail('Subject outside the camera frame. Frame the whole subject, or inspect the text record.');
      const receipt=freeze({...PIN,source:source.source,clue:receipts.length+1,checkpointId:cp.id,date:cp.date,tick:cp.tick,entityId,mode,label:entity.label});
      receipts=[...receipts,receipt];
      return {ok:true,message:receipts.length===3 ? 'Case solved: the authored records show a repair closure followed by returning deliveries. Scripted interpretation, not a measured cause.' : 'Clue recorded. Investigate the next date and location.',receipt:structuredClone(receipt)};
    },
  };
}
