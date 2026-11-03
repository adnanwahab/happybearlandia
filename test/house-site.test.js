import {test,expect} from 'bun:test';
import {createPopulationRuntime} from '../world/population/runtime.js';
import {readPopulationCheckpoint,createPopulationCheckpoint} from '../world/population/checkpoint.js';
import {projector} from '../world/gen.js';
import {deriveHouseSite,householdHomeBuildingIds} from '../world/house/site.js';

async function fixture(){
 const origin={lat:29.7286,lng:-95.4746},runtime=createPopulationRuntime({config:{population:12,householdSize:4,seed:4},initialMinute:360,stepMinutes:1,worldContext:{buildings:[{id:'home-a',kind:'home',center:[0,0]},{id:'home-b',kind:'home',center:[30,0]}]}});
 try{await runtime.ready;const checkpoint=await runtime.exportCheckpoint(),state=readPopulationCheckpoint(checkpoint),householdId=runtime.getSnapshot().households[0].id,buildingId=householdHomeBuildingIds(checkpoint,householdId)[0],geo=projector(origin),toGeo=ring=>ring.map(([x,z])=>geo.toLatLng(x,z)),outer=[[-5,-4],[5,-4],[5,0],[1,0],[1,4],[-5,4],[-5,-4]],hole=[[-3,-3],[-2,-3],[-2,-2],[-3,-2],[-3,-3]],building={id:buildingId,pts:toGeo(outer),holes:[toGeo(hole)],levels:2};return{householdId,buildingId,state,outer,hole,toGeo,save:{schemaVersion:'world-experiment-save.v1',mode:'living',checkpoint,geometry:{area:{source:'osm',origin,buildings:[building],roads:[{id:'near-road',pts:toGeo([[-20,-6],[20,-6]])},{id:'far-road',pts:toGeo([[100,-20],[100,20]])}]}},view:{origin,houseMode:{householdId,buildingId}}}};
 }finally{runtime.destroy();}
}

test('exact saved OSM concavity, courtyard and street orientation survive projection without a preset rectangle',async()=>{
 const f=await fixture(),before=JSON.stringify(f.save),site=deriveHouseSite(f.save,{householdId:f.householdId,checkpointState:f.state});
 expect(site.status).toBe('mapped');expect(site.buildingId).toBe(f.buildingId);expect(site.footprint.outer).toHaveLength(7);expect(site.footprint.holes[0]).toHaveLength(5);
 for(let i=0;i<f.outer.length;i++)for(let axis=0;axis<2;axis++)expect(site.footprint.outer[i][axis]).toBeCloseTo(f.outer[i][axis],6);
 expect(site.footprint.widthMeters).toBeCloseTo(10,6);expect(site.footprint.depthMeters).toBeCloseTo(8,6);expect(site.footprint.areaM2).toBeCloseTo(63,5);
 expect(site.street.id).toBe('near-road');expect(site.street.headingRadians).toBeCloseTo(0,8);expect(site.street.distanceMeters).toBeCloseTo(6,6);
 expect(site.interiorEvidence.status).toBe('unavailable');expect(site.provenance.networkRequests).toBe(0);expect(JSON.stringify(f.save)).toBe(before);
});

test('GeoJSON longitude/latitude rings resolve to the same exterior and courtyard',async()=>{
 const f=await fixture(),original=deriveHouseSite(f.save,f.householdId),building=f.save.geometry.area.buildings[0];building.geometry={type:'Polygon',coordinates:[building.pts,...building.holes].map(ring=>ring.map(([lat,lng])=>[lng,lat]))};delete building.pts;delete building.holes;
 expect(deriveHouseSite(f.save,{householdId:f.householdId}).footprint).toEqual(original.footprint);
});

test('missing source geometry stays unavailable and unrelated buildings are never substituted',async()=>{
 const f=await fixture();expect(()=>deriveHouseSite(f.save,{householdId:f.householdId,buildingId:'unrelated-house'})).toThrow('not a recorded home');
 const saved=deriveHouseSite(f.save,f.householdId);f.save.view.houseMode.site=saved;f.save.geometry.area.source='none';const unavailable=deriveHouseSite(f.save,f.householdId);expect(unavailable.status).toBe('unavailable');expect(unavailable.footprint).toBeNull();
 f.save.geometry.area.source='osm';f.save.geometry.area.buildings=[];expect(deriveHouseSite(f.save,f.householdId).status).toBe('unavailable');
});

test('ambiguous household home anchors require an explicit matching building',async()=>{
 const f=await fixture(),m=f.state.model,h=Number(f.householdId.split('-h').at(-1)),person=m.households.start[h]+1,other=m.locations.findIndex(location=>['home-a','home-b'].includes(location.id)&&location.id!==f.buildingId);expect(other).toBeGreaterThanOrEqual(0);m.people.homeLocation[person]=other;f.save.checkpoint=createPopulationCheckpoint(f.state);delete f.save.view.houseMode.buildingId;
 expect(deriveHouseSite(f.save,f.householdId).status).toBe('ambiguous');expect(deriveHouseSite(f.save,{householdId:f.householdId,buildingId:f.buildingId}).status).toBe('mapped');
});

test('only supplied indoor mapping is classified as mapped room evidence',async()=>{
 const f=await fixture();f.save.geometry.area.indoorFeatures=[{id:'actual-room',buildingId:f.buildingId,tags:{indoor:'room'},pts:f.toGeo([[-4,-3],[0,-3],[0,-1],[-4,-1],[-4,-3]])},{id:'wrong-building-room',buildingId:'other',tags:{indoor:'room'},pts:f.toGeo(f.outer)}];
 const site=deriveHouseSite(f.save,f.householdId);expect(site.interiorEvidence.status).toBe('supplied-indoor-osm');expect(site.interiorEvidence.features.map(row=>row.id)).toEqual(['actual-room']);
});

test('repeat house entry resolves explicit, cached and inferred IDs without reassigning caller input',async()=>{
 const f=await fixture(),options=Object.freeze({householdId:f.householdId,buildingId:f.buildingId}),before=JSON.stringify(f.save);
 const initial=deriveHouseSite(f.save,options);
 for(let i=0;i<3;i++){expect(deriveHouseSite(f.save,options).footprint).toEqual(initial.footprint);expect(deriveHouseSite(f.save).buildingId).toBe(f.buildingId);}
 const single=structuredClone(f.save),state=readPopulationCheckpoint(single.checkpoint),index=Number(f.householdId.split('-h').at(-1)),location=state.model.locations.findIndex(row=>row.id===f.buildingId);for(let k=0;k<state.model.households.size[index];k++)state.model.people.homeLocation[state.model.households.start[index]+k]=location;single.checkpoint=createPopulationCheckpoint(state);delete single.view.houseMode.buildingId;
 expect(deriveHouseSite(single,{householdId:f.householdId}).buildingId).toBe(f.buildingId);
 expect(JSON.stringify(f.save)).toBe(before);
});
