/** Local player interpretation. Never part of a simulation save or share payload. */
export const NOTES_KEY='hbl:private-checkpoint-notes:v1';
const SCHEMA='private-checkpoint-notes.v1',MAX=200,MAX_BYTES=1024*1024;
export function parseNotes(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Notes file exceeds 1 MiB.');
 const data=JSON.parse(text);
 if(data?.schemaVersion!==SCHEMA||!Array.isArray(data.notes)||data.notes.length>MAX)throw Error('Unsupported notes file.');
 const ids=new Set();
 return data.notes.map(n=>{
  if(!n||typeof n.id!=='string'||n.id.length>100||!n.id||typeof n.text!=='string'||!n.text.trim()||n.text.length>4000||typeof n.anchor!=='string'||n.anchor.length>2000)throw Error('Invalid note.');
  if(ids.has(n.id))throw Error('Duplicate note ID.');ids.add(n.id);
  const a=JSON.parse(n.anchor);
  if(!Array.isArray(a)||a.length!==7||a.some(v=>typeof v!=='string')||!a[0]||!a[1]||!a[2]||!a[3]||!/^\d+$/.test(a[4])||!a[5]||!a[6]||a[0]!==a[1]||! /^[a-f0-9]{64}$/.test(a[6]))throw Error('Invalid note anchor.');
  return {id:n.id,text:n.text,anchor:n.anchor};
 });
}
export const serializeNotes=notes=>JSON.stringify({schemaVersion:SCHEMA,notes},null,2);
export function createNoteStore(storage){
 const read=()=>parseNotes(storage.getItem(NOTES_KEY)||serializeNotes([]));
 const write=notes=>{const text=serializeNotes(notes);parseNotes(text);storage.setItem(NOTES_KEY,text);};
 return {read,add(note){const notes=read();write([...notes,note]);},remove(id){write(read().filter(n=>n.id!==id));},clear(){storage.removeItem(NOTES_KEY);},export:()=>serializeNotes(read()),import(text){const incoming=parseNotes(text),notes=read();const map=new Map(notes.map(n=>[n.id,n]));for(const n of incoming){if(map.has(n.id)&&JSON.stringify(map.get(n.id))!==JSON.stringify(n))throw Error('Conflicting note ID; nothing imported.');map.set(n.id,n);}write([...map.values()]);}};
}
export async function checkpointNoteAnchor(record,cryptoImpl=globalThis.crypto){
 const c=record?.save?.checkpoint,s=record?.save;
 if(!record?.id||s?.schemaVersion!=='world-experiment-save.v1')throw Error('Save and reopen an experiment first.');
 let minute,entity='moment';
 const selection=s.view?.selection;
 if(s.mode==='legacy'&&c?.schemaVersion==='legacy-checkpoint.v1'&&c.modelVersion==='neighborhood-activity.v2'){
  minute=c.world?.t;
  if(selection){const rows=selection.type==='person'?c.people:selection.type==='building'?c.buildings:null;if(!rows?.some(r=>String(r.id)===String(selection.id)))throw Error('Selected entity is absent from this checkpoint.');entity=selection.type+':'+selection.id;}
 }else if(s.mode==='living'){
  const {readPopulationCheckpoint}=await import('../population/checkpoint.js');
  const {residentIndex}=await import('../civilization/families/history.js');
  const state=readPopulationCheckpoint(c);minute=state.model.minute;
  if(selection){if(selection.type!=='person'||residentIndex(state.model,String(selection.id))<0)throw Error('Selected entity is absent from this checkpoint.');entity='person:'+selection.id;}
 }else throw Error('Unsupported checkpoint version.');
 if(!Number.isSafeInteger(minute)||minute<0)throw Error('Checkpoint time unavailable.');
 const digest=Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(c)))),b=>b.toString(16).padStart(2,'0')).join('');
 return JSON.stringify([record.id,record.id,c.schemaVersion,c.modelVersion,String(minute),entity,digest]);
}
