import {test,expect} from 'bun:test';
import {inspectInfrastructure} from '../world/infrastructure-scanner.js';
import {buildTown} from '../world/gen.js';
const buildings=Array.from({length:15},(_,i)=>({id:`w${100+i}`,kind:'home',pts:[[40,-74],[40.0001,-74],[40.0001,-73.9999],[40,-74]]}));
const road={sourceRef:'osm:way:42',nodeRefs:['osm:node:1','osm:node:2'],kind:'residential',pts:[[0,0],[0,20]]};
test('source IDs and node membership are inspected without utility claims',()=>{
 const result=inspectInfrastructure({x:0,z:10},[road],'osm');
 expect(result.state).toBe('supported');expect(result.id).toBe('osm:way:42');expect(result.nodeRefs).toEqual(road.nodeRefs);expect(result.text).toContain('unknown — no spatial network evidence');
});
test('missing, synthetic, remote and invalid evidence cannot create connections',()=>{
 for(const [point,roads,source,state] of [[null,[road],'osm','missing'],[{x:0,z:10},[road],'synthetic','unsupported'],[{x:0,z:10},[{...road,sourceRef:undefined}],'osm','missing'],[{x:100,z:10},[road],'osm','missing']])expect(inspectInfrastructure(point,roads,source).state).toBe(state);
 expect(()=>inspectInfrastructure({x:0,z:0},null,'osm')).toThrow('unavailable');
});
test('World projection retains provider identities without assigning them to old roads',()=>{
 const area={origin:{lat:40,lng:-74},source:'osm',buildings,roads:[{...road,pts:[[40,-74],[40.001,-74]]},{kind:'path',pts:[[40,-74],[40,-74.001]]}]};
 const town=buildTown(area.origin,area,{maxPeople:0});expect(town.roads[0].sourceRef).toBe(road.sourceRef);expect(town.roads[0].nodeRefs).toEqual(road.nodeRefs);expect(town.roads[1].sourceRef).toBeUndefined();
});

test('Overpass core preserves actual way/node references end to end',async()=>{
 const {createAreaService}=await import('../world/api.js');let query='';
 const service=createAreaService({readSnapshot:()=>null,writeSnapshot:()=>{},endpoints:['https://fixture.test'],fetchImpl:async(url,options)=>{query=String(options.body);return Response.json({elements:[{type:'way',id:42,nodes:[1,2],tags:{highway:'residential'},geometry:[{lat:40,lon:-74},{lat:40.001,lon:-74}]}]});}});
 const area=await service.getCore(40,-74,400);const town=buildTown(area.origin,{...area,buildings},{maxPeople:0});
 expect(query).toContain('body');expect(town.roads[0].nodeRefs).toEqual(road.nodeRefs);expect(inspectInfrastructure({x:0,z:0},town.roads,town.source).id).toBe('osm:way:42');
});
