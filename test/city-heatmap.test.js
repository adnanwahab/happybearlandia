import {test,expect} from 'bun:test';
import {cityHeatmap} from '../world/population/city-heatmap.js';
import {createPopulationModel,snapshotPopulation,stepPopulation} from '../world/population/model.js';
test('home counts use all residents and interaction counts obey spatial and time boundaries',()=>{
 const model={minute:60,tick:4,seed:42,weight:1000,locations:[{id:'a',x:0,z:0},{id:'b',x:100,z:100}],people:{age:[1,1,1],homeLocation:[0,0,1]},hotspots:{encounters:[{placeId:'b',minute:30},{placeId:'b',minute:31},{placeId:'b',minute:60},{placeId:'a',minute:61},{placeId:'missing',minute:50}]}};
 const before=JSON.stringify(model),result=cityHeatmap(model);
 expect(result.occupancy.map(r=>r.count)).toEqual([2,1]);expect(result.occupancy.reduce((s,r)=>s+r.representedCount,0)).toBe(3000);
 expect(result.activity).toEqual([{id:'b',x:100,z:100,count:2}]);expect(result.unmapped).toBe(1);expect(JSON.stringify(model)).toBe(before);
});
test('snapshot projection is independent of visible sample and deterministic',()=>{
 const a=createPopulationModel({population:1000,seed:42,representedPopulation:1000000}),b=createPopulationModel({population:1000,seed:42,representedPopulation:1000000});
 stepPopulation(a,{tick:1,minutes:60});stepPopulation(b,{tick:1,minutes:60});
 const frame=snapshotPopulation(a,{visibleLimit:0}),first=frame.cityHeatmap;
 expect(frame.density.total).toBe(1000);expect(frame.density.tick).toBe(first.tick);expect(frame.density.minute).toBe(first.minute);
 expect(first).toEqual(snapshotPopulation(a,{visibleLimit:500}).cityHeatmap);expect(first).toEqual(snapshotPopulation(b).cityHeatmap);
 expect(first.occupancy.reduce((s,r)=>s+r.count,0)).toBe(1000);expect(first.occupancy.reduce((s,r)=>s+r.representedCount,0)).toBe(1000000);
});
