import { MODEL_VERSION } from '../future-machine/contracts.js';
import { createEngine } from '../city/engine.js';
import { stateHash, freeze } from '../future-machine/data/core.js';
import { initialForRecipe, validateRecipe } from '../future-machine/data/index.js';

export const METRIC = Object.freeze({ id:'housingUnits', definition:'City unit inventory length', unit:'homes', min:0, max:160 });
export const TIME = Object.freeze({ unit:'modeled month', origin:'2026-01', points:Array.from({length:121},(_,i)=>i) });
export const VERSION = 'racetrack-projection.v1';
const equal = (a,b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length && keys.every(key=>Object.hasOwn(b,key) && equal(a[key],b[key]));
};
export async function validateTrack(input) {
  const track = structuredClone(input);
  if (track?.schemaVersion !== VERSION || !equal(track.metric, METRIC) || !equal(track.time, TIME)) throw Error('Unsupported metric/time contract');
  if (track.modelVersion !== MODEL_VERSION || !equal(track.rules, createEngine().manifest)) throw Error('Unsupported model/rules version');
  if (typeof track.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(track.id) || typeof track.label !== 'string' || track.label.length > 120) throw Error('Invalid run identity');
  const recipe = validateRecipe(track.recipe);
  if (track.seed !== recipe.seed || track.initialHash !== await stateHash(initialForRecipe(track.recipe))) throw Error('Seed/initial state mismatch');
  if (!Array.isArray(track.values) || track.values.length !== 121 || Array.from(track.values).some(v=>v !== null && (!Number.isInteger(v) || v < METRIC.min || v > METRIC.max))) throw Error('Invalid recorded values');
  if (!equal(track.provenance, initialForRecipe(track.recipe).provenance)) throw Error('Unsupported source provenance');
  if (track.evidenceKind !== 'synthetic-model-output' || !track.provenance || typeof track.provenance !== 'object') throw Error('Missing provenance');
  const { checksum, ...body } = track;
  if (checksum !== await stateHash(body)) throw Error('Receipt checksum mismatch');
  return freeze(track);
}
export async function admitTracks(bundle) {
  if (bundle?.schemaVersion !== VERSION || !Array.isArray(bundle.tracks) || bundle.tracks.length > 100) throw Error('Expected at most 100 projection receipts');
  const lanes=[], excluded=[];
  for (const [i, raw] of bundle.tracks.entries()) {
    try {
      const lane=await validateTrack(raw), first=lanes[0];
      if (lanes.some(l=>l.id===lane.id)) throw Error('Duplicate run identity');
      if (first && (lane.seed !== first.seed || lane.initialHash !== first.initialHash)) throw Error('Unmatched seed/initial state');
      lanes.push(lane);
    } catch(error) { excluded.push({index:i, reason:error.message}); }
  }
  return freeze({lanes, excluded});
}
export function frame(lanes, month) {
  if (!Number.isInteger(month) || month<0 || month>120) throw Error('Invalid month');
  return lanes.map(lane=>({id:lane.id,value:lane.values[month],position:lane.values[month]===null?null:(lane.values[month]-METRIC.min)/(METRIC.max-METRIC.min)}));
}
/** Discrete lead transitions only; never interpolate across missing observations. */
export function leadChanges(lanes, month) {
  const current=frame(lanes,month);
  if(month===0)return [];
  const previous=frame(lanes,month-1), changes=[];
  for(let a=0;a<current.length;a++)for(let b=a+1;b<current.length;b++) {
    const now=[current[a].value,current[b].value], before=[previous[a].value,previous[b].value];
    if([...now,...before].some(v=>v===null))continue;
    if(now[0]>now[1] && before[0]<=before[1])changes.push({ahead:lanes[a].id,behind:lanes[b].id,month});
    if(now[1]>now[0] && before[1]<=before[0])changes.push({ahead:lanes[b].id,behind:lanes[a].id,month});
  }
  return changes;
}
