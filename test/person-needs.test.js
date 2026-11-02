import { expect, test } from 'bun:test';
import { buildTown } from '../world/gen.js';
import { createWorld, legacyNeedSnapshot, needRateFor } from '../world/sim.js';
import { personNeedRows, personNeedsMarkup } from '../world/person-needs.js';

function worldWithActivity(action) {
  const town=buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:3});
  const world=createWorld(town,{startMinute:60});
  const person=world.people[0];
  Object.assign(person,{mode:'doing',action,target:person.home,until:world.t+90,doing:action,needs:{hunger:40,energy:40,fun:40,social:40}});
  return{world,person};
}
test('need bars report actual sleep gains and hunger decay after simulation steps',()=>{
  const {world,person}=worldWithActivity('sleep');
  const before=legacyNeedSnapshot(person,world);
  expect(needRateFor(person,'energy',world)).toBeCloseTo(.205);
  expect(personNeedRows(before).find(row=>row.id==='energy').trend).toBe('rising');
  world.step(10);
  expect(person.needs.energy).toBeCloseTo(42.05,6);
  expect(person.needs.hunger).toBeCloseTo(39.6,6);
  expect(personNeedsMarkup(legacyNeedSnapshot(person,world))).toContain('aria-valuenow="42"');
});
test('actual cooking restores food while recreation restores fun; movement decays needs',()=>{
  const {world,person}=worldWithActivity('eat_home');
  world.step(5);
  expect(person.needs.hunger).toBeCloseTo(52.55,6);
  person.action='play_park';person.target=world.byKind.park[0].index;world.buildings[person.target].state.litter=0;
  const before=person.needs.fun;world.step(5);
  expect(person.needs.fun).toBeCloseTo(before+4.75,6);
  person.mode='moving';expect(needRateFor(person,'energy',world)).toBe(-.045);
});
test('UI holds when paused, clamps extreme input, exposes missing meters and escapes labels',()=>{
  const rows=personNeedRows({needs:{hunger:120,energy:-5,fun:NaN},needRates:{hunger:2,energy:-1}});
  expect(rows[0]).toMatchObject({value:100,rate:0,trend:'steady'});
  expect(rows[1]).toMatchObject({value:0,rate:0,trend:'steady'});
  expect(rows[2].value).toBeNull();
  const person={needActivity:'<img src=x onerror=alert(1)>',needs:{hunger:20,energy:40,fun:60,social:80},needRates:{hunger:2,energy:-1}};
  const original=structuredClone(person);
  const html=personNeedsMarkup(person,{paused:true});
  expect(html).toContain('Paused · needs hold steady');
  expect(html).not.toContain('data-trend="rising"');
  expect(html).not.toContain('<img');
  expect(person).toEqual(original);
});
