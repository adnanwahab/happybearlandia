import {test,expect} from 'bun:test';
import {residentNeedQuests,describeResident,questProgress} from '../world/launch-gameplay.js';
test('quest suggestions use only observed low needs and stay tied to person/run identity',()=>{
 const people=[{id:'p1',name:'Resident 1',needs:{food:20,energy:90}},{id:'p2',needs:{food:NaN,social:0}}];const quests=residentNeedQuests(people,'run1');expect(quests.map(q=>q.need)).toEqual(['food','social']);expect(questProgress(quests[0],people,'run2').state).toBe('different-run');expect(questProgress(quests[0],[],'run1').state).toBe('unobserved');expect(questProgress(quests[0],[{id:'p1',needs:{food:60}}],'run1').state).toBe('complete');expect(people[0].needs.food).toBe(20);
});
test('dialogue summaries do not fabricate missing biography',()=>{
 const facts=describeResident({id:'p1',needs:{food:12},doing:'walking',homeId:'house-1'});expect(facts.state).toContain('food 12/100');expect(facts.state).toContain('walking');expect(facts.home).toContain('house-1');expect(facts.home).toContain('Work: not recorded');expect(describeResident(null)).toBeNull();
});
