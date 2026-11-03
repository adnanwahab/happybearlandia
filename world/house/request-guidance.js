import {isOnDate} from './resident-location.js';

const rows=value=>Array.isArray(value)?value:[];
const idOf=person=>person?.id??person?.personId;

/** Queues may wait for resources, but must not accept impossible age requirements. */
export function queuedHouseRequestAvailability({definition,type,person,queueSupported=true}={}){
 if(!queueSupported)return{available:false,reason:'Task queues are not available in this view.'};
 if(!definition||!(definition.durationMinutes>0))return{available:false,reason:'Only timed resident activities can be queued.'};
 if(['conversation','sharedDinner','hug','cuddle'].includes(type))return{available:false,reason:'Start paired activities with Do now.'};
 if(!person)return{available:false,reason:'Choose a resident first.'};
 if(definition.minAge>0&&!Number.isFinite(person.ageYears))return{available:false,reason:'Age is unavailable. Refresh the resident details before queueing this action.'};
 if(Number.isFinite(person.ageYears)&&person.ageYears<definition.minAge)return{available:false,reason:'This action requires age '+definition.minAge+' or older.'};
 return{available:true,queued:true,reason:'The task will wait for its turn and any required food or objects.'};
}

/** A view of real meal preparation, with no invented food or caregiver actions. */
export function houseMealGuidance(data={},person){
 const home=data.home??{},members=rows(data.members??home.members),definition=home.actionCatalog?.cook;
 const cooking=rows(home.actions).find(action=>action.type==='cook');
 const cook=cooking&&members.find(member=>rows(cooking.participants).includes(member.index));
 const minute=data.minute??home.minute;
 const minutesLeft=cooking&&Number.isFinite(cooking.until)&&Number.isFinite(minute)?Math.max(0,Math.ceil(cooking.until-minute)):null;
 const cooks=definition?members.filter(member=>idOf(member)!==idOf(person)&&member.atHome!==false&&!isOnDate(member,data)&&Number.isFinite(member.ageYears)&&member.ageYears>=definition.minAge&&!member.activeActionId&&!rows(home.actions).some(action=>rows(action.participants).includes(member.index))):[];
 const queuedMeal=rows(home.taskQueues).find(queue=>queue.personId===idOf(person))?.tasks?.some(task=>task.request?.type==='eat');
 return{servings:Math.max(0,Number.isFinite(home.preparedServings)?home.preparedServings:0),cooking:cooking?{action:cooking,person:cook,minutesLeft}:null,cooks,queuedMeal:!!queuedMeal};
}
