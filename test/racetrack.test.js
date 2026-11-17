import {test,expect} from 'bun:test';
import bundle from '../world/racetrack/representative.json';
import {admitTracks,validateTrack,frame,leadChanges} from '../world/racetrack/contract.js';
import {stateHash} from '../world/future-machine/data/core.js';
import {representativeTrack} from '../scripts/generate-racetrack.js';
async function resign(lane) {const {checksum,...body}=lane;return {...body,checksum:await stateHash(body)};}
test('100 actual City projections are aligned, immutable, deterministic and include lead changes',async()=>{
 const {lanes,excluded}=await admitTracks(bundle);
 expect(lanes).toHaveLength(100);expect(excluded).toEqual([]);
 expect(new Set(lanes.map(l=>l.initialHash)).size).toBe(1);
 expect(new Set(lanes.map(l=>l.seed))).toEqual(new Set([42]));
 expect(await representativeTrack(0)).toEqual(bundle.tracks[0]);
 expect(await representativeTrack(99)).toEqual(bundle.tracks[99]);
 expect(Object.isFrozen(lanes[0].values)).toBe(true);
 expect(frame(lanes,0).every(l=>l.value===36)).toBe(true);
 expect(lanes.some(l=>l.values.some((v,i)=>i&&v>l.values[i-1]))).toBe(true);
 expect(frame(lanes,120)[99].position).toBe(lanes[99].values[120]/160);
 expect(()=>frame(lanes,121)).toThrow();expect(()=>frame(lanes,0.5)).toThrow();
});
test('missing values stay missing and incompatible/corrupt lanes are excluded with reasons',async()=>{
 const missing=structuredClone(bundle.tracks[0]);missing.values[4]=null;
 const lane=await validateTrack(await resign(missing));
 expect(frame([lane],4)[0]).toEqual({id:lane.id,value:null,position:null});
 for(const mutate of [l=>l.modelVersion='old',l=>l.rules={},l=>l.metric.unit='people',l=>l.time.points[4]=5,l=>l.values[3]=161,l=>l.values[3]=NaN,l=>l.values[3]=2.2,l=>l.values.pop(),l=>l.seed=43,l=>l.provenance={},l=>l.values[3]=null]){
  const bad=structuredClone(bundle.tracks[1]);mutate(bad);
  const result=await admitTracks({...bundle,tracks:[bundle.tracks[0],bad]});
  expect(result.lanes).toHaveLength(1);expect(result.excluded).toHaveLength(1);
 }
 // A duplicated run cannot create another apparent future.
 expect((await admitTracks({...bundle,tracks:[lane,lane]})).excluded[0].reason).toContain('Duplicate');
 await expect(admitTracks({...bundle,tracks:Array(101).fill(lane)})).rejects.toThrow('100');
});

test('lead transition time is the first recorded point, ties and gaps never imply interpolation',()=>{
 const lanes=[{id:'a',values:[1,2,2,null,4]},{id:'b',values:[2,1,2,3,3]}];
 expect(leadChanges(lanes,0)).toEqual([]);
 expect(leadChanges(lanes,1)).toEqual([{ahead:'a',behind:'b',month:1}]);
 expect(leadChanges(lanes,2)).toEqual([]);
 expect(leadChanges(lanes,3)).toEqual([]);
 expect(leadChanges(lanes,4)).toEqual([]);
});
