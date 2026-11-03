import {test,expect} from 'bun:test';
import {buildDateWorld,createDateWorldLoader,dateWorldKey} from './date-world.js';
import {dateRendererRecords,dateMovementRequest} from './date-scene/presentation.js';
const place={id:'osm:node:1',name:'Actual cafe',lat:29.7,lng:-95.4,source:'osm'};
test('temporary world preserves exact mapped geometry and actual identities without creating population',()=>{
 const area={source:'osm',cacheStatus:'snapshot',stale:true,buildings:[{id:'w1',levels:3,pts:[[29.7,-95.4],[29.7001,-95.4],[29.7001,-95.3999],[29.7,-95.4]]}],roads:[{pts:[[29.7,-95.4],[29.7001,-95.4]]}],pois:[{id:'p2',name:'Real park',lat:29.7001,lng:-95.4}]};const original=JSON.stringify(area),world=buildDateWorld(place,area,{participantIds:['a','b','a']});
 expect(world.participantIds).toEqual(['a','b']);expect(world.buildings).toHaveLength(1);expect(world.buildings[0].height).toBeCloseTo(9.6);expect(world.roads[0].points[1][1]).toBeCloseTo(-11.054);expect(world.provenance.stale).toBe(true);expect(world.people).toBeUndefined();expect(JSON.stringify(area)).toBe(original);
});
test('unavailable map contains only chosen place, no fictional businesses or buildings',()=>{const world=buildDateWorld(place,{source:'none',error:'offline'});expect(world.status).toBe('fallback');expect(world.buildings).toEqual([]);expect(world.roads).toEqual([]);expect(world.places.map(p=>p.id)).toEqual([place.id]);expect(world.provenance.error).toBe('offline');expect(dateWorldKey({lat:91,lng:0})).toBeNull();});
test('superseded request ignoring cancellation cannot publish over active chosen place',async()=>{
 const pending=[],published=[];const loader=createDateWorldLoader({nearby:false,fetchImpl:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve})),onUpdate:w=>published.push(w)});
 const first=loader.load(place),secondPlace={...place,id:'two',lat:35,lng:139};const second=loader.load(secondPlace);expect(pending[0].options.signal.aborted).toBe(true);expect(pending[1].url).toContain('radiusM=400');pending[1].resolve({ok:true,json:async()=>({source:'osm',buildings:[]})});await second;pending[0].resolve({ok:true,json:async()=>({source:'osm',buildings:[]})});expect(await first).toBeNull();expect(loader.current.origin).toEqual({lat:35,lng:139});expect(published.at(-1).selectedPlace.id).toBe('two');loader.destroy();
});
test('provider failure returns explicit fallback; cancellation never publishes error',async()=>{const loader=createDateWorldLoader({nearby:false,fetchImpl:async()=>{throw Error('offline');}});expect((await loader.load(place)).provenance.error).toBe('offline');loader.destroy();});
test('renderer uses canonical pair exactly once and emits movement requests without changing people',()=>{const people=[{id:'a',x:5,z:3},{id:'b',x:7,z:3},{id:'other',x:0,z:0},{id:'a',x:99,z:99}],date={id:'d',personIds:['a','b']},state=dateRendererRecords({active:date,people,dateWorld:{key:'world'}});expect(state.people.map(p=>p.id)).toEqual(['a','b']);expect(dateMovementRequest(state,1,0)).toEqual({dateId:'d',personId:'a',x:8,z:3});expect(people[0].x).toBe(5);expect(dateRendererRecords({...state,date:{...date,localPositions:{a:{x:1,z:2}}}}).people[0].x).toBe(1);});

test('cancel returns promptly even when fetch ignores its signal',async()=>{const loader=createDateWorldLoader({nearby:false,fetchImpl:()=>new Promise(()=>{}),timeoutMs:10000});const pending=loader.load(place);loader.cancel();expect(await pending).toBeNull();loader.destroy();});

import {dateWorldRequest} from './date-world.js';
test('only active arrived geography loads; plan, travel and replay cannot prefetch destination',()=>{
 const date={id:'d',personIds:['a','b'],globalPlace:place,venue:{id:'local',x:9000,z:9000},phase:'date'};
 expect(dateWorldRequest({date})).toEqual({place,participantIds:['a','b']});
 for(const phase of ['planning','traveling','traveling-home'])expect(dateWorldRequest({date:{...date,phase}})).toBeNull();
 expect(dateWorldRequest({selectedPlace:place})).toBeNull();expect(dateWorldRequest({date,readOnly:true})).toBeNull();expect(dateWorldRequest({date:{...date,travel:{destination:place}}})).toBeNull();
 expect(dateWorldRequest({date:{...date,globalPlace:undefined,venue:{globalPlace:place}}}).place).toBe(place);
});
test('read-only replay may explicitly request current mapped context for its own recorded place',()=>{const date={id:'past',personIds:['a','b'],phase:'date',venue:place};expect(dateWorldRequest({date,readOnly:true})).toBeNull();expect(dateWorldRequest({date,readOnly:true,loadRecordedContext:true})).toEqual({place,participantIds:['a','b']});});

import {normalizeDateWorldPlace,dateWorldVenuePlace,mergeDateWorldPlaces} from './date-world.js';
test('OSM identities survive normalization; old cache coordinates never become made-up OSM venue IDs',()=>{
 const point={name:'Actual cafe',lat:29.7,lng:-95.4,kind:'cafe'};
 expect(normalizeDateWorldPlace(point)).toBeNull();expect(normalizeDateWorldPlace({...point,id:'osm:29.7:-95.4'})).toBeNull();
 const valid=normalizeDateWorldPlace({...point,id:'osm:node:123',tags:{amenity:'cafe'}});expect(valid.schemaVersion).toBe('date-place.v1');expect(valid.activities).toContain('coffee');expect(dateWorldVenuePlace(valid)?.id).toBe('osm:node:123');
 const world=buildDateWorld({...point,id:'location:7'},{source:'osm',pois:[point,{...point,id:'osm:node:123'}]});expect(world.places[0].interactive).toBe(false);expect(world.places[1].id).toBeNull();expect(world.places[1].markerId).toBe('map-point:0');expect(world.places[2].interactive).toBe(true);
});
test('nearby enrichment accepts only versioned real OSM places in selected 400m neighborhood',()=>{
 const valid=normalizeDateWorldPlace({...place,id:'osm:node:123',kind:'cafe'}),world=buildDateWorld(place,{source:'osm'}),merged=mergeDateWorldPlaces(world,{places:[valid,valid,{...valid,id:'osm:node:999',lat:30},{...valid,id:'osm:node:7',schemaVersion:'bogus'}]});expect(merged.places.filter(p=>p.id==='osm:node:123')).toHaveLength(1);expect(merged.places.some(p=>p.id==='osm:node:999'||p.id==='osm:node:7')).toBe(false);expect(world.places).toHaveLength(1);
});
test('map paints before slow nearby enrichment, which merges progressively and cannot overwrite newer destination',async()=>{
 const pending=[],published=[];const loader=createDateWorldLoader({fetchImpl:(url,{signal})=>new Promise(resolve=>pending.push({url,signal,resolve})),onUpdate:w=>published.push(w)});
 const first=loader.load(place);expect(pending[0].url).toStartWith('/api/area?');expect(pending[1].url).toStartWith('/api/date-places/nearby?');pending[0].resolve({ok:true,json:async()=>({source:'osm',buildings:[]})});await new Promise(r=>setTimeout(r,0));expect(loader.current.status).toBe('ready');expect(loader.current.nearby.status).toBe('loading');
 const valid=normalizeDateWorldPlace({...place,id:'osm:node:123',kind:'cafe'});pending[1].resolve({ok:true,json:async()=>({places:[valid]})});expect((await first).places.some(p=>p.id===valid.id)).toBe(true);
 const old=loader.load(place),next=loader.load({...place,lat:35,lng:139});expect(pending[2].signal.aborted).toBe(true);expect(pending[3].signal.aborted).toBe(true);pending[4].resolve({ok:true,json:async()=>({source:'osm'})});pending[5].resolve({ok:false,status:503});await next;pending[2].resolve({ok:true,json:async()=>({source:'osm'})});pending[3].resolve({ok:true,json:async()=>({places:[valid]})});expect(await old).toBeNull();expect(loader.current.origin.lat).toBe(35);expect(loader.current.nearby.status).toBe('unavailable');loader.destroy();
});

test('indoor OSM venue dresses its containing mapped footprint without replacing geometry',()=>{
 const venue={...place,name:'Tokyo Joe’s Shot Bar',kind:'bar',osmTags:{amenity:'bar'}};
 const area={source:'osm',buildings:[{id:'w1',pts:[[29.6999,-95.4001],[29.6999,-95.3999],[29.7001,-95.3999],[29.7001,-95.4001]]}]};
 const world=buildDateWorld(venue,area);
 expect(world.buildings).toHaveLength(1);expect(world.buildings[0]).toMatchObject({id:'w1',source:'osm',selectedVenue:true,venueStyle:'bar',name:venue.name});
 expect(world.buildings[0].polygon).toHaveLength(4);expect(world.provenance.modeledVenue).toBe(false);
});
test('indoor point with no footprint gets an explicitly illustrative bounded exterior, never an invented OSM building',()=>{
 const world=buildDateWorld({...place,kind:'bar',osmTags:{amenity:'bar'}},{source:'none',error:'provider offline'});
 expect(world.buildings).toHaveLength(1);expect(world.buildings[0]).toMatchObject({source:'modeled',height:4.2,selectedVenue:true});
 expect(world.buildings[0].geometrySource).toContain('not a surveyed footprint');expect(world.provenance.modeledVenue).toBe(true);expect(world.source).toBe('unavailable');
 expect(buildDateWorld({...place,kind:'park',osmTags:{leisure:'park'}},{}).buildings).toHaveLength(0);
});

test('terrain arrives progressively without delaying mapped buildings and stale terrain cannot overwrite a new place',async()=>{
 let resolveTerrain;const terrain=new Promise(resolve=>resolveTerrain=resolve),published=[];
 const loader=createDateWorldLoader({nearby:false,terrainLoader:()=>terrain,fetchImpl:async()=>Response.json({source:'osm',buildings:[]}),onUpdate:world=>published.push(world)});
 const first=loader.load({...place,lat:41.312,lng:-74.006});
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(published.at(-1).source).toBe('osm');expect(published.at(-1).terrain).toBeUndefined();
 loader.cancel();resolveTerrain({schemaVersion:'date-terrain.v1',status:'ready',heights:[0]});
 expect(await first).toBeNull();expect(loader.current.terrain).toBeUndefined();
 loader.destroy();
});
