import {test, expect} from 'bun:test';
import {lifeCaption} from '../world/house/life-captions.js';
const event={id:'run-event-4',type:'HOUSEHOLD_ACTION_COMPLETED',synthetic:true,schemaVersion:'event.v2',modelVersion:'fixture.v1',tick:40,householdId:'run-h0',actionId:'run-h0-action-2',actionType:'clean',minute:40,actualPersonMinutes:10};
const home={householdId:'run-h0',completedActions:[{id:event.actionId,type:'clean',completedMinute:40}]};
test('caption is deterministic, retains source identity and leaves inputs unchanged',()=>{
 const before=JSON.stringify({event,home});const result=lifeCaption(event,home,40);
 expect(result.eventId).toBe(event.id);expect(result.label).toContain('Narrative color');
 expect(lifeCaption(event,home,40)).toEqual(result);expect(JSON.stringify({event,home})).toBe(before);
});
test('rejects missing, mismatched, future, uncompleted and unsupported evidence',()=>{
 for(const patch of [{synthetic:false},{schemaVersion:'event.v1'},{tick:NaN},{modelVersion:null},{id:''},{id:null},{type:'HOUSEHOLD_ACTION_STARTED'},{type:'HOUSEHOLD_ACTION_CANCELLED'},{householdId:'other'},{actionId:'missing'},{actionType:'cook'},{minute:41},{minute:NaN},{actualPersonMinutes:0}])expect(lifeCaption({...event,...patch},home,40)).toBeNull();
 expect(lifeCaption(event,{...home,completedActions:[]},40)).toBeNull();
 expect(lifeCaption(event,{...home,completedActions:[{...home.completedActions[0],completedMinute:39}]},40)).toBeNull();
});

test('each mundane template requires its matching completed action',()=>{
 for(const type of ['clean','read','rest','music']) {
  const source={...event,actionType:type},state={...home,completedActions:[{...home.completedActions[0],type}]};
  expect(lifeCaption(source,state,40)?.text).toBeTruthy();
  expect(lifeCaption(source,{...state,completedActions:[{...state.completedActions[0],type:'cook'}]},40)).toBeNull();
 }
});
