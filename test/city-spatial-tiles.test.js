import {test,expect} from 'bun:test';
import {createCity,createCityFromArea} from '../world/city/seed.js';
import {indexCityTiles,createTileStream} from '../world/city/spatial-tiles.js';
const wait=()=>new Promise(r=>setTimeout(r,10));
const sum=source=>source.tiles.reduce((a,t)=>{for(const k of Object.keys(a))a[k]+=t.summary[k];return a;},{buildings:0,units:0,households:0,residents:0});
test('complete inventory partition includes missing locations and unhoused without changing source',async()=>{
 const state=createCity({seed:158,households:30});state.households[0].unitId=null;state.units[0].buildingId='missing';state.households[1].districtId='unknown';state.households[1].unitId=null;
 const before=JSON.stringify(state),source=indexCityTiles(state);expect(sum(source)).toEqual(source.totals);expect(source.totals).toEqual({buildings:3,units:36,households:30,residents:90});expect(source.tiles.every(t=>t.schematic)).toBe(true);for(const t of source.tiles)await source.load(t.key);expect(JSON.stringify(state)).toBe(before);expect(source.provenance.seed).toBe(158);
});
test('imported footprint positions are deterministic and preserve source identity and mass',async()=>{
 const buildings=Array.from({length:12},(_,i)=>({id:`b${i}`,pts:[[30,-95+i*.003],[30.0001,-95+i*.003],[30,-94.9999+i*.003]]}));
 const state=createCityFromArea({source:'osm',origin:{lat:30,lng:-95},buildings},{seed:158,households:30});const a=indexCityTiles(state),b=indexCityTiles(state);expect(a.tiles.length).toBeGreaterThan(6);expect(a.tiles).toEqual(b.tiles);expect(a.tiles.every(t=>!t.schematic)).toBe(true);expect(sum(a)).toEqual(a.totals);expect((await a.load(a.tiles[0].key))[0].id).toBe('osm-b0');
});
test('rapid motion cancels stale loads, bounds concurrency and ignores late completion',async()=>{
 const source=indexCityTiles(createCity({households:30})),pending=[],events=[];
 const stream=createTileStream(source,{maxTiles:1,concurrency:1,onChange:s=>events.push(s),load:(key,{signal})=>new Promise(resolve=>pending.push({key,signal,resolve}))});
 stream.update(source.tiles[0].bounds);await wait();expect(pending.length).toBe(1);
 stream.update(source.tiles[2].bounds);expect(pending[0].signal.aborted).toBe(true);pending[0].resolve([{id:'obsolete'}]);await wait();expect(pending.length).toBe(2);expect(stream.getState().tiles.flatMap(t=>t.shapes)).toEqual([]);pending[1].resolve([{id:'current'}]);await wait();expect(stream.getState().tiles.flatMap(t=>t.shapes)).toEqual([{id:'current'}]);expect(events.every(s=>s.totals===source.totals&&s.active<=1)).toBe(true);stream.dispose();
});
test('summary fallback cancels pending work and preserves totals on errors and empty views',async()=>{
 const source=indexCityTiles(createCity()),pending=[];const stream=createTileStream(source,{load:(key,{signal})=>new Promise((resolve,reject)=>pending.push({signal,reject}))});
 stream.update(source.bounds);await wait();stream.update(source.bounds,{coarse:true});expect(pending.every(p=>p.signal.aborted)).toBe(true);for(const p of pending)p.reject(new Error('abort'));await wait();expect(stream.getState().tiles.every(t=>t.status==='coarse')).toBe(true);expect(stream.getState().totals).toEqual(source.totals);
 stream.update(source.bounds);await wait();for(const p of pending.slice(2))p.reject(new Error('failed'));await wait();for(const p of pending.slice(4))p.reject(new Error('failed'));await wait();expect(stream.getState().tiles.some(t=>t.status==='error')).toBe(true);expect(stream.getState().totals).toEqual(source.totals);
 stream.update({minX:1e6,minY:1e6,maxX:1e6+1,maxY:1e6+1});expect(stream.getState().tiles.every(t=>t.status==='coarse')).toBe(true);stream.dispose();
});
test('disposal during work prevents callbacks and materialization respects abort',async()=>{
 const source=indexCityTiles(createCity()),c=new AbortController();c.abort();await expect(source.load(source.tiles[0].key,{signal:c.signal})).rejects.toThrow('cancelled');
 let resolve,calls=0;const stream=createTileStream(source,{concurrency:1,onChange:()=>calls++,load:()=>new Promise(r=>resolve=r)});stream.update(source.bounds);await wait();stream.dispose();const before=calls;resolve([]);await wait();expect(calls).toBe(before);
});
test('reset retries failures without changing complete totals',async()=>{
 const source=indexCityTiles(createCity());let fail=true;const stream=createTileStream(source,{load:async()=>{if(fail)throw new Error('failure');return [];}});stream.update(source.bounds);await wait();expect(stream.getState().tiles.every(t=>t.status==='error')).toBe(true);fail=false;stream.update(source.bounds,{retry:true});await wait();expect(stream.getState().tiles.every(t=>t.status==='ready')).toBe(true);expect(stream.getState().totals).toEqual(source.totals);stream.dispose();
});
