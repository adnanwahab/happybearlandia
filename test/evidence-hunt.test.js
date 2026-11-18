import {test,expect} from 'bun:test';
import {readArchive, createHunt, CLUES, KEY, PIN, recordAt} from '../world/evidence-hunt/core.js';
import {recordDemo} from '../world/evidence-hunt/record.js';
import {createEngine} from '../world/city/engine.js';
const raw=await Bun.file(new URL('../world/evidence-hunt/demo.json',import.meta.url)).text();
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('pinned archive independently replays exact immutable checkpoints and inspector sources',async()=>{
  const archive=await readArchive(raw),before=JSON.stringify(archive);
  expect(recordDemo()).toEqual(archive);
  const replay=createEngine(undefined,{trace:true}).run(archive.initial,3);
  expect(replay.steps).toEqual(archive.steps);
  expect(JSON.stringify(archive)).toBe(before);
  for(const stop of archive.stops)expect(recordAt(archive,stop)).toBeTruthy();
  expect(new Set(archive.stops.map(s=>s.pointer)).size).toBe(5);
  const [housing,transit,flood,business,household]=archive.stops.map(s=>recordAt(archive,s));
  expect(housing.primaryReason).toContain('seeded conflict');
  expect(transit.entity).toEqual(['links','transit-d1-d0']);
  expect(transit.inputs.activeFloods[0].id).toBe(flood.payload.shockId);
  expect(transit.outputs.closed).toBe(true);
  expect(flood.payload.units).toBeGreaterThan(0);
  expect(business.viability).toBe(business.demand-business.cost);
  expect(business.viability).toBeLessThan(0);
  expect(household.payload.householdId).toBe('household-0');
});
test('success requires exact opened source records, ordered route, and survives reload',async()=>{
  const archive=await readArchive(raw),storage=memory();let hunt=createHunt(archive,storage);
  expect(()=>hunt.open(4)).toThrow('preceding');
  const opened=hunt.open(0);expect(hunt.visited).toEqual([]);
  expect(()=>hunt.inspected(0,{...opened,record:{}})).toThrow('mismatch');
  for(let i=0;i<5;i++){
    hunt.inspected(i,hunt.open(i));
    hunt=createHunt(await readArchive(raw),storage);
    expect(hunt.visited).toEqual(CLUES.slice(0,i+1).map(c=>c[0]));
  }
  hunt.inspected(4,hunt.open(4));expect(hunt.visited).toHaveLength(5);
  hunt.reset();expect(createHunt(archive,storage).visited).toEqual([]);
});
test('failure: absent and mismatched source, stale progress and unavailable local storage never invent results',async()=>{
  await expect(readArchive(null)).rejects.toThrow('No source data');
  await expect(readArchive(raw.replace('714','715'))).rejects.toThrow('Replay mismatch');
  const archive=await readArchive(raw),missing=structuredClone(archive);
  missing.steps[0].decisions=[];
  const storage=memory();const hunt=createHunt(missing,storage);
  expect(()=>hunt.open(0)).toThrow('No source data');expect(hunt.visited).toEqual([]);
  storage.setItem(KEY,JSON.stringify({pin:'old',visited:CLUES.map(c=>c[0])}));
  expect(createHunt(archive,storage).visited).toEqual([]);
  storage.setItem(KEY,JSON.stringify({pin:PIN,visited:['housing','flood','transit']}));
  expect(createHunt(archive,storage).visited).toEqual(['housing']);
  const denied=createHunt(archive,{getItem(){throw Error();},setItem(){throw Error();}});
  denied.inspected(0,denied.open(0));expect(denied.notice).toContain('will not survive');
});
