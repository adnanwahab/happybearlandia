import {test,expect} from 'bun:test';
import {newCityMemory,rememberPlan,memorySnapshot,reviewMonth,advanceMemory,repairMemory,validMemory} from '../world/city-memory.js';
import {households,projectRememberedHousehold} from '../world/follow-family.js';
const rivera=households[0];
test('apartments reduce rent gradually and re-adoption preserves the original clock',()=>{
 const memory=newCityMemory(),plans={affordability:[0]};rememberPlan(memory,'affordability',[0],0);
 const rent=m=>projectRememberedHousehold(rivera,plans,memory,m).rent;
 expect([rent(0),rent(1),rent(2),rent(3)]).toEqual([1800,1680,1560,1440]);
 rememberPlan(memory,'affordability',[0],2);expect(memory.projects['affordability:0'].adopted).toBe(0);
 expect(reviewMonth(memory,'affordability',[0],1)).toBe(3);
});
test('roadworks hurt diner earnings before commute benefits arrive',()=>{
 const memory=newCityMemory(),plans={commute:[0,1]};rememberPlan(memory,'commute',[0,1],0);
 const early=projectRememberedHousehold(rivera,plans,memory,1),late=projectRememberedHousehold(rivera,plans,memory,3);
 expect(early.income).toBe(3900);expect(early.commute).toBe(37);
 expect(late.income).toBe(4000);expect(late.commute).toBe(24);
});
test('withdrawal cancels future benefits, and re-approval starts a new schedule',()=>{
 const memory=newCityMemory();rememberPlan(memory,'commute',[0],0);rememberPlan(memory,'commute',[],1);
 expect(memorySnapshot(memory,{commute:[]},4).effectivePlans.commute).toEqual([]);
 rememberPlan(memory,'commute',[0],4);expect(memorySnapshot(memory,{commute:[0]},6).effectivePlans.commute).toEqual([]);
 expect(memorySnapshot(memory,{commute:[0]},7).effectivePlans.commute).toEqual([0]);
});
test('storms charge exposed households and completed defenses prevent damage',()=>{
 const memory=newCityMemory();expect(projectRememberedHousehold(rivera,{},memory,5).stormCost).toBe(0);
 expect(projectRememberedHousehold(rivera,{},memory,6).stormCost).toBe(1200);
 rememberPlan(memory,'flooding',[0,2],0);const plans={flooding:[0,2]};
 expect(projectRememberedHousehold(rivera,plans,memory,6).stormCost).toBe(0);
 expect(projectRememberedHousehold(rivera,plans,memory,12).stormCost).toBe(480);
 expect(projectRememberedHousehold(rivera,plans,memory,12,750).stormCost).toBe(750);
});
test('upkeep restores protection, cannot be charged twice, and preserves storm history',()=>{
 const memory=newCityMemory(),plans={flooding:[0,2]};rememberPlan(memory,'flooding',[0,2],0);
 expect(memorySnapshot(memory,plans,10).protection).toBe(6000);
 expect(repairMemory(memory,10)).toBe(2);expect(repairMemory(memory,10)).toBe(0);
 expect(memorySnapshot(memory,plans,12).protection).toBe(10000);
 advanceMemory(memory,plans,12);expect(memory.events.at(-1).text).toContain('major storm');
});
test('old saved policies retain delivered effects when migrated',()=>{
 const plans={commute:[0,1]},memory=validMemory(undefined,plans,8);
 expect(projectRememberedHousehold(rivera,plans,memory,8).commute).toBe(24);
 expect(memorySnapshot(memory,plans,8).construction).toBe(0);
});
