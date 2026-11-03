import {test,expect} from 'bun:test';
import {createDatePlace,validateDatePlace,datePlaceFromPhoton,datePlaceFromOSM,haversineMeters} from './date-place.js';
test('global places retain actual OSM coordinates, identity, address and bounded provenance',()=>{const place=datePlaceFromPhoton({geometry:{coordinates:[139.7,35.6]},properties:{osm_type:'N',osm_id:123,name:'Tokyo museum',osm_key:'tourism',osm_value:'museum',city:'Tokyo',street:'Museum Road'}});expect(place).toMatchObject({id:'osm:node:123',lat:35.6,lng:139.7,kind:'museum',source:'osm',provenance:{provider:'photon'}});expect(place.tags.art).toBe(true);expect(place.activities).toContain('museum');expect(place.address).toContain('Tokyo');expect(validateDatePlace(place)).toBe(true);const way=datePlaceFromOSM({type:'way',id:456,center:{lat:35,lon:139},tags:{name:'Garden',leisure:'garden','addr:city':'Kyoto'}});expect(way.id).toBe('osm:way:456');expect(way.kind).toBe('garden');expect(way.sourceUrl).toBe('https://www.openstreetmap.org/way/456');});
test('invalid or unnamed provider places cannot become fabricated venues',()=>{expect(datePlaceFromOSM({type:'node',id:12,lat:0,lon:0,tags:{amenity:'cafe'}})).toBeNull();expect(datePlaceFromPhoton({geometry:{coordinates:[999,10]},properties:{name:'Bad',osm_id:1,osm_type:'N'}})).toBeNull();expect(()=>createDatePlace({id:'synthetic:1',name:'Fake',lat:0,lng:0})).toThrow();expect(haversineMeters({lat:0,lng:0},{lat:0,lng:1})).toBeCloseTo(111195,0);});

test('Yark Green curated preset preserves honest identity and rejects altered coordinates',async()=>{
 const {yarkGreenDatePlace}=await import('./date-place.js');const venue=yarkGreenDatePlace();
 expect(venue.source).toBe('curated');expect(venue.id).toBe('curated:yark-green-thai');expect(validateDatePlace(venue)).toBe(true);
 expect(createDatePlace({...venue,lat:0,name:'Fake name'})).toEqual(venue);
 expect(()=>validateDatePlace({...venue,lat:0})).toThrow();expect(()=>validateDatePlace({...venue,source:'osm'})).toThrow();
 expect(()=>createDatePlace({...venue,id:'curated:unknown'})).toThrow();
});
