import {test, expect} from 'bun:test';
import {households, projectHousehold} from '../world/follow-family.js';
test('cheaper housing can displace a job and reduce family income',()=>{
 const before=projectHousehold(households[0]);
 const after=projectHousehold(households[0],{affordability:[2]});
 expect(after.rent).toBeLessThan(before.rent);
 expect(after.income).toBeLessThan(before.income);
 expect(after.job).toContain('displaced');
});
test('a studio does not house the Rivera family; community housing and voucher do',()=>{
 const studio=projectHousehold(households[0],{family:[2]});
 expect(studio.rent).toBe(1800);expect(studio.housing).toBe('Current rental');
 const suitable=projectHousehold(households[0],{family:[0,1]});
 expect(suitable.rent).toBe(1150);expect(suitable.housing).toContain('Two-bedroom');
});
test('transport and taxes change commute, happiness and disposable income',()=>{
 const state=projectHousehold(households[0],{commute:[0,1],happiness:[2]});
 expect(state.commute).toBe(24);expect(state.income).toBe(3880);
 expect(state.balance).toBe(280);expect(state.happiness).toBeGreaterThan(58);
});
test('restaurant losses affect diner households and defenses reduce flood exposure',()=>{
 expect(projectHousehold(households[1],{restaurant:[]}).income).toBe(2800);
 expect(projectHousehold(households[1],{restaurant:[0,1]}).income).toBe(4800);
 expect(projectHousehold(households[2],{flooding:[0,2]}).floodRisk).toBe(0);
});
