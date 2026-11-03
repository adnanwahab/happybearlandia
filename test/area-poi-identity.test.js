import {test,expect} from 'bun:test';
import {createAreaService} from '../world/api.js';
import {createDatePlace} from '../world/house/date-place.js';
test('core area POIs preserve actual OSM node identity, raw tags and provider provenance',async()=>{
 const service=createAreaService({readSnapshot:()=>null,writeSnapshot:()=>{},endpoints:['https://fixture.test/overpass'],fetchImpl:async()=>Response.json({elements:[{type:'node',id:12345,lat:35.65,lon:139.7,tags:{name:'Actual cafe',amenity:'cafe','addr:street':'Actual street'}},{type:'node',lat:35.651,lon:139.701,tags:{name:'Unidentified record',amenity:'restaurant'}}]})});
 const area=await service.getCore(35.65,139.7,400),poi=area.pois[0];
 expect(poi).toMatchObject({id:'osm:node:12345',osmType:'node',osmId:'12345',lat:35.65,lng:139.7,source:'osm',osmTags:{amenity:'cafe','addr:street':'Actual street'},provenance:{provider:'overpass',osmType:'node',osmId:'12345'}});
 expect(createDatePlace(poi)).toMatchObject({id:'osm:node:12345',kind:'cafe',activities:['talk','coffee','dessert']});
 expect(area.pois[1].id).toBeUndefined();expect(area.pois[1].source).toBeUndefined();
});
test('legacy cached POIs without provider identity remain unverified rather than receiving fabricated OSM IDs',async()=>{
 const legacy={source:'osm',origin:{lat:35.65,lng:139.7},radiusM:400,buildings:[],roads:[],pois:[{name:'Old cafe',kind:'food',lat:35.65,lng:139.7}]};
 const service=createAreaService({readSnapshot:()=>legacy,writeSnapshot:()=>{},staleWhileRevalidate:false,endpoints:['https://fixture.test/overpass'],fetchImpl:async()=>{throw Error('network offline');}});
 const area=await service.getCore(35.65,139.7,400);expect(area.pois).toEqual(legacy.pois);expect(area.pois[0].id).toBeUndefined();expect(()=>createDatePlace(area.pois[0])).toThrow();
});
