/** Read-only identity handoffs. Narrative records never mutate a simulation or a room. */
import {canonicalId, parseCanonicalId, NavigationContextSchema} from '../../shared/causality/index.js';
export const SOCIAL_VERSION = 'social-continuity.v1';
export const SOCIAL_EXPERIENCES = ['living-city','inner-lives','game','act-normal','world-line-talk'];
const copy = value => value == null ? null : structuredClone(value);
const mapped = (kind, namespace, value) => value == null ? null : canonicalId(kind,namespace,String(value));
export function characterFromPerson(person, {source, context={}, tick=context.tick}={}) {
  if (!['living-city','inner-lives'].includes(source)) throw new TypeError('Unsupported character source');
  const localId=person.personId??person.id;
  if (localId==null) throw new TypeError('Person ID required');
  const navigation=NavigationContextSchema.parse({...context,...(tick==null?{}:{tick})});
  const scopedId=value=>value==null?null:`${navigation.worldId}/${value}`;
  const personId=mapped('person',source,scopedId(localId));
  return {schemaVersion:SOCIAL_VERSION,personId,source,localId:String(localId),context:{...navigation,entityId:personId},
    name:String(person.name??'Resident'),householdId:mapped('household',source,scopedId(person.householdId)),
    homeId:mapped('home',source,scopedId(person.homeId)),jobId:mapped('job',source,scopedId(person.employment?.jobId??person.jobId)),
    locationId:mapped('location',source,scopedId(person.locationId)),
    schedule:copy(person.schedule),relationships:copy(person.social??person.rel),
    evidence:source==='living-city'?'synthetic':'fictional',
    measured:source==='living-city'?{activity:person.currentActivity??null,commuteMinutes:person.commuteMinutes??null,needs:copy(person.needs)}:null,
    narrative:copy(person.journal),limitations:['Imported identity is a read-only reference; native casts and multiplayer permissions remain authoritative.','Missing home/job/location IDs mean no supported mapping; names and coordinates are never used to infer identity.']};
}
export function validateCharacter(value) {
  if(value?.schemaVersion!==SOCIAL_VERSION||!SOCIAL_EXPERIENCES.includes(value.source)||!['synthetic','fictional'].includes(value.evidence))throw new TypeError('Unsupported character record');
  const parsed=parseCanonicalId(value.personId);
  if(parsed.kind!=='person'||parsed.namespace!==value.source||parsed.localId!==`${value.context.worldId}/${value.localId}`)throw new TypeError('Person mapping mismatch');
  NavigationContextSchema.parse(value.context);
  if(value.context.entityId!==value.personId)throw new TypeError('Entity context mismatch');
  return copy(value);
}
// Time is part of the key: a later snapshot cannot silently replace an earlier identity handoff.
export function characterKey(character) {
  const c=validateCharacter(character),s=c.context;
  return JSON.stringify([s.universeId??null,s.worldId??null,s.scenarioId??null,s.experimentId??null,s.runId??null,s.branchId??null,s.tick??null,c.personId]);
}
export function createContinuityStore(storage) {
  const key='hbl-social-continuity-v1';
  const read=()=>{try{const s=JSON.parse(storage.getItem(key)||'null');return s?.version===SOCIAL_VERSION&&Array.isArray(s.characters)&&Array.isArray(s.references)?s:{version:SOCIAL_VERSION,characters:[],references:[]};}catch{return{version:SOCIAL_VERSION,characters:[],references:[]};}};
  const write=s=>storage.setItem(key,JSON.stringify(s));
  return {
    save(character){const c=validateCharacter(character),s=read(),id=characterKey(c);s.characters=s.characters.filter(x=>{try{return characterKey(x)!==id;}catch{return false;}});s.characters.push(c);s.characters=s.characters.slice(-50);write(s);return c;},
    find(context){const nav=NavigationContextSchema.parse(context);return read().characters.filter(c=>{try{validateCharacter(c);return ['universeId','worldId','scenarioId','experimentId','runId','branchId','tick','entityId'].every(k=>c.context[k]===nav[k]);}catch{return false;}}).at(-1)??null;},
    record(character,{experience,text,sourceRecordId=null}){const c=validateCharacter(character);if(!SOCIAL_EXPERIENCES.includes(experience)||typeof text!=='string'||!text.trim()||text.length>2000)throw new TypeError('Invalid narrative reference');if(sourceRecordId!==null)parseCanonicalId(sourceRecordId);const s=read();const row={id:canonicalId('narrative','social',String(s.nextSequence??0)),characterKey:characterKey(c),personId:c.personId,context:copy(c.context),experience,text:text.trim(),sourceRecordId,evidence:'fictional',simulationEffect:false};s.nextSequence=(s.nextSequence??0)+1;s.references.push(row);s.references=s.references.slice(-200);write(s);return row;},
    references(character){const id=characterKey(character);return read().references.filter(r=>r.characterKey===id);}
  };
}
