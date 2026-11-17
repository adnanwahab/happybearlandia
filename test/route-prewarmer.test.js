import {test,expect} from 'bun:test';
import {createRoutePrewarmer} from '../world/render/route-prewarmer.js';
import {buildPedestrianNetwork,pedestrianRoute,warmPedestrianSource,pedestrianCacheStats} from '../world/population/pedestrian-routes.js';
test('one stationary actual origin per job; mode/source changes and disposal do not retain old work',()=>{
 const jobs=new Map(),calls=[];let next=0,active=true;const make=id=>({t:360,people:[{mode:'moving',x:1,z:2},{mode:'doing',x:3,z:4},{mode:'doing',x:5,z:6}],getActivityIdentity:()=>({runId:id}),warmRouteSource:point=>calls.push([id,point.x,point.z])});let world=make('a');
 const warmup=createRoutePrewarmer({getSource:()=>world,isActive:()=>active,now:()=>0,schedule:fn=>{jobs.set(++next,fn);return next;},cancel:id=>jobs.delete(id)});
 const run=()=>{const [id,fn]=jobs.entries().next().value;jobs.delete(id);fn();};
 warmup.start();run();expect(calls).toEqual([['a',3,4]]);expect(jobs.size).toBe(1);active=false;run();expect(calls).toHaveLength(1);active=true;world=make('b');run();expect(calls.at(-1)).toEqual(['b',3,4]);expect(world.t).toBe(360);warmup.dispose();expect(jobs.size).toBe(0);
});
test('full derived prewarm leaves geometry and exact routes unchanged and reports bounded retention',()=>{
 const network=buildPedestrianNetwork([{pts:[[0,0],[100,0],[100,100]]}]),before=structuredClone(network),expected=pedestrianRoute(network,[20,6],[94,70]);
 warmPedestrianSource(network,[20,6]);expect(network).toEqual(before);expect(pedestrianRoute(network,[20,6],[94,70])).toEqual(expected);
 const stats=pedestrianCacheStats(network);expect(stats.sourceBytes).toBeLessThanOrEqual(stats.sourceBudgetBytes);expect(stats.routeEstimatedBytes).toBeLessThanOrEqual(stats.routeBudgetBytes);expect(stats.projectionEntries).toBeLessThanOrEqual(4096);
});
