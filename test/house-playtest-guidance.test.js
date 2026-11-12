import {test,expect} from 'bun:test';
import {createPopulationModel,inspectHousehold,stepPopulation} from '../world/population/model.js';
import {HOUSE_ACTIONS} from '../world/house/model.js';
import {queueHouseholdTask} from '../world/house/task-queue.js';
import {householdCommandCatalog} from '../world/house/app.js';
import {houseActivityLabel} from '../world/house/house-ui.js';
import {conversationPartnerAvailability} from '../world/house/conversation-topics.js';
import {queuedHouseRequestAvailability,houseMealGuidance} from '../world/house/request-guidance.js';

const fixture=()=>createPopulationModel({population:8,householdSize:4},{},{initialMinute:360,initialTick:360});
const request=(model,type,index=0)=>({householdId:model.prefix+'-h0',personId:model.prefix+'-p'+index,type});

test('underage menu requests and authoritative queue admission agree without mutating the save',()=>{
 const model=fixture();model.people.ageYears[0]=4;model.people.age[0]=0;
 const savings=model.households.savings[0],minute=model.minute;
 for(const type of ['cook','read','shower','toilet']){
  const gate=queuedHouseRequestAvailability({type,definition:HOUSE_ACTIONS[type],person:{ageYears:4}});
  expect(gate.available).toBe(false);expect(gate.reason).toContain('age');
  expect(()=>queueHouseholdTask(model,request(model,type))).toThrow('requires age');
 }
 expect(model.houseTasks).toBeUndefined();expect(model.houses).toBeUndefined();
 expect(model.households.savings[0]).toBe(savings);expect(model.minute).toBe(minute);
 expect(queuedHouseRequestAvailability({type:'cook',definition:HOUSE_ACTIONS.cook,person:{id:'unknown-age'}}).available).toBe(false);
 for(const type of ['music','rest','eat'])expect(queuedHouseRequestAvailability({type,definition:HOUSE_ACTIONS[type],person:{ageYears:4}}).available).toBe(true);
});

test('a child can still queue food and wait for an actual cooked serving',()=>{
 const model=fixture();model.people.ageYears[0]=4;model.people.age[0]=0;
 const meal=queueHouseholdTask(model,request(model,'eat')).task;
 stepPopulation(model,{minutes:1});
 expect(model.houseTasks.byPerson[0][0]).toMatchObject({id:meal.id,status:'blocked'});
 expect(model.houseTasks.byPerson[0][0].reason).toContain('prepared serving');
 expect(inspectHousehold(model,0).house.preparedServings).toBe(0);
 const busyAdult={ageYears:30,atHome:false,activeActionId:'working',date:{id:'date'}};
 expect(queuedHouseRequestAvailability({type:'cook',definition:HOUSE_ACTIONS.cook,person:busyAdult}).available).toBe(true);
});

test('quick requests report missing meals before a click and respect the same age gates',()=>{
 const model=fixture(),household=inspectHousehold(model,0),home=household.house;
 const child={...household.memberDetails[0],...home.members[0],ageYears:4,atHome:true};
 const runtime={householdAction(){}};
 let catalog=householdCommandCatalog({...home,preparedServings:0},runtime,child,household);
 expect(catalog.find(entry=>entry.command?.type==='eat')).toMatchObject({supported:false});
 expect(catalog.find(entry=>entry.command?.type==='eat').reason).toContain('No prepared meals');
 expect(catalog.find(entry=>entry.command?.type==='cook').supported).toBe(false);
 catalog=householdCommandCatalog({...home,preparedServings:1},runtime,child,household);
 expect(catalog.find(entry=>entry.command?.type==='eat').supported).toBe(true);
});

test('meal help identifies real preparation and an eligible home cook without inventing food',()=>{
 const child={id:'p0',index:0,ageYears:4,atHome:true},teen={id:'p1',index:1,ageYears:13,atHome:true},onDate={id:'p2',index:2,ageYears:40,atHome:true,date:{id:'date-1'}};
 const data={minute:375,members:[child,teen,onDate],home:{preparedServings:0,actionCatalog:HOUSE_ACTIONS,actions:[]}};
 const before=structuredClone(data);
 expect(houseMealGuidance(data,child)).toMatchObject({servings:0,cooks:[teen],cooking:null,queuedMeal:false});
 expect(data).toEqual(before);
 data.home.actions=[{id:'cook-1',type:'cook',participants:[1],until:390}];
 data.home.taskQueues=[{personId:'p0',tasks:[{request:{type:'eat'},status:'blocked'}]}];
 expect(houseMealGuidance(data,child)).toMatchObject({servings:0,cooks:[],cooking:{person:teen,minutesLeft:15},queuedMeal:true});
});

test('date reservations have truthful labels and cannot masquerade as available house actions',()=>{
 const resident={id:'p0',ageYears:40,atHome:true,currentActivity:'HOME',needActivity:'Sleeping',date:{id:'date-1',householdId:'h0',label:'Walking in the date neighborhood'}};
 expect(houseActivityLabel(resident)).toBe('Walking in the date neighborhood');
 const home={actionCatalog:HOUSE_ACTIONS,objects:[{type:'stove',roomId:'kitchen'},{type:'diningTable',roomId:'kitchen'}],preparedServings:2,members:[resident]};
 const catalog=householdCommandCatalog(home,{householdAction(){}},resident,{savings:100});
 expect(catalog.find(entry=>entry.command?.type==='cook')).toMatchObject({supported:false});
 expect(catalog.find(entry=>entry.command?.type==='cook').reason).toContain('on a date');
 expect(catalog.find(entry=>entry.command?.type==='eat').supported).toBe(false);
 expect(conversationPartnerAvailability(resident,home)).toEqual({available:false,reason:'On a date'});
 expect(conversationPartnerAvailability({...resident,id:'p1',date:null},home).available).toBe(true);
 expect(conversationPartnerAvailability({...resident,date:null,atHome:false},home).available).toBe(false);
 const homeDate={householdId:'h0',systems:{dates:{active:{id:'date-2',personIds:['p1']}}}};
 expect(conversationPartnerAvailability({id:'p1',atHome:true},homeDate).available).toBe(false);
});
