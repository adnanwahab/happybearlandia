import {test,expect} from 'bun:test';
import {createPopulationModel,stepPopulation,serializePopulation,restorePopulation} from '../population/model.js';
import {applyHouseholdAction,cancelHouseholdAction,configureHouseLife,inspectHouse} from './model.js';

function fixture({cook=true}={}){
 const model=createPopulationModel({population:8,householdSize:4,seed:5,employmentRate:0},{},{initialMinute:360,initialTick:360});
 const householdId=model.prefix+'-h0',cookId=model.prefix+'-p0',childId=model.prefix+'-p2';
 // This generated household includes a four-year-old and an eligible adult cook.
 expect(model.people.ageYears[2]).toBe(4);
 configureHouseLife(model,{householdId,autonomy:false,parameters:{eventChancePerDay:0,breakagePerUseHour:0,firePerCookMinute:0}});
 if(cook){applyHouseholdAction(model,{householdId,personId:cookId,type:'cook'});stepPopulation(model,{minutes:30});}
 model.people.hunger[2]=8;
 return{model,householdId,cookId,childId};
}

test('one completed prepared meal moves a critically hungry child into a comfortable food range',()=>{
 const {model,householdId,childId}=fixture(),cash=model.households.savings[0],start=model.minute;
 expect(inspectHouse(model,0).preparedServings).toBe(4);
 applyHouseholdAction(model,{householdId,personId:childId,type:'eat'});
 expect(model.people.hunger[2]).toBe(8);
 expect(model.minute).toBe(start);
 expect(inspectHouse(model,0).preparedServings).toBe(3);
 stepPopulation(model,{minutes:20});
 expect(model.people.hunger[2]).toBeCloseTo(63,3);
 expect(model.minute).toBe(start+20);
 expect(model.households.savings[0]).toBe(cash);
 expect(inspectHouse(model,0).totals).toMatchObject({mealsPrepared:4,mealsConsumed:1,eatingMinutes:20});
 expect(inspectHouse(model,0).preparedServings).toBe(3);
 expect(inspectHouse(model,0).actions).toHaveLength(0);
});

test('a half-eaten meal gives half the recovery and cancellation grants no completion or serving refund',()=>{
 const {model,householdId,childId}=fixture();
 const action=applyHouseholdAction(model,{householdId,personId:childId,type:'eat'});
 stepPopulation(model,{minutes:10});
 expect(model.people.hunger[2]).toBeCloseTo(35.5,3);
 expect(inspectHouse(model,0).totals.mealsConsumed).toBe(0);
 cancelHouseholdAction(model,{householdId,personId:childId,actionId:action.actionId});
 expect(model.people.hunger[2]).toBeCloseTo(35.5,3);
 expect(inspectHouse(model,0).interruptedActions.at(-1)).toMatchObject({actualPersonMinutes:10,noCompletionGranted:true,refund:0});
 stepPopulation(model,{minutes:10});
 expect(model.people.hunger[2]).toBeLessThan(63);
 expect(inspectHouse(model,0).totals).toMatchObject({mealsConsumed:0,eatingMinutes:10});
 expect(inspectHouse(model,0).preparedServings).toBe(3);
 expect(inspectHouse(model,0).actions).toHaveLength(0);
});

test('changing meal duration spreads the same reserved serving across actual eating minutes',()=>{
 for(const durationMinutes of [15,20,60]){
  const {model,householdId,childId}=fixture();
  applyHouseholdAction(model,{householdId,personId:childId,type:'eat',durationMinutes});
  stepPopulation(model,{minutes:durationMinutes-1});
  expect(model.people.hunger[2]).toBeCloseTo(8+55*(durationMinutes-1)/durationMinutes,3);
  expect(inspectHouse(model,0).totals.mealsConsumed).toBe(0);
  stepPopulation(model,{minutes:1});
  expect(model.people.hunger[2]).toBeCloseTo(63,3);
  expect(inspectHouse(model,0).totals.mealsConsumed).toBe(1);
  expect(inspectHouse(model,0).preparedServings).toBe(3);
 }
});

test('shared dinner restores one useful serving per attending resident and consumes exactly their portions',()=>{
 const {model,householdId,cookId,childId}=fixture();
 model.people.hunger[0]=8;
 applyHouseholdAction(model,{householdId,personId:cookId,personIds:[cookId,childId],type:'sharedDinner'});
 expect(inspectHouse(model,0).preparedServings).toBe(2);
 expect(model.people.hunger[0]).toBe(8);
 expect(model.people.hunger[2]).toBe(8);
 stepPopulation(model,{minutes:15});
 for(const i of [0,2])expect(model.people.hunger[i]).toBeCloseTo(35.5,3);
 expect(inspectHouse(model,0).totals.mealsConsumed).toBe(0);
 stepPopulation(model,{minutes:15});
 for(const i of [0,2])expect(model.people.hunger[i]).toBeCloseTo(63,3);
 expect(inspectHouse(model,0).totals).toMatchObject({mealsPrepared:4,mealsConsumed:2,diningPersonMinutes:60});
 expect(inspectHouse(model,0).preparedServings).toBe(2);
});

test('saving during a meal resumes the same recovery and completion exactly once',()=>{
 const {model,householdId,childId}=fixture();
 applyHouseholdAction(model,{householdId,personId:childId,type:'eat'});
 stepPopulation(model,{minutes:10});
 const restored=restorePopulation(serializePopulation(model));
 expect(restored.people.hunger[2]).toBeCloseTo(35.5,3);
 for(const m of [model,restored])stepPopulation(m,{minutes:10});
 expect(serializePopulation(restored)).toEqual(serializePopulation(model));
 expect(restored.people.hunger[2]).toBeCloseTo(63,3);
 expect(inspectHouse(restored,0).totals.mealsConsumed).toBe(1);
 expect(inspectHouse(restored,0).preparedServings).toBe(3);
});

test('eating still requires cooked food and fullness remains capped at 100',()=>{
 const {model,householdId,cookId,childId}=fixture({cook:false}),before=serializePopulation(model);
 expect(()=>applyHouseholdAction(model,{householdId,personId:childId,type:'eat'})).toThrow('Cook a prepared serving');
 expect(serializePopulation(model)).toEqual(before);
 applyHouseholdAction(model,{householdId,personId:cookId,type:'cook'});
 stepPopulation(model,{minutes:30});
 model.people.hunger[2]=95;
 applyHouseholdAction(model,{householdId,personId:childId,type:'eat'});
 stepPopulation(model,{minutes:20});
 expect(model.people.hunger[2]).toBe(100);
 expect(inspectHouse(model,0).totals.mealsConsumed).toBe(1);
 expect(inspectHouse(model,0).preparedServings).toBe(3);
});
