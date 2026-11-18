import {test,expect} from 'bun:test';
import {chooseStreetResidents} from '../world/people/street-residents.js';
import {buildTown} from '../world/gen.js';
import {createWorld} from '../world/sim.js';

test('street discovery follows exterior eligibility without including indoor or onboard residents',()=>{
 const row=(id,extra)=>({id,x:10,z:20,...extra});
 const people=[row('walking',{mode:'moving',travelMode:'walk'}),row('waiting',{mode:'moving',travelMode:'transit',transitWaitMinutesRemaining:3}),row('riding',{mode:'moving',travelMode:'transit',transitWaitMinutesRemaining:0}),row('park',{mode:'doing',action:'play_park'}),row('cleanup',{mode:'doing',action:'clean_park'}),row('home',{mode:'doing',action:'eat_home'}),row('work',{mode:'doing',action:'work'}),row('unknown',{}),null,row('bad',{x:NaN,mode:'moving'})];
 const before=structuredClone(people);const residents=chooseStreetResidents(people);expect(residents.map(p=>p.id)).toEqual(['walking','waiting','park','cleanup']);expect(residents[0]).toBe(people[0]);expect(people).toEqual(before);
});
test('Living discovery uses only explicit committed walking trips from the bounded observation',()=>{
 const row=(id,mode,trip)=>({id,x:0,z:0,mode,trip});
 const people=[row('walk','walk',{remainingMinutes:3}),row('car','car',{remainingMinutes:3}),row('done','walk',{remainingMinutes:0}),row('home','none',null),row('missing','walk',{})];
 expect(chooseStreetResidents(people,{mode:'living'}).map(p=>p.id)).toEqual(['walk']);expect(chooseStreetResidents(null)).toEqual([]);expect(chooseStreetResidents(people,{mode:'unknown'})).toEqual([]);
});
test('finding a real walking resident preserves simulation time, state and checkpoint',()=>{
 const town=buildTown({lat:29.7286,lng:-95.4746},null,{maxPeople:20});town.roads=[];const world=createWorld(town,{recordHistory:true,startMinute:360});const person=world.people[0];world.commandPerson(person.id,{type:'walk',destination:{x:person.x+120,z:person.z}});
 const before=world.captureCheckpoint();const rows=chooseStreetResidents(world.people);expect(rows).toContain(person);expect(world.captureCheckpoint()).toEqual(before);world.step(1);expect(person.x).not.toBe(before.people[0].x);
});
