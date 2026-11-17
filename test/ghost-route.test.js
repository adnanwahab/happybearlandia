import {test,expect} from 'bun:test';
import {validateGhostRoute} from '../world/people/ghost-route.js';
import {installLegacyPersonCommands} from '../world/person-commands.js';
const obstacle={poly:[[4,-1],[6,-1],[6,1],[4,1]]};
test('mapped waypoints detour around blocked fixture; crossing, touching and internal segments reject',()=>{
 const trip={routeKind:'mapped-sidewalk',path:[[0,3],[10,3],[10,0]]};
 expect(validateGhostRoute(trip,[0,0],[obstacle])).toEqual([[0,0],...trip.path]);
 for(const [from,path] of [[[0,0],[[10,0]]],[[4,0],[[6,0]]],[[5,0],[[5,.5]]],[[0,1],[[10,1]]]])expect(()=>validateGhostRoute({routeKind:'mapped-sidewalk',path},from,[obstacle])).toThrow('blocked');
});
test('unsupported and malformed routes fail closed',()=>{
 for(const trip of [{routeKind:'straight-line fallback',path:[[10,0]]},{routeKind:'mapped-sidewalk',path:[[NaN,0]]},{routeKind:'mapped-sidewalk',path:[]}])expect(()=>validateGhostRoute(trip,[0,0])).toThrow();
});
test('preview preserves person, trips, history, clock and validates actual identities',()=>{
 const world={people:[{id:'real',x:0,z:0}],buildings:[obstacle],t:30,events:[]};
 installLegacyPersonCommands(world,{planWalk:()=>({routeKind:'mapped-sidewalk',path:[[0,3],[10,3]],minutes:1}),historyEvent:()=>{throw Error('preview wrote history');},actions:{}});
 const before=structuredClone({people:world.people,t:world.t,events:world.events});
 expect(world.previewPersonWalk('real',{x:10,z:3}).points).toEqual([[0,0],[0,3],[10,3]]);
 expect({people:world.people,t:world.t,events:world.events}).toEqual(before);
 expect(()=>world.previewPersonWalk('fake',{x:10,z:3})).toThrow('Unknown');
});
import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';
test('normal model solver supplies preview route without checkpoint mutation; commit remains distinct',()=>{
 const town=buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:10});
 // Explicit synthetic geometry fixture, using the actual sidewalk solver and model.
 town.roads=[{pts:[[0,0],[100,0]]}];
 const world=createWorld(town,{recordHistory:true,startMinute:420}),p=world.people[0];
 p.x=10;p.z=6;
 // Fixture blockers are distinct from generated model buildings.
 for(const b of world.buildings)b.poly=[[40,20],[60,20],[60,40],[40,40]];
 const before=world.captureCheckpoint(),preview=world.previewPersonWalk(p.id,{x:90,z:6});
 expect(preview.rulesVersion).toBe('sidewalks.v1');
 expect(preview.points[0]).toEqual([10,6]);
 expect(preview.points.at(-1)).toEqual([90,6]);
 expect(world.captureCheckpoint()).toEqual(before);
 world.commandPerson(p.id,{type:'walk',destination:{x:90,z:6}});
 expect(p.mode).toBe('moving');expect(p.x).toBe(10);
});
import {mountGhostFootsteps} from '../world/people/ghost-footsteps.js';
test('overlay bounds markers, records pacing, cancels pending frames and removes its DOM',()=>{
 let next=0,removed=false;const frames=new Map(),win={performance:{now:()=>0},requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};
 const doc={defaultView:win,createElement:()=>({style:{},setAttribute(){},append(){},replaceChildren(){},remove(){removed=true;}})};
 const overlay=mountGhostFootsteps({container:{ownerDocument:doc,append(){}},project:p=>({x:p[0],y:p[1]})});
 overlay.show([[0,0],[100000,0]]);expect(overlay.getStats().markers).toBeLessThanOrEqual(180);
 function tick(now){const [id,fn]=frames.entries().next().value;frames.delete(id);fn(now);}
 tick(10);tick(35);expect(overlay.getStats().maxFrameGapMs).toBe(25);
 overlay.clear();expect(frames.size).toBe(0);expect(overlay.getStats().markers).toBe(0);
 overlay.show([[0,0],[10,0]]);overlay.destroy();expect(frames.size).toBe(0);expect(removed).toBe(true);
});
