import {describe,test,expect} from 'bun:test';
import {createHoustonBarCatalogHandler,normalizeHoustonBarElements} from '../world/bar/houston-catalog.js';
import {ringContains,findVenueFootprint,venueSceneGeometry} from '../world/bars/scene.js';
import {interpretRealityResults} from '../world/reality/results-interpretation.js';
import {EXPERIENCES} from '../world/universe/registry.js';
import {readFileSync} from 'node:fs';

describe('Houston Bar Atlas real OSM boundaries',()=>{
  const bar={type:'node',id:42,lat:29.72,lon:-95.38,tags:{amenity:'bar',name:'Example Record'}};
  test('normalizes safe OSM venues and preserves exact IDs',()=>{
    expect(normalizeHoustonBarElements([bar,bar,{...bar,id:43,tags:{amenity:'restaurant'}},{...bar,id:44,lat:35}])).toEqual([{
      id:'node:42',osmType:'node',osmId:42,kind:'bar',name:'Example Record',lat:29.72,lng:-95.38,
      address:'',neighborhood:'',levels:null,sourceUrl:'https://www.openstreetmap.org/node/42',
    }]);
  });
  test('caches bounded Overpass results, rejects POST, and never invents bars',async()=>{
    let calls=0;const handler=createHoustonBarCatalogHandler({lookup:async()=>{calls++;return{elements:[bar]};},now:()=>1000});
    const request=new Request('http://localhost/api/houston-bars');
    const first=await handler(request),body=await first.json();
    expect(first.status).toBe(200);expect(body.venueCount).toBe(1);expect(body.venues[0].id).toBe('node:42');
    await handler(request);expect(calls).toBe(1);
    expect((await handler(new Request(request.url,{method:'POST'}))).status).toBe(405);
    const missing=createHoustonBarCatalogHandler({lookup:async()=>{throw Error('unavailable');}});
    const unavailable=await missing(request);expect(unavailable.status).toBe(503);expect((await unavailable.json()).venues).toEqual([]);
  });
  test('uses exact way ID or point containment, never nearest guess',()=>{
    const venue={lat:29.72,lng:-95.38,osmType:'way',osmId:7};
    const b={id:'w7',pts:[[29.719,-95.381],[29.719,-95.379],[29.721,-95.379],[29.721,-95.381],[29.719,-95.381]],levels:2};
    expect(ringContains([venue.lat,venue.lng],b.pts)).toBe(true);
    const exact=findVenueFootprint(venue,{buildings:[b]});
    expect(exact.source).toBe('osm-exact-way');
    expect(venueSceneGeometry(venue,exact).levels).toBe(2);
    expect(findVenueFootprint({...venue,osmType:'node',osmId:99},{buildings:[{...b,pts:b.pts.map(([lat,lng])=>[lat+.1,lng])}]})).toBe(null);
    expect(venueSceneGeometry(venue,null).source).toBe('illustrative');
  });
});
test('Reality Compiler distinguishes policy-test nonpasses from actual simulation errors',()=>{
  const report={summary:{requested:100,completed:100,passed:0,failed:100,errors:0,unavailable:0},manifest:{tests:[{id:'rent',metric:'medianRent',operator:'<=',threshold:5,unit:'percent'}]},runs:[
    {status:'completed',pass:false,tests:[{id:'rent',status:'fail'}]},
  ]};
  const interpreted=interpretRealityResults(report);
  expect(interpreted.status).toBe('no-goals-met');
  expect(interpreted.title).toContain('0 met every goal');
  expect(interpreted.message).toContain('does not mean');
  expect(interpreted.details[0]).toContain('medianRent');
  expect(interpretRealityResults({summary:{requested:10,completed:0,errors:10},runs:[]}).status).toBe('no-completed-runs');
});
test('Home gallery, connected universe, and /routes share one catalog',()=>{
 const index=readFileSync('index.html','utf8'),routes=readFileSync('routes.html','utf8'),shell=readFileSync('world/universe/shell.js','utf8');
 const previewCount=[...index.matchAll(/<section data-carousel=/g)].length;
 expect(previewCount).toBe(EXPERIENCES.length);
 expect(EXPERIENCES.map(x=>x.id).length).toBe(new Set(EXPERIENCES.map(x=>x.id)).size);
 expect(routes).toContain("import {EXPERIENCES}");
 expect(shell).toContain('EXPERIENCES.length');
 expect(EXPERIENCES.find(x=>x.id==='houston-bars')?.route).toBe('/world/bars/');
});
